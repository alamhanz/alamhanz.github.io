// Blog manager UI entry (bundled by esbuild, served at /app.js): hash router, status polling, header.
import { api, el, status } from './api.js';
import { initDeleteDialog, initNewDialog } from './dialogs.js';
import { mountEditor } from './editor-page.js';
import { mountStories } from './stories.js';

const view = document.getElementById('view');
let current = null;
let routeToken = 0;

const navigate = (hash) => {
  if (location.hash === hash) route();
  else location.hash = hash;
};

async function route() {
  const token = ++routeToken;
  const previous = current;
  current = null;
  if (previous) await previous.destroy();
  if (token !== routeToken) return;
  const m = /^#\/edit\/([a-z0-9-]+)$/.exec(location.hash);
  document.body.classList.toggle('route-edit', !!m);
  document.title = m ? `${m[1]} - Blog manager` : 'Blog manager';
  current = m ? mountEditor(view, m[1], { navigate }) : mountStories(view, { navigate });
}

async function refreshStatus() {
  const banners = document.getElementById('banners');
  try {
    const s = await api('/status');
    status.astroPort = s.astroPort ?? status.astroPort;
    status.astroUp = !!s.astroUp;
    status.ghOk = !!s.ghOk;
    const msgs = [];
    if (!s.astroUp) msgs.push('Preview server (astro dev) is not reachable yet.');
    if (!s.ghOk) msgs.push('GitHub CLI not ready: publishing needs `gh` installed and `gh auth login`.');
    banners.replaceChildren(...msgs.map((m) => el('div', { textContent: m })));
  } catch {
    status.astroUp = false;
    status.ghOk = false;
    banners.replaceChildren(el('div', { textContent: 'Manager server unreachable.' }));
  }
  for (const [id, ok, label] of [['chip-astro', status.astroUp, 'Preview'], ['chip-gh', status.ghOk, 'GitHub']]) {
    const chip = document.getElementById(id);
    chip.className = `chip ${ok ? 'ok' : 'warn'}`;
    chip.textContent = `${label} ${ok ? 'ready' : 'not ready'}`;
  }
}

initNewDialog((slug) => navigate(`#/edit/${slug}`));
initDeleteDialog();
window.addEventListener('hashchange', route);
refreshStatus();
setInterval(refreshStatus, 5000);
route();
