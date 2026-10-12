// Stories view (#/): Drafts / Published tabs with cards.
import { api, el, imageSrc, json, menuButton, minRead, previewUrl } from './api.js';
import { confirmDelete } from './dialogs.js';

export function mountStories(view, { navigate }) {
  let posts = [];
  let tab = null;
  let notice = sessionStorage.getItem('blog-notice') ?? '';
  sessionStorage.removeItem('blog-notice');
  let filter = '';
  let alive = true;

  const root = el('div', { className: 'stories' });
  view.replaceChildren(root);

  const isDraft = (p) => p.draft === true || !!p.error;

  async function load() {
    try {
      posts = await api('/posts');
    } catch (e) {
      notice = e.message;
    }
    if (!alive) return;
    if (tab === null) tab = posts.some(isDraft) || !posts.length ? 'drafts' : 'published';
    render();
  }

  function render() {
    const drafts = posts.filter(isDraft);
    const published = posts.filter((p) => !isDraft(p));
    const needle = filter.toLowerCase();
    const shown = (tab === 'drafts' ? drafts : published).filter((p) => !needle || `${p.title} ${p.slug} ${(p.tags ?? []).join(' ')}`.toLowerCase().includes(needle));

    const tabs = el('div', { className: 'stabs' });
    tabs.setAttribute('role', 'tablist');
    for (const [id, label, n] of [['drafts', 'Drafts', drafts.length], ['published', 'Published', published.length]]) {
      const b = el('button', { type: 'button', className: `stab${tab === id ? ' on' : ''}`, textContent: `${label} (${n})` });
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(tab === id));
      b.addEventListener('click', () => {
        tab = id;
        render();
      });
      tabs.append(b);
    }
    const search = el('input', { type: 'search', className: 'filter', placeholder: 'Filter stories', value: filter });
    search.setAttribute('aria-label', 'Filter stories');
    search.addEventListener('input', () => {
      filter = search.value;
      render();
      const again = root.querySelector('.filter');
      again.focus();
      again.setSelectionRange(filter.length, filter.length);
    });
    tabs.append(el('span', { className: 'spacer' }), search);

    const list = el('div', { className: 'cards' });
    if (!shown.length) {
      list.append(el('p', { className: 'empty', textContent: filter ? 'No stories match.' : tab === 'drafts' ? 'No drafts yet. Write a story.' : 'Nothing published yet.' }));
    }
    for (const p of shown) list.append(card(p));

    const note = notice ? el('p', { className: 'notice err', textContent: notice }) : null;
    note?.setAttribute('role', 'alert');
    root.replaceChildren(el('h1', { className: 'page-title', textContent: 'Your stories' }), ...(note ? [note] : []), tabs, list);
  }

  function card(p) {
    const meta = p.error ? p.error : [p.pubDate ?? 'no date', `${minRead(p.words)} min read`, ...(p.tags ?? []).map((t) => `#${t}`)].join(' · ');
    const txt = el(
      'div',
      { className: 'txt' },
      el('h2', {}, el('a', { className: 'card-title', href: `#/edit/${p.slug}`, textContent: p.title })),
      ...(p.description ? [el('p', { textContent: p.description })] : []),
      el('small', { className: p.error ? 'err' : '', textContent: meta }),
    );
    const menu = menuButton({
      label: `Actions for ${p.title}`,
      items: () => [
        { label: 'Edit', onClick: () => navigate(`#/edit/${p.slug}`) },
        { label: 'View on preview site', onClick: () => window.open(previewUrl(p.slug), '_blank', 'noopener') },
        { label: 'Unpublish', hidden: isDraft(p), onClick: () => unpublish(p) },
        { label: 'Delete', danger: true, onClick: () => confirmDelete(p.slug, () => load()) },
      ],
    });
    const thumb = p.cover ? el('img', { className: 'thumb', alt: '', src: imageSrc(p.slug, p.cover) }) : el('div', { className: 'thumb none' });
    return el('article', { className: 'card' }, txt, thumb, menu.el);
  }

  async function unpublish(p) {
    notice = '';
    try {
      await api(`/posts/${p.slug}/unpublish`, json('POST'));
    } catch (e) {
      // the file was removed outside the manager (git pull, branch switch, manual delete)
      notice = /not found/i.test(e.message) ? `Unpublish failed: ${p.slug}.md no longer exists on disk. The list was refreshed.` : `Unpublish failed: ${e.message}`;
    }
    await load();
  }

  load();
  return {
    async canLeave() {
      return true;
    },
    destroy() {
      alive = false;
    },
  };
}
