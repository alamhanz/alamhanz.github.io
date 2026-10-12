// Usage: node scripts/check-routes.mjs <staged-dir>
// Verifies required routes exist and every root-relative href/src in the staged
// HTML resolves to a staged object.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.argv[2];
if (!root || !existsSync(root)) {
  console.error('usage: node scripts/check-routes.mjs <staged-dir>');
  process.exit(2);
}

// Pages kept as <name>.html in staging because <name>/ is a directory (see stage-dist.sh).
const collisionsFile = join(root, '..', 'collisions.txt');
const collisions = existsSync(collisionsFile)
  ? readFileSync(collisionsFile, 'utf8').split(String.fromCharCode(10)).filter(Boolean)
  : [];
const exists = (obj) => {
  const full = join(root, obj);
  if (existsSync(full) && statSync(full).isFile()) return true;
  return collisions.includes(`${obj}.html`) && existsSync(`${full}.html`);
};

const errors = [];
const warnings = [];

const required = ['index.html', 'about', 'blog', 'cv', 'mycalendar', '404.html', 'rss.xml', 'sitemap-index.xml', 'robots.txt'];
for (const f of required) if (!exists(f)) errors.push(`missing required object: ${f}`);
if (!existsSync(join(root, 'images/hello3.jpg'))) warnings.push('missing images/hello3.jpg (og:image)');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(root);
const pages = files.filter((p) => {
  const rel = relative(root, p).split(sep).join('/');
  if (rel.endsWith('.html')) return true;
  if (/\.[a-z0-9]+$/i.test(rel)) return false;
  return true; // extensionless page
});

const attr = /\b(?:href|src)\s*=\s*"([^"]*)"/gi;
let checked = 0;
for (const page of pages) {
  const rel = relative(root, page).split(sep).join('/');
  const html = readFileSync(page, 'utf8');
  if (!/<html[\s>]/i.test(html)) continue;
  for (const [, raw] of html.matchAll(attr)) {
    if (!raw.startsWith('/') || raw.startsWith('//')) continue;
    const clean = raw.split('#')[0].split('?')[0];
    const target = clean === '/' || clean === '' ? 'index.html' : clean.slice(1);
    checked++;
    if (!exists(target)) errors.push(`${rel}: broken link ${raw}`);
  }
}

for (const w of warnings) console.warn(`warn: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}
console.log(`route check ok: ${pages.length} pages, ${checked} internal references`);
