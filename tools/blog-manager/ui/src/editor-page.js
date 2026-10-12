// Editor page (#/edit/<slug>): top bar, canvas (cover, title, subtitle, body) and the side panel (Details | Preview).
import { createEditor } from './editor/index.js';
import { api, el, imageSrc, json, menuButton, previewUrl, status, uploadImage } from './api.js';
import { chipsInput, confirmDelete } from './dialogs.js';
import { openPublishDialog } from './publish-dialog.js';

const AUTOSAVE_MS = 1000;
const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.avif,.svg,image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml';

const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function autogrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${ta.scrollHeight}px`;
}

export function mountEditor(view, slug, { navigate }) {
  let alive = true;
  let meta = null;
  let editor = null;
  let dirty = false;
  let timer = null;
  let saving = null;
  let failed = '';
  let savedAt = '';
  let flashTimer = null;
  let coverBust = '';
  let ui = null;

  const onKeydown = (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      save();
    }
  };
  const onBeforeUnload = (ev) => {
    if (dirty) ev.preventDefault();
  };
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('beforeunload', onBeforeUnload);

  /* ---------- autosave: idle -> dirty -> saving -> saved(time) | failed(retry) ---------- */
  function renderStatus() {
    if (!ui) return;
    const s = ui.saveState;
    s.replaceChildren();
    s.className = 'save-state';
    if (failed) {
      s.classList.add('err');
      const retry = el('button', { type: 'button', className: 'link', textContent: 'Retry' });
      retry.addEventListener('click', () => save());
      s.append(`Save failed: ${failed} `, retry);
    } else if (saving) s.textContent = 'Saving...';
    else if (dirty) s.textContent = 'Unsaved changes';
    else s.textContent = savedAt ? `Saved ${savedAt}` : 'Saved';
  }

  function flash(message) {
    if (!ui) return;
    clearTimeout(flashTimer);
    ui.flash.textContent = message;
    flashTimer = setTimeout(() => {
      if (ui) ui.flash.textContent = '';
    }, 7000);
  }

  function markDirty() {
    if (!meta) return;
    dirty = true;
    failed = '';
    renderStatus();
    clearTimeout(timer);
    timer = setTimeout(() => save(), AUTOSAVE_MS);
  }

  const collectMeta = () => ({ ...meta, pubDate: meta.pubDate || undefined });

  // One save at a time; the latest content wins. A failed save leaves `dirty` set, so Retry and Ctrl+S
  // write again, while an unedited post is never written (that would stamp updatedDate).
  async function save() {
    clearTimeout(timer);
    for (;;) {
      if (!meta || !editor) return;
      if (saving) await saving;
      else if (editor.pendingUploads()) await editor.uploadsDone();
      else break;
    }
    if (!dirty) return;
    dirty = false;
    failed = '';
    const payload = json('PUT', { meta: collectMeta(), body: editor.getValue() });
    saving = (async () => {
      try {
        await api(`/posts/${slug}`, payload);
        savedAt = clock();
      } catch (e) {
        dirty = true;
        failed = e.message;
      } finally {
        saving = null;
        renderStatus();
      }
    })();
    renderStatus();
    await saving;
  }

  /* ---------- meta changes from the side panel / publish dialog ---------- */
  function patchMeta(patch) {
    Object.assign(meta, patch);
    if (ui) {
      if ('description' in patch && ui.subtitle.value !== (meta.description ?? '')) {
        ui.subtitle.value = meta.description ?? '';
        autogrow(ui.subtitle);
      }
      if ('pubDate' in patch) ui.date.value = meta.pubDate ?? '';
      if ('coverAlt' in patch) ui.coverAlt.value = meta.coverAlt ?? '';
      if ('tags' in patch) ui.tags.setTags(meta.tags ?? []);
      if ('cover' in patch) renderCover();
    }
    markDirty();
  }

  /* ---------- cover ---------- */
  async function setCover(file) {
    if (!file || !/^image\//.test(file.type)) return;
    try {
      const ext = (file.name.match(/\.[A-Za-z0-9]+$/) || ['.jpg'])[0];
      const r = await uploadImage(slug, new File([file], `cover${ext}`, { type: file.type }));
      coverBust = String(Date.now());
      patchMeta({ cover: r.path });
    } catch (e) {
      flash(`Cover upload failed: ${e.message}`);
    }
  }

  function renderCover() {
    const box = ui.cover;
    box.replaceChildren();
    box.classList.toggle('has-cover', !!meta.cover);
    if (meta.cover) {
      box.append(el('img', { src: imageSrc(slug, meta.cover, coverBust), alt: meta.coverAlt ?? '' }));
      const change = el('button', { type: 'button', className: 'btn small', textContent: 'Change cover' });
      change.addEventListener('click', () => ui.coverFile.click());
      const remove = el('button', { type: 'button', className: 'btn small', textContent: 'Remove cover' });
      remove.addEventListener('click', () => {
        delete meta.cover;
        renderCover();
        markDirty();
      });
      box.append(el('span', { className: 'cover-actions' }, change, remove));
    } else {
      const add = el('button', { type: 'button', className: 'cover-add', textContent: 'Add a cover image' });
      add.addEventListener('click', () => ui.coverFile.click());
      box.append(add);
    }
  }

  /* ---------- rename (drafts only) ---------- */
  async function rename() {
    const next = ui.slugInput.value.trim();
    ui.slugError.textContent = '';
    if (!next || next === slug) return;
    ui.renameBtn.disabled = true;
    try {
      await save();
      if (failed) throw new Error(`Could not save first: ${failed}`);
      const r = await api(`/posts/${slug}/rename`, json('POST', { slug: next }));
      dirty = false;
      navigate(`#/edit/${r.slug}`);
    } catch (e) {
      ui.slugError.textContent = e.message;
      ui.renameBtn.disabled = false;
    }
  }

  /* ---------- actions ---------- */
  async function unpublish() {
    await save();
    try {
      await api(`/posts/${slug}/unpublish`, json('POST'));
      await reload();
    } catch (e) {
      if (/not found/i.test(e.message)) {
        // the file was removed outside the manager (git pull, branch switch, manual delete)
        dirty = false;
        sessionStorage.setItem('blog-notice', `Unpublish failed: ${slug}.md no longer exists on disk. The list was refreshed.`);
        navigate('#/');
      } else flash(`Unpublish failed: ${e.message}`);
    }
  }

  function publish() {
    openPublishDialog({
      slug,
      meta,
      patchMeta,
      save: () => save(),
      saveFailed: () => failed,
      onDone: () => reload(),
    });
  }

  /* ---------- build ---------- */
  async function load() {
    let data;
    try {
      data = await api(`/posts/${slug}`);
    } catch (e) {
      if (!alive) return;
      view.replaceChildren(
        el('div', { className: 'stories' }, el('a', { href: '#/', textContent: '< Stories' }), Object.assign(el('p', { className: 'notice err', textContent: `Could not open ${slug}: ${e.message}` }), { role: 'alert' })),
      );
      return;
    }
    if (!alive) return;
    meta = { ...data.meta, tags: data.meta.tags ?? [] };
    const isDraft = meta.draft === true;
    dirty = false;
    failed = '';

    /* top bar */
    const back = el('a', { className: 'btn ghost', href: '#/', textContent: '← Stories' });
    const badge = el('span', { className: `badge${isDraft ? '' : ' pub'}`, textContent: isDraft ? 'Draft' : 'Published' });
    const saveState = el('span', { className: 'save-state' });
    saveState.setAttribute('aria-live', 'polite');
    const flashEl = el('span', { className: 'flash' });
    flashEl.setAttribute('role', 'status');
    const mdToggle = el('button', { type: 'button', className: 'btn ghost', textContent: 'Markdown' });
    mdToggle.setAttribute('aria-pressed', 'false');
    mdToggle.title = 'Show the raw Markdown source';
    const publishBtn = el('button', { type: 'button', className: 'btn dark', textContent: isDraft ? 'Publish' : 'Publish update' });
    publishBtn.addEventListener('click', publish);
    const more = menuButton({
      label: 'More actions',
      items: () => [
        { label: 'Open on preview site', onClick: () => window.open(previewUrl(slug), '_blank', 'noopener') },
        { label: 'Unpublish', hidden: isDraft, onClick: unpublish },
        { label: 'Delete', danger: true, onClick: () => confirmDelete(slug, () => {
          dirty = false;
          navigate('#/');
        }) },
      ],
    });
    const topbar = el('div', { className: 'topbar' }, back, badge, saveState, flashEl, el('span', { className: 'spacer' }), mdToggle, publishBtn, more.el);

    /* canvas */
    const cover = el('div', { className: 'cover' });
    const coverFile = el('input', { type: 'file', accept: IMAGE_ACCEPT, hidden: true });
    coverFile.setAttribute('aria-label', 'Upload cover image');
    coverFile.addEventListener('change', () => {
      const f = coverFile.files[0];
      coverFile.value = '';
      setCover(f);
    });
    cover.addEventListener('dragover', (ev) => ev.preventDefault());
    cover.addEventListener('drop', (ev) => {
      ev.preventDefault();
      setCover(ev.dataTransfer.files[0]);
    });
    const title = el('textarea', { className: 'title', rows: 1, maxLength: 200, placeholder: 'Title', value: meta.title ?? '' });
    title.setAttribute('aria-label', 'Title');
    const subtitle = el('textarea', { className: 'subtitle', rows: 1, maxLength: 500, placeholder: 'Description shown on the blog list', value: meta.description ?? '' });
    subtitle.setAttribute('aria-label', 'Description');
    for (const [ta, key, next] of [[title, 'title', () => subtitle], [subtitle, 'description', () => editor]]) {
      ta.addEventListener('input', () => {
        autogrow(ta);
        meta[key] = ta.value.replace(/\r?\n/g, ' ');
        markDirty();
      });
      ta.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          next().focus();
        }
      });
      ta.addEventListener('blur', () => save());
    }
    const body = el('div', { className: 'body' });
    const canvas = el('div', { className: 'canvas' }, cover, coverFile, title, subtitle, body);

    /* side panel */
    const tabDetails = el('button', { type: 'button', className: 'seg on', textContent: 'Details' });
    const tabPreview = el('button', { type: 'button', className: 'seg', textContent: 'Preview' });
    for (const t of [tabDetails, tabPreview]) t.setAttribute('role', 'tab');

    const date = el('input', { type: 'date', value: meta.pubDate ?? '' });
    date.addEventListener('input', () => {
      meta.pubDate = date.value || undefined;
      markDirty();
    });
    const tags = chipsInput(meta.tags, (next) => {
      meta.tags = next;
      markDirty();
    });
    const coverAlt = el('input', { type: 'text', maxLength: 300, value: meta.coverAlt ?? '', placeholder: 'Describe the cover image' });
    coverAlt.addEventListener('input', () => {
      meta.coverAlt = coverAlt.value;
      markDirty();
    });
    const slugInput = el('input', { type: 'text', value: slug, maxLength: 80, readOnly: !isDraft });
    slugInput.pattern = '[a-z0-9]+(-[a-z0-9]+)*';
    slugInput.setAttribute('aria-label', 'Slug');
    const renameBtn = el('button', { type: 'button', className: 'btn small', textContent: 'Rename', hidden: !isDraft });
    renameBtn.addEventListener('click', rename);
    slugInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && isDraft) {
        ev.preventDefault();
        rename();
      }
    });
    const slugError = el('p', { className: 'error' });
    slugError.setAttribute('role', 'alert');

    const field = (label, ...kids) => el('label', { className: 'field' }, el('span', { className: 'field-label', textContent: label }), ...kids);
    const details = el(
      'div',
      { className: 'details' },
      field('Tags', tags.el),
      field('Date', date),
      field('Cover alt text', coverAlt),
      el('div', { className: 'field' }, el('span', { className: 'field-label', textContent: 'URL' }), el('div', { className: 'slug-row' }, el('span', { className: 'muted', textContent: '/blog/' }), slugInput, renameBtn), slugError, el('small', { className: 'hint', textContent: isDraft ? 'Drafts can be renamed. The slug is the file name and URL.' : 'The URL of a published post is fixed. Unpublish it to rename.' })),
    );

    const frame = el('iframe', { title: 'Post preview' });
    const previewNote = el('p', { className: 'muted' });
    const openTab = el('a', { href: previewUrl(slug), target: '_blank', rel: 'noopener', textContent: 'Open in tab' });
    const preview = el('div', { className: 'preview', hidden: true }, previewNote, frame, el('p', { className: 'muted' }, openTab));

    const showTab = (which) => {
      const isPreview = which === 'preview';
      tabDetails.classList.toggle('on', !isPreview);
      tabPreview.classList.toggle('on', isPreview);
      tabDetails.setAttribute('aria-selected', String(!isPreview));
      tabPreview.setAttribute('aria-selected', String(isPreview));
      details.hidden = isPreview;
      preview.hidden = !isPreview;
      if (isPreview) {
        previewNote.textContent = status.astroUp ? 'Live Astro render of this post.' : 'The preview server (astro dev) is not reachable yet.';
        frame.hidden = !status.astroUp;
        if (status.astroUp) frame.src = previewUrl(slug);
      }
    };
    tabDetails.addEventListener('click', () => showTab('details'));
    tabPreview.addEventListener('click', () => showTab('preview'));
    const side = el('aside', { className: 'side' }, el('div', { className: 'segs' }, tabDetails, tabPreview), details, preview);
    side.setAttribute('aria-label', 'Story details and preview');

    view.replaceChildren(el('div', { className: 'editor-page' }, topbar, el('div', { className: 'split' }, canvas, side)));
    ui = { saveState, flash: flashEl, cover, coverFile, subtitle, title, date, tags, coverAlt, slugInput, slugError, renameBtn };
    showTab('details');
    renderCover();
    renderStatus();
    autogrow(title);
    autogrow(subtitle);

    editor = createEditor({
      parent: body,
      doc: data.body,
      slug,
      upload: (file) => uploadImage(slug, file),
      onChange: markDirty,
      onError: flash,
    });
    body.addEventListener('focusout', (ev) => {
      if (!body.contains(ev.relatedTarget)) save();
    });
    mdToggle.addEventListener('click', () => {
      const on = mdToggle.getAttribute('aria-pressed') !== 'true';
      mdToggle.setAttribute('aria-pressed', String(on));
      editor.setMode(on ? 'source' : 'live');
      editor.focus();
    });
    if (!meta.title) title.focus();
  }

  async function reload() {
    if (!alive) return;
    await save();
    editor?.destroy();
    editor = null;
    ui = null;
    await load();
  }

  load();
  return {
    // flush pending edits before leaving; false means they could not be saved and the user stays here
    async canLeave() {
      await save();
      if (!dirty && !failed) return true;
      flash('Your latest changes are not saved. Retry before leaving.');
      return false;
    },
    destroy() {
      alive = false;
      clearTimeout(timer);
      clearTimeout(flashTimer);
      document.removeEventListener('keydown', onKeydown);
      window.removeEventListener('beforeunload', onBeforeUnload);
      editor?.destroy();
    },
  };
}
