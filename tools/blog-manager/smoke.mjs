// Smoke tests for the blog manager. Usage: node tools/blog-manager/smoke.mjs [--unit] [--server]
// Default runs both. Never touches the real repo content or the network.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { editorUnit } from './editor-unit.mjs';
import { sanitizeName } from './images.mjs';
import { HttpError, REPO_ROOT, assertSlug, parse, safeJoin, serialize, slugify } from './posts.mjs';
import { publishPost } from './publish.mjs';
import { astroReachable, createManagerServer } from './server.mjs';

const args = new Set(process.argv.slice(2));
const runUnit = args.has('--unit') || !args.has('--server');
const runServer = args.has('--server') || !args.has('--unit');
let passed = 0;

function ok(name, fn) {
  return Promise.resolve(fn()).then(
    () => {
      passed++;
      console.log(`ok   ${name}`);
    },
    (err) => {
      console.error(`FAIL ${name}\n     ${err.stack || err}`);
      process.exitCode = 1;
    },
  );
}
const throws400 = (fn) => assert.throws(fn, (e) => e instanceof HttpError && e.status === 400);

async function unit() {
  await editorUnit(ok);
  await ok('slug validator', () => {
    for (const s of ['a', 'hello-world', 'a1-b2', 'x'.repeat(80)]) assertSlug(s);
    for (const s of ['', 'A', '../x', '%2e%2e', 'a/b', '..\\x', 'C:\\x', '/etc/passwd', 'a--b', '-a', 'a-', 'x'.repeat(81), 'a b', null, 'con', 'nul', 'com1', 'lpt9']) throws400(() => assertSlug(s));
  });
  await ok('safeJoin confines paths', () => {
    const base = path.resolve(os.tmpdir(), 'bm-base');
    assert.equal(safeJoin(base, 'a.md'), path.join(base, 'a.md'));
    for (const bad of ['../x', '..\\x', path.resolve('/etc/passwd'), 'a/../../x']) throws400(() => safeJoin(base, bad));
  });
  await ok('front matter round trip (colons, quotes, unicode)', () => {
    const meta = {
      title: `He said: "it's #1" - done`,
      description: 'colon: yes, quote \' and " and [brackets]',
      pubDate: '2026-10-12',
      tags: ['a:b', "it's", 'x "y"', '#hash'],
      cover: '../../assets/blog/s/cover.jpg',
      coverAlt: 'Alt: text',
      draft: true,
    };
    const text = serialize(meta, 'Body\n\n- item\n');
    assert.ok(/^---\ntitle:/.test(text));
    assert.ok(text.indexOf('pubDate') < text.indexOf('tags') && text.indexOf('tags') < text.indexOf('cover'));
    assert.match(text, /pubDate: 2026-10-12\n/);
    const back = parse(text);
    assert.equal(back.body.trim(), 'Body\n\n- item');
    assert.equal(back.meta.title, meta.title);
    assert.equal(back.meta.description, meta.description);
    assert.deepEqual(back.meta.tags, meta.tags);
    assert.equal(back.meta.draft, true);
    assert.equal(serialize(back.meta, back.body), text);
  });
  await ok('image name sanitizer', () => {
    assert.equal(sanitizeName('My Photo (1).PNG'), 'my-photo-1.png');
    assert.equal(sanitizeName('..\\..\\evil.jpg'), 'evil.jpg');
    assert.equal(sanitizeName('/abs/path/x.webp'), 'x.webp');
    assert.equal(sanitizeName('a.b.c.png'), 'a-b-c.png');
    assert.equal(sanitizeName('CON.png'), 'img-con.png');
    for (const bad of ['x.exe', 'x', 'x.html', '.png.txt']) throws400(() => sanitizeName(bad));
  });
  await ok('slugify', () => assert.equal(slugify('Héllo, World! 2026'), 'hello-world-2026'));
  await ok('astroReachable: any listener counts (even one that never answers HTTP), a closed port does not', async () => {
    const tcp = net.createServer((s) => s.on('error', () => {}));
    await new Promise((r) => tcp.listen(0, '127.0.0.1', r));
    const { port } = tcp.address();
    assert.equal(await astroReachable(port), true);
    await new Promise((r) => tcp.close(r));
    assert.equal(await astroReachable(port, 500), false);
  });
  await ok('UI: new-post slug is editable; editor slug is editable only for drafts (rename) and explained', async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const html = await fs.readFile(path.join(here, 'ui', 'index.html'), 'utf8');
    const tag = (id) => new RegExp(`<input[^>]*id="${id}"[^>]*>`).exec(html)?.[0] ?? '';
    assert.doesNotMatch(tag('n-slug'), /(readonly|disabled)/);
    const page = await fs.readFile(path.join(here, 'ui', 'src', 'editor-page.js'), 'utf8');
    assert.match(page, /readOnly: !isDraft/);
    assert.match(page, /className: 'hint'/);
  });
}

