// Shared helpers: API calls, DOM builder, slugify, and the status the header polls.

export async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, opts);
  } catch (e) {
    throw new Error(e.name === 'TimeoutError' ? 'The request timed out.' : e.message);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

/** el('div', { className: 'x' }, child, 'text'). Props are assigned as properties (textContent, not innerHTML). */
export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...kids);
  return n;
}

export const slugify = (t) =>
  t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

/** Live status from GET /api/status (updated by main.js every 5s). */
export const status = { astroPort: 4321, astroUp: false, ghOk: false };

export const previewUrl = (slug) => `http://127.0.0.1:${status.astroPort}/blog/${slug}`;

// a stalled upload must not block save/leave/rename/publish forever (globalThis override is for the UI test)
const uploadTimeoutMs = () => globalThis.__uploadTimeoutMs ?? 60000;

export const uploadImage = (slug, file) =>
  api(`/posts/${slug}/images?name=${encodeURIComponent(file.name || 'image.png')}`, { method: 'PUT', body: file, signal: AbortSignal.timeout(uploadTimeoutMs()) });

/** Local image of a post (cover or inline) through the API, with an optional cache buster. */
export const imageSrc = (slug, mdPath, bust) => (mdPath ? `/api/posts/${slug}/images/${String(mdPath).split('/').pop()}${bust ? `?t=${bust}` : ''}` : '');

export const minRead = (words) => Math.max(1, Math.ceil((words || 0) / 230));

/** Simple popup menu: returns { button, close }. items: [{ label, onClick, danger?, hidden? }]. */
export function menuButton({ label, text = '...', items }) {
  const wrap = el('span', { className: 'menu' });
  const button = el('button', { type: 'button', className: 'btn ghost dots', textContent: text });
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  let pop = null;
  const close = () => {
    if (!pop) return;
    pop.remove();
    pop = null;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
  };
  const onOutside = (ev) => {
    if (!wrap.contains(ev.target)) close();
  };
  const onKey = (ev) => {
    if (ev.key === 'Escape') {
      close();
      button.focus();
    } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      const buttons = [...pop.querySelectorAll('button')];
      const i = buttons.indexOf(document.activeElement);
      buttons[(i + (ev.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length].focus();
      ev.preventDefault();
    }
  };
  button.addEventListener('click', () => {
    if (pop) return close();
    pop = el('div', { className: 'pop' });
    pop.setAttribute('role', 'menu');
    for (const item of items().filter((i) => !i.hidden)) {
      const b = el('button', { type: 'button', className: item.danger ? 'danger' : '', textContent: item.label });
      b.setAttribute('role', 'menuitem');
      b.addEventListener('click', () => {
        close();
        item.onClick();
      });
      pop.append(b);
    }
    wrap.append(pop);
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    pop.querySelector('button')?.focus();
  });
  wrap.append(button);
  return { el: wrap, button, close };
}
