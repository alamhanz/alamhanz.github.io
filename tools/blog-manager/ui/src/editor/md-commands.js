// Pure Markdown text transforms (no DOM, no CodeMirror): (text, from, to, ...) -> { changes, selection? }.
// `changes` are sorted, non-overlapping edits against the ORIGINAL text; `selection` is in the NEW text.

const isSpace = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';

/** Number of consecutive `*` going from index `i` in direction `dir` (1 forward, -1 backward), at most `max`. */
function starRun(text, i, dir, max = Infinity) {
  let n = 0;
  while (n < max && text[i + dir * n] === '*') n++;
  return n;
}

/** Shrink [from, to] so it does not start or end on whitespace (unchanged when it is all whitespace). */
function trimRange(text, from, to) {
  let a = from;
  let b = to;
  while (a < b && isSpace(text[a])) a++;
  while (b > a && isSpace(text[b - 1])) b--;
  return a === b ? [from, to] : [a, b];
}

function starsMatch(marker, n) {
  return marker === '**' ? n >= 2 : n === 1 || n === 3;
}

/** True when [from, to] is wrapped by `marker` just outside it (`**word**` with `word` selected). */
export function isWrappedOutside(text, from, to, marker) {
  const m = marker.length;
  if (from - m < 0 || to + m > text.length) return false;
  if (marker === '*' || marker === '**') {
    return starsMatch(marker, Math.min(starRun(text, from - 1, -1), starRun(text, to, 1)));
  }
  return text.slice(from - m, from) === marker && text.slice(to, to + m) === marker;
}

/** True when the selection itself starts and ends with `marker` (`**word**` selected, markers included). */
export function isWrappedInside(text, from, to, marker) {
  const m = marker.length;
  if (to - from < 2 * m) return false;
  if (marker === '*' || marker === '**') {
    const cap = Math.floor((to - from) / 2);
    return starsMatch(marker, Math.min(starRun(text, from, 1, cap), starRun(text, to - 1, -1, cap)));
  }
  return text.slice(from, from + m) === marker && text.slice(to - m, to) === marker;
}

/** Is `marker` formatting active for this selection? (toolbar pressed state) */
export function isWrapped(text, from, to, marker) {
  const [a, b] = trimRange(text, from, to);
  return isWrappedOutside(text, a, b, marker) || isWrappedInside(text, a, b, marker);
}

/** Wrap the selection in `marker`, or remove it when already wrapped. An empty selection inserts a pair. */
export function toggleWrap(text, from, to, marker) {
  const m = marker.length;
  if (from === to) {
    return { changes: [{ from, to, insert: marker + marker }], selection: { anchor: from + m, head: from + m } };
  }
  const [a, b] = trimRange(text, from, to);
  if (isWrappedOutside(text, a, b, marker)) {
    return { changes: [{ from: a - m, to: a, insert: '' }, { from: b, to: b + m, insert: '' }], selection: { anchor: a - m, head: b - m } };
  }
  if (isWrappedInside(text, a, b, marker)) {
    return { changes: [{ from: a, to: a + m, insert: '' }, { from: b - m, to: b, insert: '' }], selection: { anchor: a, head: b - 2 * m } };
  }
  return { changes: [{ from: a, to: a, insert: marker }, { from: b, to: b, insert: marker }], selection: { anchor: a + m, head: b + m } };
}

/** Start and end offsets of every line touched by [from, to]. */
function lineSpans(text, from, to) {
  const spans = [];
  let start = text.lastIndexOf('\n', from - 1) + 1;
  for (;;) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = text.length;
    spans.push([start, end]);
    if (end >= to || end >= text.length) break;
    start = end + 1;
  }
  return spans;
}

const HEADING_PREFIX = /^#{1,6}[ \t]+/;

/**
 * Toggle a line prefix (`## `, `### `, `> `) on every line touched by the selection. When all lines already
 * have exactly this prefix it is removed. Headings replace any other heading level; a quote prefix is added in front.
 */
export function toggleLinePrefix(text, from, to, prefix) {
  const isHeading = prefix.startsWith('#');
  const spans = lineSpans(text, from, to);
  const lines = spans.map(([s, e]) => text.slice(s, e));
  const allHave = lines.every((l) => l.startsWith(prefix));
  const changes = [];
  spans.forEach(([s], i) => {
    const line = lines[i];
    if (allHave) {
      changes.push({ from: s, to: s + prefix.length, insert: '' });
    } else if (isHeading) {
      const old = HEADING_PREFIX.exec(line)?.[0] ?? '';
      if (old !== prefix) changes.push({ from: s, to: s + old.length, insert: prefix });
    } else if (!line.startsWith(prefix)) {
      changes.push({ from: s, to: s, insert: prefix });
    }
  });
  return { changes };
}

/** Is every line touched by the selection prefixed with `prefix`? (toolbar pressed state) */
export function hasLinePrefix(text, from, to, prefix) {
  return lineSpans(text, from, to).every(([s, e]) => text.slice(s, e).startsWith(prefix));
}

/** Accepts http(s), mailto, site-relative and #fragment URLs, plus bare domains (-> https). Returns null when unsafe. */
export function normalizeUrl(input) {
  const url = String(input ?? '').trim();
  if (!url || /\s/.test(url)) return null;
  if (/^(https?:\/\/[^\s/]+|mailto:[^\s@]+@[^\s@]+)/i.test(url)) return url;
  if (/^(\/(?!\/)|#)/.test(url)) return url;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(url)) return `https://${url}`;
  return null;
}

/** Turn the selection into `[text](url)`. An empty selection inserts `[url](url)`. */
export function insertLink(text, from, to, url) {
  const label = from === to ? url : text.slice(from, to);
  const safeLabel = label.replace(/([\\[\]])/g, '\\$1');
  const insert = `[${safeLabel}](${url})`;
  return { changes: [{ from, to, insert }], selection: { anchor: from + insert.length, head: from + insert.length } };
}

/**
 * Insert `block` as its own paragraph at `pos`: blank lines are added around it only when missing. When the line
 * at `pos` is empty the block replaces it, otherwise it goes after that line. The cursor lands on the blank line
 * after the block, or `cursorOffset` characters into the block when given.
 */
export function insertBlock(text, pos, block, cursorOffset) {
  const ls = text.lastIndexOf('\n', pos - 1) + 1;
  let le = text.indexOf('\n', pos);
  if (le === -1) le = text.length;
  const emptyLine = text.slice(ls, le).trim() === '';
  const at = emptyLine ? ls : le;
  const before = text.slice(0, at);
  const after = text.slice(le);
  let lead = '';
  if (before !== '') lead = before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const tail = after === '' || after === '\n' ? '\n\n' : after.startsWith('\n\n') ? '' : '\n';
  const insert = lead + block + tail;
  const cursor = cursorOffset !== undefined ? at + lead.length + cursorOffset : at + insert.length + (tail === '' ? 1 : 0);
  return { changes: [{ from: at, to: le, insert }], selection: { anchor: cursor, head: cursor } };
}

/** Apply `changes` to `text` (test helper and a reference for the semantics above). */
export function applyChanges(text, changes) {
  let out = '';
  let last = 0;
  for (const c of [...changes].sort((x, y) => x.from - y.from)) {
    out += text.slice(last, c.from) + c.insert;
    last = c.to;
  }
  return out + text.slice(last);
}
