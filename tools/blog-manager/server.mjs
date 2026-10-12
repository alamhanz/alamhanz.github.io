import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_IMAGE_BYTES, listImages, readImage, saveImage } from './images.mjs';
import { HttpError, REPO_ROOT, assertSlug, createPost, deletePost, getRoot, listPosts, readPost, savePost, setDraft } from './posts.mjs';
import { defaultRun, ghStatus, publishPost } from './publish.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.join(HERE, 'ui');
const VENDOR_DIR = path.join(REPO_ROOT, 'node_modules', 'easymde', 'dist');
const JSON_LIMIT = 2_500_000;

const STATIC = {
  '/': [path.join(UI_DIR, 'index.html'), 'text/html; charset=utf-8'],
  '/app.js': [path.join(UI_DIR, 'app.js'), 'text/javascript; charset=utf-8'],
  '/style.css': [path.join(UI_DIR, 'style.css'), 'text/css; charset=utf-8'],
  '/vendor/easymde.min.js': [path.join(VENDOR_DIR, 'easymde.min.js'), 'text/javascript; charset=utf-8'],
  '/vendor/easymde.min.css': [path.join(VENDOR_DIR, 'easymde.min.css'), 'text/css; charset=utf-8'],
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}
const sendJson = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, 'Request body too large.');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const buf = await readBody(req, JSON_LIMIT);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON.');
  }
}

export function createManagerServer({ port, astroPort, root = getRoot(), run = defaultRun } = {}) {
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const origins = new Set([...hosts].map((h) => `http://${h}`));
  const steps = new Map();
  let ghCache = { at: 0, ok: false };

  const csp = [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    `frame-src http://127.0.0.1:${astroPort} http://localhost:${astroPort}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

  async function status() {
    let astroUp = false;
    try {
      const r = await fetch(`http://127.0.0.1:${astroPort}/`, { signal: AbortSignal.timeout(1500) });
      astroUp = r.status < 500;
    } catch {
      astroUp = false;
    }
    if (Date.now() - ghCache.at > 30_000) ghCache = { at: Date.now(), ok: await ghStatus(run, root) };
    let branch = null;
    let dirty = null;
    try {
      branch = await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root });
      dirty = (await run('git', ['status', '--porcelain'], { cwd: root })) !== '';
    } catch {
      // not a git checkout (tests)
    }
    return { astroUp, astroPort, ghOk: ghCache.ok, branch, dirty };
  }

  async function api(req, res, url) {
    const method = req.method;
    const parts = url.pathname.split('/').slice(2).map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        throw new HttpError(400, 'Bad URL encoding.');
      }
    });
    const [kind, slug, sub, file] = parts;

    if (kind === 'status' && method === 'GET' && parts.length === 1) return sendJson(res, 200, await status());
    if (kind !== 'posts') throw new HttpError(404, 'Not found.');

    if (parts.length === 1) {
      if (method === 'GET') return sendJson(res, 200, await listPosts(root));
      if (method === 'POST') return sendJson(res, 201, await createPost(await readJson(req), root));
      throw new HttpError(405, 'Method not allowed.');
    }
    assertSlug(slug);

    if (parts.length === 2) {
      if (method === 'GET') return sendJson(res, 200, { ...(await readPost(slug, root)), images: await listImages(slug, root) });
      if (method === 'PUT') return sendJson(res, 200, await savePost(slug, await readJson(req), root));
      if (method === 'DELETE') return sendJson(res, 200, await deletePost(slug, root));
      throw new HttpError(405, 'Method not allowed.');
    }
    if (sub === 'images' && parts.length === 3 && method === 'PUT') {
      const buf = await readBody(req, MAX_IMAGE_BYTES);
      return sendJson(res, 201, await saveImage(slug, url.searchParams.get('name'), buf, root));
    }
    if (sub === 'images' && parts.length === 4 && method === 'GET') {
      const img = await readImage(slug, file, root);
      const headers = { 'Content-Type': img.type };
      if (img.type === 'image/svg+xml') headers['Content-Security-Policy'] = 'sandbox';
      return send(res, 200, img.data, headers);
    }
    if (sub === 'unpublish' && parts.length === 3 && method === 'POST') {
      await setDraft(slug, true, root);
      return sendJson(res, 200, { ok: true });
    }
    if (sub === 'publish' && parts.length === 3 && method === 'POST') {
      const body = await readJson(req);
      if (steps.has(slug)) throw new HttpError(409, 'A publish is already running for this post.');
      steps.set(slug, 'Starting');
      try {
        const result = await publishPost(slug, { dryRun: body.dryRun === true, run, root, onStep: (s) => steps.set(slug, s) });
        return sendJson(res, 200, result);
      } finally {
        steps.delete(slug);
      }
    }
    if (sub === 'publish-step' && parts.length === 3 && method === 'GET') return sendJson(res, 200, { step: steps.get(slug) ?? null });
    throw new HttpError(404, 'Not found.');
  }

  return http.createServer(async (req, res) => {
    try {
      if (!hosts.has(req.headers.host ?? '')) throw new HttpError(403, 'Forbidden host.');
      const mutating = !['GET', 'HEAD'].includes(req.method);
      const origin = req.headers.origin;
      if (mutating && origin !== undefined && !origins.has(origin)) throw new HttpError(403, 'Forbidden origin.');
      if (req.headers['sec-fetch-site'] && mutating && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) {
        throw new HttpError(403, 'Forbidden cross-site request.');
      }
      // parse the raw target: URL() would silently normalize `..` and `%2e%2e`
      const [rawPath, rawQuery = ''] = req.url.split('?');
      const url = { pathname: rawPath, searchParams: new URLSearchParams(rawQuery) };

      if (url.pathname.startsWith('/api/')) return await api(req, res, url);

      const entry = STATIC[url.pathname];
      if (entry && req.method === 'GET') {
        const headers = { 'Content-Type': entry[1] };
        if (url.pathname === '/') headers['Content-Security-Policy'] = csp;
        return send(res, 200, await fs.readFile(entry[0]), headers);
      }
      throw new HttpError(404, 'Not found.');
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error('[blog] error:', err.message);
      if (!res.headersSent) sendJson(res, status, { error: err.message });
    }
  });
}