function request(port, method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers: { Host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        let data = null;
        try {
          data = JSON.parse(raw.toString('utf8'));
        } catch {
          // not json
        }
        resolve({ status: res.statusCode, data, raw, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}
const jreq = (port, method, p, obj, headers) =>
  request(port, method, p, { body: obj === undefined ? undefined : JSON.stringify(obj), headers: { 'Content-Type': 'application/json', ...headers } });

async function serverTests() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-smoke-'));
  const calls = [];
  let failPush = false;
  const fakeRun = async (cmd, a, opts = {}) => {
    calls.push([cmd, ...a]);
    if (cmd === 'git' && a[0] === 'worktree' && a[1] === 'add') await fs.mkdir(a.at(-2), { recursive: true });
    if (cmd === 'git' && a[0] === 'push' && failPush) throw new Error('push rejected');
    if (cmd === 'git' && a[0] === 'status' && a.includes('--porcelain')) return ' M changed';
    if (cmd === 'gh' && a[0] === 'pr' && a[1] === 'view') throw new Error('no pr');
    if (cmd === 'gh' && a[0] === 'pr' && a[1] === 'create') return 'https://example.invalid/pr/1';
    return '';
  };
  process.env.BLOG_ROOT = root;
  const server = createManagerServer({ port: 0, astroPort: 1, root, run: fakeRun });
  // port is needed for Host checks, so bind first then rebuild with the real port
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  server.close();
  const srv = createManagerServer({ port, astroPort: 1, root, run: fakeRun });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));

  try {
    await ok('list is empty, create 201, duplicate 409', async () => {
      assert.deepEqual((await jreq(port, 'GET', '/api/posts')).data, []);
      const c = await jreq(port, 'POST', '/api/posts', { title: 'Smoke Test', description: 'd', tags: ['t'] });
      assert.equal(c.status, 201);
      assert.equal(c.data.slug, 'smoke-test');
      assert.equal((await jreq(port, 'POST', '/api/posts', { title: 'Smoke Test' })).status, 409);
      const list = (await jreq(port, 'GET', '/api/posts')).data;
      assert.equal(list.length, 1);
      assert.equal(list[0].draft, true);
    });

    await ok('get/put round trip', async () => {
      const g = (await jreq(port, 'GET', '/api/posts/smoke-test')).data;
      assert.equal(g.meta.title, 'Smoke Test');
      const put = await jreq(port, 'PUT', '/api/posts/smoke-test', { meta: { ...g.meta, description: 'new: desc' }, body: 'Hello\n' });
      assert.equal(put.status, 200);
      const g2 = (await jreq(port, 'GET', '/api/posts/smoke-test')).data;
      assert.equal(g2.meta.description, 'new: desc');
      assert.equal(g2.body.trim(), 'Hello');
      assert.equal((await jreq(port, 'PUT', '/api/posts/smoke-test', { meta: { ...g.meta, cover: '../../assets/blog/other/c.png' }, body: '' })).status, 400);
    });

    await ok('image upload, fetch, limits', async () => {
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
      const up = await request(port, 'PUT', '/api/posts/smoke-test/images?name=Cover%20Pic.PNG', { body: png });
      assert.equal(up.status, 201);
      assert.equal(up.data.path, '../../assets/blog/smoke-test/cover-pic.png');
      assert.equal(up.data.markdown, '![](../../assets/blog/smoke-test/cover-pic.png)');
      const got = await request(port, 'GET', '/api/posts/smoke-test/images/cover-pic.png');
      assert.equal(got.status, 200);
      assert.equal(got.headers['content-type'], 'image/png');
      assert.equal((await request(port, 'PUT', '/api/posts/smoke-test/images?name=x.exe', { body: png })).status, 400);
      assert.equal((await request(port, 'PUT', '/api/posts/smoke-test/images?name=big.png', { body: Buffer.alloc(10 * 1024 * 1024 + 1) })).status, 413);
      assert.equal((await request(port, 'PUT', '/api/posts/missing/images?name=a.png', { body: png })).status, 404);
      const svg = await request(port, 'PUT', '/api/posts/smoke-test/images?name=v.svg', { body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
      assert.equal(svg.status, 201);
      assert.equal((await request(port, 'GET', '/api/posts/smoke-test/images/v.svg')).headers['content-security-policy'], 'sandbox');
    });

    await ok('traversal and bad slugs rejected with 400', async () => {
      for (const s of ['..', '%2e%2e', 'a%2fb', '..%5cx', '%2e%2e%2f%2e%2e%2fpackage.json', 'C%3A%5Cx', 'A', 'a%00b']) {
        const r = await jreq(port, 'GET', `/api/posts/${s}`);
        assert.equal(r.status, 400, `GET ${s} -> ${r.status}`);
      }
      assert.equal((await request(port, 'GET', '/api/posts/smoke-test/images/..%2f..%2fx.png')).status, 400);
      assert.equal((await jreq(port, 'POST', '/api/posts', { title: 'x', slug: '../evil' })).status, 400);
      assert.equal((await jreq(port, 'DELETE', '/api/posts/..%2f..%2fsrc')).status, 400);
    });

    await ok('Host and Origin guards', async () => {
      assert.equal((await request(port, 'GET', '/api/posts', { headers: { Host: 'evil.example' } })).status, 403);
      assert.equal((await request(port, 'GET', '/api/posts', { headers: { Host: `127.0.0.1:${port + 1}` } })).status, 403);
      assert.equal((await jreq(port, 'POST', '/api/posts', { title: 'Evil' }, { Origin: 'http://evil.example' })).status, 403);
      assert.equal((await jreq(port, 'POST', '/api/posts', { title: 'Same Origin' }, { Origin: `http://127.0.0.1:${port}` })).status, 201);
      assert.equal((await jreq(port, 'DELETE', '/api/posts/same-origin')).status, 200);
      assert.equal((await request(port, 'GET', '/', {})).status, 200);
      assert.equal((await request(port, 'GET', '/vendor/easymde.min.js', {})).status, 404);
      assert.equal((await request(port, 'GET', '/..%2fpackage.json', {})).status, 404);
    });

    await ok('/app.js serves the bundle, / sends a strict CSP', async () => {
      const js = await request(port, 'GET', '/app.js');
      assert.equal(js.status, 200);
      assert.match(js.headers['content-type'], /^text\/javascript/);
      assert.ok(js.raw.length > 0);
      assert.equal((await request(port, 'GET', '/app.js', { headers: { Host: 'evil.example' } })).status, 403);
      const csp = (await request(port, 'GET', '/')).headers['content-security-policy'];
      for (const d of ["default-src 'self'", "script-src 'self'", "font-src 'self'", "connect-src 'self'", "object-src 'none'", "frame-ancestors 'none'"]) {
        assert.ok(csp.includes(d), `CSP missing ${d}`);
      }
      assert.ok(!/script-src[^;]*unsafe/.test(csp), 'script-src must not allow unsafe');
      assert.ok(!/https?:\/\/(?!(127\.0\.0\.1|localhost):)/.test(csp), 'no third-party origins');
    });

    await ok('/fonts serves only allowlisted woff2 files', async () => {
      const f = await request(port, 'GET', '/fonts/poppins-latin-600-normal.woff2');
      assert.equal(f.status, 200);
      assert.equal(f.headers['content-type'], 'font/woff2');
      assert.equal(f.raw.subarray(0, 4).toString('latin1'), 'wOF2');
      assert.equal((await request(port, 'GET', '/fonts/inter-latin-wght-normal.woff2')).status, 200);
      assert.equal((await request(port, 'GET', '/fonts/nope.woff2')).status, 404);
      for (const bad of ['..%2fpackage.json', '..%2f..%2f..%2fpackage.json', '%2e%2e%2fpackage.json', '..%5cpackage.json', '../package.json', 'poppins-latin-600-normal.woff', 'poppins-latin-600-normal.woff2%00.png', 'Poppins.woff2', '.woff2', '']) {
        const r = await request(port, 'GET', `/fonts/${bad}`);
        assert.ok([400, 404].includes(r.status), `/fonts/${bad} -> ${r.status}`);
      }
    });

    await ok('listing has description, updatedDate and words', async () => {
      const item = (await jreq(port, 'GET', '/api/posts')).data.find((p) => p.slug === 'smoke-test');
      assert.equal(item.description, 'new: desc');
      assert.equal(item.words, 1);
      assert.equal(item.updatedDate, null);
    });

    await ok('cover must be a real image file in the post folder', async () => {
      const meta = (await jreq(port, 'GET', '/api/posts/smoke-test')).data.meta;
      const put = (cover) => jreq(port, 'PUT', '/api/posts/smoke-test', { meta: { ...meta, cover, coverAlt: 'alt' }, body: 'Hello\n' });
      for (const bad of ['../../assets/blog/smoke-test/..', '../../assets/blog/smoke-test/.', '../../assets/blog/smoke-test/x.txt', '../../assets/blog/smoke-test/missing.png', '../../assets/blog/smoke-test/']) {
        assert.equal((await put(bad)).status, 400, bad);
      }
      assert.equal((await put('../../assets/blog/smoke-test/cover-pic.png')).status, 200);
    });

    await ok('publish validates meta before touching git (4xx, no calls)', async () => {
      const base = (await jreq(port, 'GET', '/api/posts/smoke-test')).data;
      const save = (m) => jreq(port, 'PUT', '/api/posts/smoke-test', { meta: m, body: base.body });
      const before = calls.length;
      assert.equal((await save({ ...base.meta, description: '' })).status, 200);
      let r = await jreq(port, 'POST', '/api/posts/smoke-test/publish', {});
      assert.equal(r.status, 422);
      assert.match(r.data.error ?? '', /description/);
      assert.equal((await save({ ...base.meta, coverAlt: '' })).status, 200);
      r = await jreq(port, 'POST', '/api/posts/smoke-test/publish', {});
      assert.equal(r.status, 422);
      assert.match(r.data.error ?? '', /coverAlt/);
      await fs.rm(path.join(root, 'src', 'assets', 'blog', 'smoke-test', 'cover-pic.png'));
      r = await jreq(port, 'POST', '/api/posts/smoke-test/publish', {});
      assert.equal(r.status, 422);
      assert.match(r.data.error ?? '', /cover/);
      assert.equal(calls.length, before, 'git/gh must not be called');
      // restore a valid post (no cover) for the later tests
      assert.equal((await save({ ...base.meta, cover: undefined, coverAlt: undefined })).status, 200);
    });

    await ok('one malformed post does not break the list', async () => {
      const bad = path.join(root, 'src', 'content', 'blog', 'broken-post.md');
      await fs.writeFile(bad, '---\ntitle: [unclosed\n  : : :\n---\nbody\n');
      const r = await jreq(port, 'GET', '/api/posts');
      assert.equal(r.status, 200);
      const broken = r.data.find((p) => p.slug === 'broken-post');
      assert.ok(broken && broken.error, 'flagged with error');
      assert.ok(r.data.some((p) => p.slug === 'smoke-test' && !p.error));
      await fs.rm(bad);
    });

    await ok('oversized JSON body is 413', async () => {
      const r = await request(port, 'POST', '/api/posts', { body: JSON.stringify({ title: 'x'.repeat(2_600_000) }), headers: { 'Content-Type': 'application/json' } });
      assert.equal(r.status, 413);
    });

    await ok('publishes are serialized by one global lock', async () => {
      await jreq(port, 'POST', '/api/posts', { title: 'Second Post', description: 'd' });
      let release;
      const gate = new Promise((r) => (release = r));
      const slowRun = async (cmd, a) => {
        if (cmd === 'git' && a[0] === 'fetch') await gate;
        return fakeRun(cmd, a);
      };
      const first = publishPost('second-post', { run: slowRun, root });
      await new Promise((r) => setTimeout(r, 50));
      await assert.rejects(publishPost('smoke-test', { run: fakeRun, root }), (e) => e instanceof HttpError && e.status === 409);
      release();
      await first;
      await jreq(port, 'DELETE', '/api/posts/second-post');
    });

    await ok('publish dryRun makes no calls', async () => {
      const before = calls.length;
      const r = await jreq(port, 'POST', '/api/posts/smoke-test/publish', { dryRun: true });
      assert.equal(r.status, 200);
      assert.equal(r.data.dryRun, true);
      assert.ok(r.data.steps.some((s) => s.includes('git push origin HEAD:refs/heads/post/smoke-test')));
      assert.equal(calls.length, before);
      assert.equal((await jreq(port, 'GET', '/api/posts/smoke-test')).data.meta.draft, true);
    });

    await ok('failed publish leaves local file unchanged and only drops its own temp branch', async () => {
      const file = path.join(root, 'src', 'content', 'blog', 'smoke-test.md');
      const before = await fs.readFile(file, 'utf8');
      calls.length = 0;
      failPush = true;
      const r = await jreq(port, 'POST', '/api/posts/smoke-test/publish', {});
      failPush = false;
      assert.equal(r.status, 500);
      assert.equal(await fs.readFile(file, 'utf8'), before);
      const flat = calls.map((c) => c.join(' '));
      assert.ok(flat.some((c) => c.startsWith('git branch -D blog-publish-tmp/smoke-test-')));
      assert.ok(!flat.some((c) => c.includes('-D post/smoke-test')));
      assert.ok(flat.some((c) => c.startsWith('git worktree remove --force')));
    });

    await ok('publish flow with stubbed runner (no real git/network)', async () => {
      const r = await jreq(port, 'POST', '/api/posts/smoke-test/publish', {});
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.match(r.data.hint, /git pull/);
      assert.equal(r.data.url, 'https://example.invalid/pr/1');
      const flat = calls.map((c) => c.join(' '));
      assert.ok(flat.some((c) => c.startsWith('git push origin HEAD:refs/heads/post/smoke-test')));
      assert.ok(flat.some((c) => c.includes('worktree add -b blog-publish-tmp/smoke-test-') && c.endsWith('origin/xyz')));
      assert.ok(flat.some((c) => c.startsWith('git commit -m blog: publish smoke-test')));
      assert.ok(flat.some((c) => c.startsWith('gh pr create --base xyz --head post/smoke-test')));
      assert.ok(flat.some((c) => c.startsWith('git worktree remove --force')));
      assert.ok(flat.some((c) => c.startsWith('git branch -D blog-publish-tmp/smoke-test-')));
      assert.ok(!flat.some((c) => c === 'git branch -D post/smoke-test'), 'never deletes a user branch');
      const meta = (await jreq(port, 'GET', '/api/posts/smoke-test')).data.meta;
      assert.notEqual(meta.draft, true);
      assert.equal((await jreq(port, 'POST', '/api/posts/smoke-test/unpublish')).status, 200);
      assert.equal((await jreq(port, 'GET', '/api/posts/smoke-test')).data.meta.draft, true);
    });

    await ok('unpublish on a real-shaped post (CRLF, quoted YAML) keeps content; missing post is 404', async () => {
      const real = (await fs.readFile(path.join(REPO_ROOT, 'src', 'content', 'blog', 'hello-world.md'), 'utf8')).replace(/\r?\n/g, '\r\n');
      await fs.writeFile(path.join(root, 'src', 'content', 'blog', 'hello-world.md'), real);
      const listed = (await jreq(port, 'GET', '/api/posts')).data.find((p) => p.slug === 'hello-world');
      assert.ok(listed && listed.draft === false, 'listed as published');
      assert.equal((await jreq(port, 'POST', `/api/posts/${listed.slug}/unpublish`)).status, 200);
      const after = (await jreq(port, 'GET', '/api/posts/hello-world')).data;
      assert.equal(after.meta.draft, true);
      assert.equal(after.meta.title, 'Hello, world');
      assert.match(after.body, /Welcome to my new blog/);
      const gone = await jreq(port, 'POST', '/api/posts/not-a-post/unpublish');
      assert.equal(gone.status, 404);
      assert.equal(gone.data.error, 'Post not found.');
      assert.equal((await jreq(port, 'DELETE', '/api/posts/hello-world')).status, 200);
    });

    await ok('/api/status reports the preview from a TCP probe', async () => {
      const tcp = net.createServer((s) => s.on('error', () => {}));
      await new Promise((r) => tcp.listen(0, '127.0.0.1', r));
      const probe = http.createServer();
      await new Promise((r) => probe.listen(0, '127.0.0.1', r));
      const p2 = probe.address().port;
      probe.close();
      const up = createManagerServer({ port: p2, astroPort: tcp.address().port, root, run: fakeRun });
      await new Promise((r) => up.listen(p2, '127.0.0.1', r));
      try {
        assert.equal((await jreq(p2, 'GET', '/api/status')).data.astroUp, true);
        await new Promise((r) => tcp.close(r));
        assert.equal((await jreq(p2, 'GET', '/api/status')).data.astroUp, false);
      } finally {
        up.closeAllConnections();
        up.close();
      }
    });

    await ok('rename: draft moves file and images, rewrites paths, original gone', async () => {
      const blog = path.join(root, 'src', 'content', 'blog');
      assert.equal((await jreq(port, 'POST', '/api/posts', { title: 'Old Name', slug: 'old-name', description: 'd' })).status, 201);
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
      await request(port, 'PUT', '/api/posts/old-name/images?name=cover.png', { body: png });
      await request(port, 'PUT', '/api/posts/old-name/images?name=pic.png', { body: png });
      const meta = (await jreq(port, 'GET', '/api/posts/old-name')).data.meta;
      const body = 'Intro ![](../../assets/blog/old-name/pic.png)\n\n![x](../../assets/blog/other/keep.png)\n';
      await jreq(port, 'PUT', '/api/posts/old-name', { meta: { ...meta, cover: '../../assets/blog/old-name/cover.png', coverAlt: 'alt' }, body });
      const r = await jreq(port, 'POST', '/api/posts/old-name/rename', { slug: 'new-name' });
      assert.equal(r.status, 200);
      assert.equal(r.data.slug, 'new-name');
      await assert.rejects(fs.access(path.join(blog, 'old-name.md')));
      await assert.rejects(fs.access(path.join(root, 'src', 'assets', 'blog', 'old-name')));
      await fs.access(path.join(root, 'src', 'assets', 'blog', 'new-name', 'pic.png'));
      const got = (await jreq(port, 'GET', '/api/posts/new-name')).data;
      assert.equal(got.meta.cover, '../../assets/blog/new-name/cover.png');
      assert.equal(got.meta.draft, true);
      assert.equal(got.body, 'Intro ![](../../assets/blog/new-name/pic.png)\n\n![x](../../assets/blog/other/keep.png)\n');
      assert.equal((await jreq(port, 'GET', '/api/posts/old-name')).status, 404);
      assert.equal((await request(port, 'GET', '/api/posts/new-name/images/pic.png')).status, 200);
    });

    await ok('rename refuses published posts, existing targets, bad slugs and traversal', async () => {
      const blog = path.join(root, 'src', 'content', 'blog');
      const rename = (from, slug, headers) => jreq(port, 'POST', `/api/posts/${from}/rename`, { slug }, headers);
      await jreq(port, 'POST', '/api/posts', { title: 'Other One', slug: 'other-one' });
      // existing target (post file, and a leftover image folder)
      let r = await rename('new-name', 'other-one');
      assert.equal(r.status, 409);
      await fs.mkdir(path.join(root, 'src', 'assets', 'blog', 'free-name'), { recursive: true });
      assert.equal((await rename('new-name', 'free-name')).status, 409);
      await fs.rm(path.join(root, 'src', 'assets', 'blog', 'free-name'), { recursive: true });
      // bad slugs and traversal never touch the disk
      const before = (await fs.readdir(blog)).sort();
      for (const bad of ['', 'Bad Slug', '../escape', '..\\escape', 'a/b', '%2e%2e', 'a--b', 'con', null, 5, 'x'.repeat(81)]) {
        r = await rename('new-name', bad);
        assert.equal(r.status, 400, `slug ${JSON.stringify(bad)} -> ${r.status}`);
      }
      assert.equal((await rename('new-name', 'new-name')).status, 400);
      assert.equal((await rename('..%2f..%2fpackage', 'ok-name')).status, 400);
      assert.equal((await rename('missing-post', 'ok-name')).status, 404);
      assert.equal((await rename('new-name', 'ok-name', { Origin: 'http://evil.example' })).status, 403);
      assert.deepEqual((await fs.readdir(blog)).sort(), before);
      // published posts are refused
      const meta = (await jreq(port, 'GET', '/api/posts/other-one')).data.meta;
      await fs.writeFile(path.join(blog, 'other-one.md'), serialize({ ...meta, draft: false }, 'Live\n'));
      r = await rename('other-one', 'renamed-live');
      assert.equal(r.status, 409);
      assert.match(r.data.error, /Only drafts/);
      await fs.access(path.join(blog, 'other-one.md'));
      await assert.rejects(fs.access(path.join(blog, 'renamed-live.md')));
      assert.equal((await jreq(port, 'DELETE', '/api/posts/other-one')).status, 200);
      assert.equal((await jreq(port, 'DELETE', '/api/posts/new-name')).status, 200);
    });

    await ok('round-trip fixtures: GET then PUT unchanged leaves the file equal to serialize(parse(original))', async () => {
      const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
      const names = (await fs.readdir(dir)).filter((n) => /^roundtrip-.*\.md$/.test(n));
      assert.ok(names.length >= 2, 'fixtures present');
      for (const name of names) {
        const slug = name.replace(/\.md$/, '');
        const dest = path.join(root, 'src', 'content', 'blog', name);
        const original = await fs.readFile(path.join(dir, name), 'utf8');
        await fs.writeFile(dest, original);
        const expected = serialize(parse(original).meta, parse(original).body);
        const got = (await jreq(port, 'GET', `/api/posts/${slug}`)).data;
        assert.equal(got.body, parse(original).body, `${slug} body served untouched`);
        const put = await jreq(port, 'PUT', `/api/posts/${slug}`, { meta: got.meta, body: got.body });
        assert.equal(put.status, 200, JSON.stringify(put.data));
        assert.equal(await fs.readFile(dest, 'utf8'), expected, `${slug} bytes after save`);
        assert.equal(serialize(parse(expected).meta, parse(expected).body), expected, `${slug} serialize is stable`);
        assert.equal((await jreq(port, 'DELETE', `/api/posts/${slug}`)).status, 200);
      }
    });

    await ok('delete removes post and images; missing is 404', async () => {
      assert.equal((await jreq(port, 'DELETE', '/api/posts/smoke-test')).status, 200);
      await assert.rejects(fs.access(path.join(root, 'src', 'assets', 'blog', 'smoke-test')));
      assert.equal((await jreq(port, 'DELETE', '/api/posts/smoke-test')).status, 404);
      assert.deepEqual((await jreq(port, 'GET', '/api/posts')).data, []);
    });
  } finally {
    srv.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}

if (runUnit) await unit();
if (runServer) await serverTests();
console.log(`\n${process.exitCode ? 'FAILED' : 'passed'}: ${passed} checks ok`);
