import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const KEY_ORDER = ['title', 'description', 'pubDate', 'updatedDate', 'tags', 'cover', 'coverAlt', 'draft'];

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function getRoot() {
  return path.resolve(process.env.BLOG_ROOT || REPO_ROOT);
}
export const postsDir = (root = getRoot()) => path.join(root, 'src', 'content', 'blog');
export const assetsDir = (root = getRoot()) => path.join(root, 'src', 'assets', 'blog');

export const RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

export function assertSlug(slug) {
  if (typeof slug !== 'string' || slug.length > 80 || !SLUG_RE.test(slug) || RESERVED_RE.test(slug)) {
    throw new HttpError(400, 'Invalid slug: use lowercase letters, digits and single hyphens (max 80).');
  }
  return slug;
}

/** Resolve `rel` under `base`; throw 400 if it escapes. */
export function safeJoin(base, ...rel) {
  const b = path.resolve(base);
  const target = path.resolve(b, ...rel);
  if (target !== b && !target.startsWith(b + path.sep)) throw new HttpError(400, 'Path escapes its root.');
  return target;
}

export const postPath = (slug, root = getRoot()) => safeJoin(postsDir(root), `${assertSlug(slug)}.md`);
export const imagesPath = (slug, root = getRoot()) => safeJoin(assetsDir(root), assertSlug(slug));

const ymd = (d) => d.toISOString().slice(0, 10);
export const today = () => ymd(new Date());

function normDate(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : ymd(d);
}

export function parse(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = YAML.parse(m[1]) || {};
  return { meta, body: m[2].replace(/^\r?\n/, '') };
}

