import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { HttpError, assertCoverFile, assertSlug, assetsDir, getRoot, imagesPath, postPath, postsDir, readPost, serialize, setDraft, today } from './posts.mjs';

/** Default runner: execFile with an argument array, never a shell string. */
export function defaultRun(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd: opts.cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, windowsHide: true, maxBuffer: 10 * 1024 * 1024, timeout: 120_000 }, (err, stdout, stderr) => {
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
export async function publishPost(slug, opts = {}) {
  assertSlug(slug);
  if (opts.dryRun) return doPublish(slug, opts);
  // One global lock: all publishes share the same repo (fetch, worktrees, branches).
  if (publishLocked) throw new HttpError(409, 'Another publish is already running. Wait for it to finish.');
  publishLocked = true;
  try {
    return await doPublish(slug, opts);
  } finally {
    publishLocked = false;
  }
}

let publishLocked = false;

const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';

/** Mirror src/content.config.ts (title, description required) plus the manager's cover/alt rules; 422 on failure. */
async function assertPublishable(slug, meta, root) {
  if (!nonEmpty(meta.title)) throw new HttpError(422, 'Cannot publish: title is required.');
  if (!nonEmpty(meta.description)) throw new HttpError(422, 'Cannot publish: description is required.');
  if (meta.cover) {
    try {
      await assertCoverFile(meta.cover, slug, root);
    } catch (err) {
      throw new HttpError(422, `Cannot publish: ${err.message}`);
    }
    if (!nonEmpty(meta.coverAlt)) throw new HttpError(422, 'Cannot publish: coverAlt is required when a cover is set.');
  }
}

async function doPublish(slug, { dryRun = false, run = defaultRun, root = getRoot(), onStep = () => {} }) {
  const branch = `post/${slug}`;
  const mdRel = `src/content/blog/${slug}.md`;
  const imgRel = `src/assets/blog/${slug}`;

  if (dryRun) {
    return {
      dryRun: true,
      steps: [
        'gh auth status',
        'git remote get-url origin',
        `write draft:false version of ${mdRel} into the worktree only`,
        `git fetch origin xyz`,
        `git ls-remote --heads origin ${branch}`,
        `git worktree add -b <tmp-branch> <tmp> origin/xyz  (or origin/${branch} if it exists)`,
        `copy ${mdRel} and ${imgRel}/ into the worktree`,
        `git add -A -- ${mdRel} ${imgRel}`,
        `git commit -m "blog: publish ${slug}"`,
        `git push origin HEAD:refs/heads/${branch}`,
        `gh pr view ${branch} --json url,state  (else gh pr create --base xyz --head ${branch})`,
        'git worktree remove --force <tmp>; git branch -D <tmp-branch>  (your own ' + branch + ' is never touched)',
      ],
    };
  }

  const cwd = root;
  const git = (args, c = cwd) => run('git', args, { cwd: c });

  const { meta, body } = await readPost(slug, root);
  await assertPublishable(slug, meta, root);

  onStep('Checking GitHub CLI');
  if (!(await ghStatus(run, root))) throw new HttpError(412, 'GitHub CLI is not ready. Install it and run `gh auth login`.');
  try {
    await git(['remote', 'get-url', 'origin']);
  } catch {
    throw new HttpError(412, 'No git remote named origin.');
  }

  const published = { ...meta, draft: false, pubDate: meta.pubDate || today() };

  onStep('Fetching origin');
  await git(['fetch', 'origin', 'xyz']);
  const remoteHas = (await git(['ls-remote', '--heads', 'origin', branch])).trim() !== '';
  if (remoteHas) await git(['fetch', 'origin', branch]);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `blog-publish-${slug}-`));
  const wt = path.join(dir, 'wt');
  // Always use a private temp branch so a pre-existing local post/<slug> is never reused or deleted.
  const tmpBranch = `blog-publish-tmp/${slug}-${Date.now().toString(36)}`;
  let added = false;
  let createdBranch = false;
  try {
    onStep('Preparing worktree');
    await git(['worktree', 'add', '-b', tmpBranch, wt, remoteHas ? `origin/${branch}` : 'origin/xyz']);
    added = true;
    createdBranch = true;

    await fs.mkdir(postsDir(wt), { recursive: true });
    await fs.writeFile(postPath(slug, wt), serialize(published, body));
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
    await git(['push', 'origin', `HEAD:refs/heads/${branch}`], wt);

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
    await setDraft(slug, false, root);
    return {
      ok: true,
      url: url.split(/\r?\n/).pop(),
      hint: `After the PR is merged, remove your local copy first or git pull will clash: for a new post delete ${mdRel} and ${imgRel}/ (the Delete button does this); for an edit of an already-merged post run git restore -- ${mdRel} ${imgRel}. Then git pull.`,
    };
  } finally {
    if (added) await git(['worktree', 'remove', '--force', wt]).catch(() => {});
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    await git(['worktree', 'prune']).catch(() => {});
    if (createdBranch) await git(['branch', '-D', tmpBranch]).catch(() => {});
  }
}
