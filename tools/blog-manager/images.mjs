import fs from 'node:fs/promises';
import path from 'node:path';
import { HttpError, RESERVED_RE, assertSlug, imagesPath, safeJoin, postPath, getRoot } from './posts.mjs';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg']);
export const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

/** Basename only, lowercase, [a-z0-9._-]; throws on disallowed extension. */
export function sanitizeName(name) {
  const base = String(name ?? '').split(/[\\/]/).pop().toLowerCase();
  const ext = path.extname(base);
  if (!EXTS.has(ext)) throw new HttpError(400, 'Unsupported image type (png, jpg, jpeg, webp, gif, avif, svg).');
  const stem = base
    .slice(0, -ext.length)
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${!stem || RESERVED_RE.test(stem) ? `img-${stem}` : stem}${ext}`;
}

export async function saveImage(slug, name, buf, root = getRoot()) {
  assertSlug(slug);
  try {
    await fs.access(postPath(slug, root));
  } catch {
    throw new HttpError(404, 'Post not found.');
  }
  if (!buf.length) throw new HttpError(400, 'Empty upload.');
  if (buf.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'Image exceeds 10 MB.');
  const wanted = sanitizeName(name);
  const dir = imagesPath(slug, root);
  await fs.mkdir(dir, { recursive: true });
  // never overwrite: image.png -> image-2.png -> image-3.png ...
  const ext = path.extname(wanted);
  const stem = wanted.slice(0, -ext.length);
  let file = wanted;
  for (let n = 2; ; n++) {
    try {
      await fs.writeFile(safeJoin(dir, file), buf, { flag: 'wx' });
      break;
    } catch (err) {
      if (err.code !== 'EEXIST' || n > 500) throw err;
      file = `${stem}-${n}${ext}`;
    }
  }
  const rel = `../../assets/blog/${slug}/${file}`;
  return { path: rel, markdown: `![](${rel})` };
}

export async function readImage(slug, file, root = getRoot()) {
  if (sanitizeName(file) !== file) throw new HttpError(400, 'Invalid file name.');
  const p = safeJoin(imagesPath(slug, root), file);
  try {
    return { data: await fs.readFile(p), type: MIME[path.extname(file)] };
  } catch {
    throw new HttpError(404, 'Image not found.');
  }
}

export async function listImages(slug, root = getRoot()) {
  try {
    return (await fs.readdir(imagesPath(slug, root))).filter((f) => EXTS.has(path.extname(f)));
  } catch {
    return [];
  }
}
