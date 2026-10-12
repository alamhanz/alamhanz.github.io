// Inline images: path mapping, the block widget for `![alt](../../assets/blog/<slug>/<file>)` lines,
// and paste / drop / pick uploads. Document text is only ever put into the DOM through textContent and
// attribute setters; <img src> comes from imageUrl() (a local API path) or is not set at all.
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { Facet } from '@codemirror/state';
import { insertBlock } from './md-commands.js';

/** The post slug the editor is working on (for image URLs). */
export const slugFacet = Facet.define({ combine: (values) => values.at(-1) ?? '' });

const LOCAL_IMAGE = /^\.\.\/\.\.\/assets\/blog\/([a-z0-9-]+)\/([a-z0-9_-]+\.(?:png|jpe?g|webp|gif|avif|svg))$/;

/** A whole-line Markdown image that points at this site's local assets. Groups: alt, path, slug, file, title. */
export const IMAGE_LINE = /^!\[((?:\\.|[^\]\\])*)\]\((\.\.\/\.\.\/assets\/blog\/([a-z0-9-]+)\/([a-z0-9_-]+\.(?:png|jpe?g|webp|gif|avif|svg)))(?: "((?:\\.|[^"\\])*)")?\)$/;

/** '../../assets/blog/<slug>/f.png' -> '/api/posts/<slug>/images/f.png'; anything else (other post, URL) -> null. */
export function imageUrl(slug, mdPath) {
  const m = LOCAL_IMAGE.exec(String(mdPath ?? ''));
  if (!m || m[1] !== slug) return null;
  return `/api/posts/${m[1]}/images/${m[2]}`;
}

const escapeAlt = (s) => s.replace(/([\\[\]])/g, '\\$1');
const unescapeAlt = (s) => s.replace(/\\(.)/g, '$1');

class ImageWidget extends WidgetType {
  constructor(alt, path, url, hasCaption) {
    super();
    this.alt = alt;
    this.path = path;
    this.url = url;
    this.hasCaption = hasCaption;
  }

  eq(other) {
    return other.alt === this.alt && other.path === this.path && other.url === this.url && other.hasCaption === this.hasCaption;
  }

  toDOM(view) {
    const fig = document.createElement('figure');
    fig.className = 'cm-image';
    if (this.url) {
      const img = document.createElement('img');
      img.src = this.url;
      img.alt = this.alt;
      img.draggable = false;
      img.addEventListener('error', () => fig.classList.add('cm-image-broken'));
      fig.append(img);
    } else {
      const chip = document.createElement('div');
      chip.className = 'cm-image-chip';
      chip.textContent = `Image not shown: ${this.path}`;
      fig.append(chip);
    }
    const bar = document.createElement('div');
    bar.className = 'cm-image-bar';
    const alt = document.createElement('input');
    alt.type = 'text';
    alt.className = 'cm-image-alt';
    alt.placeholder = 'Alt text (describe the image)';
    alt.setAttribute('aria-label', 'Image alt text');
    alt.value = this.alt;
    alt.addEventListener('change', () => this.commitAlt(view, fig, alt.value));
    alt.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        alt.blur();
      }
    });
    bar.append(alt);
    if (!this.hasCaption) {
      const cap = document.createElement('button');
      cap.type = 'button';
      cap.className = 'cm-image-caption-btn';
      cap.textContent = 'Add caption';
      cap.addEventListener('click', () => this.addCaption(view, fig));
      bar.append(cap);
    }
    fig.append(bar);
    // clicking the picture puts the cursor on its line, which shows the raw Markdown
    fig.addEventListener('mousedown', (ev) => {
      if (ev.target.closest('.cm-image-bar')) return;
      ev.preventDefault();
      const pos = view.posAtDOM(fig);
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      view.focus();
    });
    return fig;
  }

  ignoreEvent() {
    return true;
  }

  lineAt(view, fig) {
    return view.state.doc.lineAt(view.posAtDOM(fig));
  }

  commitAlt(view, fig, value) {
    const line = this.lineAt(view, fig);
    const m = IMAGE_LINE.exec(line.text);
    if (!m) return;
    const next = `![${escapeAlt(value)}](${m[2]}${m[5] !== undefined ? ` "${m[5]}"` : ''})`;
    if (next !== line.text) view.dispatch({ changes: { from: line.from, to: line.to, insert: next }, userEvent: 'input.image-alt' });
  }

  addCaption(view, fig) {
    const line = this.lineAt(view, fig);
    const insert = '\n*Caption*';
    const start = line.to + 1;
    view.dispatch({
      changes: { from: line.to, insert },
      selection: { anchor: start + 1, head: start + 8 },
      scrollIntoView: true,
      userEvent: 'input.image-caption',
    });
    view.focus();
  }
}

