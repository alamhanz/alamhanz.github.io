import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { HttpError, assertSlug, assetsDir, getRoot, imagesPath, postPath, postsDir, readPost, setDraft } from './posts.mjs';

/** Default runner: execFile with an argument array, never a shell string. */
export function defaultRun(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd: opts.cwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024, timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) {
        const e = new Error(`${cmd} ${args[0] ?? ''} failed: ${String(stderr || err.message).trim()}`);
        e.code = err.code;
        reject(e);
      } else resolve(String(stdout).trim());
    });
  });
}

export async function ghStatus(run = defaultRun, root = getRoot()) {
  try {
    await run('gh', ['auth', 'status'], { cwd: root });
    return true;
  } catch {
    return false;
  }
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Publish a post as a PR against xyz using a temporary worktree.
 * `run` is injectable (tests); `dryRun` returns the planned steps without touching anything.
 */
export async function publishPost(slug, { dryRun = false, run = defaultRun, root = getRoot(), onStep = () => {} } = {}) {
  assertSlug(slug);
  const branch = `post/${slug}`;
  const mdRel = `src/content/blog/${slug}.md`;
  const imgRel = `src/assets/blog/${slug}`;

  if (dryRun) {
    return {
      dryRun: true,
      steps: [
        'gh auth status',
        'git remote get-url origin',
        `set draft:false in ${mdRel}`,
        `git fetch origin xyz`,
        `git ls-remote --heads origin ${branch}`,
        `git worktree add -b ${branch} <tmp> origin/xyz  (or -B ${branch} <tmp> origin/${branch} if it exists)`,
        `copy ${mdRel} and ${imgRel}/ into the worktree`,
        `git add -A -- ${mdRel} ${imgRel}`,
        `git commit -m "blog: publish ${slug}"`,
        `git push -u origin ${branch}`,
        `gh pr view ${branch} --json url,state  (else gh pr create --base xyz --head ${branch})`,
        'git worktree remove --force <tmp>; git branch -D ' + branch,
      ],
    };
  }

  const cwd = root;
  const git = (args, c = cwd) => run('git', args, { cwd: c });

  onStep('Checking GitHub CLI');
  if (!(await ghStatus(run, root))) throw new HttpError(412, 'GitHub CLI is not ready. Install it and run `gh auth login`.');
  try {
    await git(['remote', 'get-url', 'origin']);
  } catch {
    throw new HttpError(412, 'No git remote named origin.');
  }

  onStep('Marking post as published');
  await setDraft(slug, false, root);
  const { meta } = await readPost(slug, root);

  onStep('Fetching origin');
  await git(['fetch', 'origin', 'xyz']);
  const remoteHas = (await git(['ls-remote', '--heads', 'origin', branch])).trim() !== '';
  if (remoteHas) await git(['fetch', 'origin', branch]);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `blog-publish-${slug}-`));
  const wt = path.join(dir, 'wt');
  let added = false;
  try {
    onStep('Preparing worktree');
    if (remoteHas) await git(['worktree', 'add', '-B', branch, wt, `origin/${branch}`]);
    else await git(['worktree', 'add', '-b', branch, wt, 'origin/xyz']);
    added = true;

    await fs.mkdir(postsDir(wt), { recursive: true });
    await fs.copyFile(postPath(slug, root), postPath(slug, wt));
    const tracked = (await git(['ls-files', '--', imgRel], wt)).trim() !== '';
    const srcImgs = imagesPath(slug, root);
    const hasImgs = await pathExists(srcImgs);
    await fs.rm(imagesPath(slug, wt), { recursive: true, force: true });
    if (hasImgs) {
      await fs.mkdir(assetsDir(wt), { recursive: true });
      await fs.cp(srcImgs, imagesPath(slug, wt), { recursive: true });
    }
    const paths = [mdRel, ...(hasImgs || tracked ? [imgRel] : [])];

    onStep('Committing');
    await git(['add', '-A', '--', ...paths], wt);
    if ((await git(['status', '--porcelain', '--', ...paths], wt)).trim() === '') {
      return { ok: true, noChanges: true, message: 'No changes to publish.' };
    }
    await git(['commit', '-m', `blog: publish ${slug}`], wt);

    onStep('Pushing');
    await git(['push', '-u', 'origin', branch], wt);

    onStep('Opening pull request');
    let url = '';
    try {
      const view = JSON.parse(await run('gh', ['pr', 'view', branch, '--json', 'url,state'], { cwd }));
      if (view.state === 'OPEN') url = view.url;
    } catch {
      // no PR yet
    }
    if (!url) {
      url = await run(
        'gh',
        ['pr', 'create', '--base', 'xyz', '--head', branch, '--title', `blog: ${meta.title || slug}`, '--body', `New post: ${slug}`],
        { cwd },
      );
    }
    return { ok: true, url: url.split(/\r?\n/).pop(), hint: 'After the PR is merged, run `git pull` on your main checkout.' };
  } finally {
    if (added) await git(['worktree', 'remove', '--force', wt]).catch(() => {});
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    await git(['worktree', 'prune']).catch(() => {});
    await git(['branch', '-D', branch]).catch(() => {});
  }
}
