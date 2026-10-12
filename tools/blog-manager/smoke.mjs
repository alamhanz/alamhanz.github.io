// Smoke tests for the blog manager. Usage: node tools/blog-manager/smoke.mjs [--unit] [--server]
// Default runs both. Never touches the real repo content or the network.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { sanitizeName } from './images.mjs';
import { HttpError, assertSlug, parse, safeJoin, serialize, slugify } from './posts.mjs';
import { createManagerServer } from './server.mjs';

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
      assert.equal((await request(port, 'GET', '/vendor/easymde.min.js', {})).status, 200);
      assert.equal((await request(port, 'GET', '/..%2fpackage.json', {})).status, 404);
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