/** Italic caption convention (Q4a): `*text*` or `_text_` on the line right below an image. */
export const CAPTION_LINE = /^(?:\*(?!\*)[^*]+\*|_(?!_)[^_]+_)$/;

/**
 * Decorations for images. Lines that are a local image and not touched by the selection become a block widget.
 * Returns the set of decorated line numbers (the caller skips other decorations there) and the ranges.
 */
export function imageDecorations(state, activeLines) {
  const slug = state.facet(slugFacet);
  const ranges = [];
  const lines = new Set();
  const captionLines = new Set();
  const doc = state.doc;
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (!line.text.startsWith('![')) continue;
    const m = IMAGE_LINE.exec(line.text);
    if (!m) continue;
    const next = n < doc.lines ? doc.line(n + 1) : null;
    const hasCaption = !!next && CAPTION_LINE.test(next.text.trim()) && next.text === next.text.trim();
    if (hasCaption) captionLines.add(n + 1);
    if (activeLines.has(n)) continue;
    lines.add(n);
    const widget = new ImageWidget(unescapeAlt(m[1]), m[2], imageUrl(slug, m[2]), hasCaption);
    ranges.push(Decoration.replace({ widget, block: true }).range(line.from, line.to));
  }
  return { ranges, lines, captionLines };
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']);
export const isImageFile = (f) => IMAGE_TYPES.has(f.type);

let placeholderId = 0;

/**
 * Upload image files and insert `![](path)` on their own lines. A placeholder line marks the spot while
 * uploading; it is replaced on success and removed on failure (onError gets the message).
 */
export async function insertImageFiles(view, files, upload, onError, pos = view.state.selection.main.head) {
  for (const file of files) {
    const token = `![Uploading ${++placeholderId}...]()`;
    const text = view.state.doc.toString();
    const block = insertBlock(text, Math.min(pos, text.length), token);
    view.dispatch({ changes: block.changes, selection: block.selection, scrollIntoView: true, userEvent: 'input.image' });
    try {
      const { markdown } = await upload(file);
      replaceToken(view, token, markdown);
    } catch (err) {
      replaceToken(view, token, '');
      onError?.(`Image upload failed: ${err.message}`);
    }
    pos = view.state.selection.main.head;
  }
}

function replaceToken(view, token, replacement) {
  const doc = view.state.doc.toString();
  const at = doc.indexOf(token);
  if (at === -1) return;
  const remove = replacement === '';
  // dropping a failed placeholder also drops one of the blank lines it was padded with
  let to = at + token.length;
  let from = at;
  if (remove && doc[to] === '\n' && doc[to + 1] === '\n') to += 1;
  else if (remove && from > 0 && doc[from - 1] === '\n') from -= 1;
  view.dispatch({ changes: { from, to, insert: replacement }, userEvent: 'input.image' });
}

/** paste / drop handlers: image files are uploaded and inserted, everything else is left to CodeMirror. */
export function imageDropPaste(getUpload, getOnError, track = (p) => p) {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const files = [...(event.clipboardData?.files ?? [])].filter(isImageFile);
      if (!files.length) return false;
      event.preventDefault();
      track(insertImageFiles(view, files, getUpload(), getOnError()));
      return true;
    },
    drop(event, view) {
      const files = [...(event.dataTransfer?.files ?? [])].filter(isImageFile);
      if (!files.length) return false;
      event.preventDefault();
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
      track(insertImageFiles(view, files, getUpload(), getOnError(), pos));
      return true;
    },
  });
}