/** Normalize and serialize front matter with stable key order; dates as YYYY-MM-DD. */
export function serialize(meta, body) {
  const clean = { ...meta };
  for (const k of ['pubDate', 'updatedDate']) clean[k] = normDate(clean[k]);
  clean.tags = Array.isArray(clean.tags) ? clean.tags.map(String).filter(Boolean) : [];
  const out = {};
  for (const k of KEY_ORDER) {
    const v = clean[k];
    if (v === undefined || v === '' || v === null) continue;
    if (k === 'coverAlt' && !clean.cover) continue;
    if (k === 'draft' && v !== true) continue;
    out[k] = v;
  }
  const yaml = YAML.stringify(out, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n\n${String(body).replace(/^\s+/, '').trimEnd()}\n`;
}

function str(v, max, name) {
  if (typeof v !== 'string') throw new HttpError(400, `${name} must be a string.`);
  if (v.length > max) throw new HttpError(400, `${name} is too long.`);
  return v.trim();
}

export function validateMeta(input) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'Missing meta.');
  const meta = {
    title: str(input.title ?? '', 200, 'title'),
    description: str(input.description ?? '', 500, 'description'),
    pubDate: input.pubDate ? normDate(input.pubDate) : undefined,
    updatedDate: input.updatedDate ? normDate(input.updatedDate) : undefined,
    tags: Array.isArray(input.tags) ? input.tags.map((t) => str(String(t), 40, 'tag')).filter(Boolean).slice(0, 20) : [],
    cover: input.cover ? str(input.cover, 300, 'cover') : undefined,
    coverAlt: input.coverAlt ? str(input.coverAlt, 300, 'coverAlt') : undefined,
    draft: input.draft === true,
  };
  if (input.pubDate && !meta.pubDate) throw new HttpError(400, 'Invalid pubDate.');
  if (meta.cover && !COVER_RE.test(meta.cover)) {
    throw new HttpError(400, 'cover must point to an image (png, jpg, jpeg, webp, gif, avif, svg) in src/assets/blog/<slug>/.');
  }
  return meta;
}

// Same image types as the upload allowlist in images.mjs (sanitizeName yields [a-z0-9_-] stems).
const COVER_RE = /^\.\.\/\.\.\/assets\/blog\/([a-z0-9-]+)\/([a-z0-9_-]+\.(?:png|jpe?g|webp|gif|avif|svg))$/;

/** Throw 400 unless `cover` is a valid path inside this post's image folder and the file exists. */
export async function assertCoverFile(cover, slug, root = getRoot()) {
  const m = COVER_RE.exec(cover ?? '');
  if (!m || m[1] !== slug) throw new HttpError(400, 'cover must point to an image in src/assets/blog/<slug>/ of this post.');
  if (!(await exists(safeJoin(imagesPath(slug, root), m[2])))) throw new HttpError(400, 'cover image file does not exist.');
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function listPosts(root = getRoot()) {
  const dir = postsDir(root);
  let files = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    const slug = f.replace(/\.md$/, '');
    if (!f.endsWith('.md') || !SLUG_RE.test(slug)) continue;
    let meta;
    try {
      ({ meta } = parse(await fs.readFile(path.join(dir, f), 'utf8')));
      if (!meta || typeof meta !== 'object') meta = {};
    } catch (err) {
      out.push({ slug, title: slug, pubDate: null, draft: false, tags: [], cover: null, error: `Unreadable front matter: ${String(err.message).split('\n')[0]}` });
      continue;
    }
    out.push({
      slug,
      title: meta.title ?? slug,
      pubDate: normDate(meta.pubDate) ?? null,
      draft: meta.draft === true,
      tags: meta.tags ?? [],
      cover: meta.cover ?? null,
    });
  }
  return out.sort((a, b) => (b.pubDate ?? '9999').localeCompare(a.pubDate ?? '9999') || a.slug.localeCompare(b.slug));
}

export async function readPost(slug, root = getRoot()) {
  const p = postPath(slug, root);
  if (!(await exists(p))) throw new HttpError(404, 'Post not found.');
  const { meta, body } = parse(await fs.readFile(p, 'utf8'));
  return { meta: { ...meta, pubDate: normDate(meta.pubDate), updatedDate: normDate(meta.updatedDate) }, body };
}

export function slugify(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

export async function createPost(input, root = getRoot()) {
  const title = str(input?.title ?? '', 200, 'title');
  if (!title) throw new HttpError(400, 'Title is required.');
  const slug = assertSlug(input.slug ? input.slug : slugify(title));
  const p = postPath(slug, root);
  if (await exists(p)) throw new HttpError(409, 'A post with this slug already exists.');
  const meta = validateMeta({ ...input, title, pubDate: input.pubDate || today(), cover: undefined, coverAlt: undefined, draft: true });
  await fs.mkdir(postsDir(root), { recursive: true });
  await fs.writeFile(p, serialize(meta, ''), { flag: 'wx' });
  return { slug };
}

export async function savePost(slug, input, root = getRoot()) {
  const p = postPath(slug, root);
  if (!(await exists(p))) throw new HttpError(404, 'Post not found.');
  if (typeof input?.body !== 'string' || input.body.length > 2_000_000) throw new HttpError(400, 'Invalid body.');
  const meta = validateMeta(input.meta);
  if (meta.cover) await assertCoverFile(meta.cover, slug, root);
  // updatedDate only tracks edits to already-published posts
  meta.updatedDate = meta.draft || today() === meta.pubDate ? undefined : today();
  await fs.writeFile(p, serialize(meta, input.body));
  return { ok: true };
}

export async function setDraft(slug, draft, root = getRoot()) {
  const { meta, body } = await readPost(slug, root);
  const next = { ...meta, draft };
  if (!draft && !next.pubDate) next.pubDate = today();
  await fs.writeFile(postPath(slug, root), serialize(next, body));
  return next;
}

export async function deletePost(slug, root = getRoot()) {
  const p = postPath(slug, root);
  if (!(await exists(p))) throw new HttpError(404, 'Post not found.');
  await fs.rm(p);
  await fs.rm(imagesPath(slug, root), { recursive: true, force: true });
  return { ok: true };
}
