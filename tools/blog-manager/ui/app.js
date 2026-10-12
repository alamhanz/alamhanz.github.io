(() => {
  const $ = (id) => document.getElementById(id);
  const state = { slug: null, meta: null, tags: [], timer: null, dirty: false, loading: false, astroPort: 4321, mde: null };

  async function api(path, opts = {}) {
    const res = await fetch(`/api${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }
  const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    Object.assign(n, props);
    n.append(...kids);
    return n;
  }
  const slugify = (t) =>
    t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

  function setSave(text) {
    $('save-state').textContent = text;
  }

  /* ---------- list ---------- */
  async function loadList() {
    const posts = await api('/posts');
    const ul = $('post-list');
    ul.replaceChildren(
      ...posts.map((p) => {
        const b = el('button', { type: 'button' }, el('strong', { textContent: p.title }), el('span', { className: `badge${p.draft ? ' draft' : ''}`, textContent: p.error ? 'error' : p.draft ? 'draft' : 'published' }), el('small', { textContent: p.error ? `${p.slug} - ${p.error}` : `${p.pubDate ?? 'no date'} - ${p.slug}` }));
        if (p.slug === state.slug) b.setAttribute('aria-current', 'true');
        b.addEventListener('click', () => openPost(p.slug));
        return el('li', {}, b);
      }),
    );
  }

  /* ---------- editor ---------- */
  function renderChips() {
    const box = $('chips');
    box.querySelectorAll('.chip').forEach((c) => c.remove());
    state.tags.forEach((t, i) => {
      const rm = el('button', { type: 'button', textContent: 'x', title: `Remove tag ${t}` });
      rm.setAttribute('aria-label', `Remove tag ${t}`);
      rm.addEventListener('click', () => {
        state.tags.splice(i, 1);
        renderChips();
        scheduleSave();
      });
      box.insertBefore(el('span', { className: 'chip' }, t, rm), $('f-tag'));
    });
  }

  function renderCover() {
    const c = state.meta.cover;
    const img = $('cover-thumb');
    img.hidden = !c;
    $('cover-clear').hidden = !c;
    if (c) img.src = `/api/posts/${state.slug}/images/${c.split('/').pop()}?t=${Date.now()}`;
  }

  function collectMeta() {
    return {
      ...state.meta,
      title: $('f-title').value,
      description: $('f-desc').value,
      pubDate: $('f-date').value || undefined,
      tags: state.tags,
      coverAlt: $('f-cover-alt').value,
    };
  }

  function scheduleSave() {
    if (state.loading || !state.slug) return;
    state.dirty = true;
    setSave('Unsaved...');
    clearTimeout(state.timer);
    state.timer = setTimeout(save, 600);
  }

  async function save() {
    clearTimeout(state.timer);
    if (!state.slug || !state.dirty) return;
    const slug = state.slug;
    setSave('Saving...');
    try {
      state.dirty = false;
      await api(`/posts/${slug}`, json('PUT', { meta: collectMeta(), body: state.mde.value() }));
      if (slug === state.slug) setSave('Saved');
      loadList();
    } catch (e) {
      state.dirty = true;
      setSave(`Save failed: ${e.message}`);
    }
  }

  async function openPost(slug) {
    await save();
    state.loading = true;
    try {
      const { meta, body } = await api(`/posts/${slug}`);
      state.slug = slug;
      state.meta = { ...meta, tags: meta.tags ?? [] };
      state.tags = [...state.meta.tags];
      $('f-title').value = meta.title ?? '';
      $('f-slug').value = slug;
      $('f-desc').value = meta.description ?? '';
      $('f-date').value = meta.pubDate ?? '';
      $('f-cover-alt').value = meta.coverAlt ?? '';
      $('f-tag').value = '';
      state.mde.value(body);
      renderChips();
      renderCover();
      $('editor').hidden = false;
      $('preview').hidden = false;
      $('empty').hidden = true;
      const url = `http://127.0.0.1:${state.astroPort}/blog/${slug}`;
      $('frame').src = url;
      $('open-tab').href = url;
      $('publish-result').hidden = true;
      $('unpublish-btn').hidden = meta.draft === true;
      $('publish-btn').textContent = meta.draft ? 'Publish (open PR)' : 'Publish update (open PR)';
      setSave('Saved');
      loadList();
    } catch (e) {
      setSave(e.message);
    } finally {
      state.loading = false;
    }
  }

  /* ---------- images ---------- */
  async function upload(file) {
    const q = encodeURIComponent(file.name || 'image.png');
    return api(`/posts/${state.slug}/images?name=${q}`, { method: 'PUT', body: file });
  }

  $('cover-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f || !state.slug) return;
    try {
      const ext = (f.name.match(/\.[A-Za-z0-9]+$/) || ['.jpg'])[0];
      const r = await upload(new File([f], `cover${ext}`, { type: f.type }));
      state.meta.cover = r.path;
      renderCover();
      scheduleSave();
    } catch (e) {
      setSave(`Upload failed: ${e.message}`);
    }
  });
  $('cover-clear').addEventListener('click', () => {
    delete state.meta.cover;
    renderCover();
    scheduleSave();
  });

  /* ---------- actions ---------- */
  async function refreshStatus() {
    try {
      const s = await api('/status');
      state.astroPort = s.astroPort ?? state.astroPort;
      const msgs = [];
      if (!s.astroUp) msgs.push('Preview server (astro dev) is not reachable yet.');
      if (!s.ghOk) msgs.push('GitHub CLI not ready: publishing needs `gh` installed and `gh auth login`.');
      $('banners').replaceChildren(...msgs.map((m) => el('div', { textContent: m })));
    } catch {
      $('banners').replaceChildren(el('div', { textContent: 'Manager server unreachable.' }));
    }
  }

  $('publish-btn').addEventListener('click', async () => {
    if (!window.confirm(`Publish "${state.slug}"? This pushes branch post/${state.slug} and opens a pull request into xyz.`)) return;
    await save();
    const box = $('publish-result');
    const btn = $('publish-btn');
    btn.disabled = true;
    box.hidden = false;
    box.className = 'notice';
    box.textContent = 'Publishing...';
    const slug = state.slug;
    const poll = setInterval(async () => {
      try {
        const { step } = await api(`/posts/${slug}/publish-step`);
        if (step) box.textContent = `Publishing: ${step}...`;
      } catch {
        // ignore
      }
    }, 700);
    try {
      const r = await api(`/posts/${slug}/publish`, json('POST', {}));
      box.replaceChildren();
      if (r.noChanges) box.textContent = r.message;
      else box.append('Pull request: ', el('a', { href: r.url, target: '_blank', rel: 'noopener', textContent: r.url }), el('br'), r.hint);
      await openPost(slug);
      box.hidden = false;
    } catch (e) {
      box.className = 'notice err';
      box.textContent = `Publish failed: ${e.message}`;
    } finally {
      clearInterval(poll);
      btn.disabled = false;
    }
  });

  $('unpublish-btn').addEventListener('click', async () => {
    await save();
    try {
      await api(`/posts/${state.slug}/unpublish`, json('POST'));
      await openPost(state.slug);
    } catch (e) {
      setSave(`Unpublish failed: ${e.message}`);
    }
  });

  $('delete-btn').addEventListener('click', () => {
    $('d-slug').textContent = state.slug;
    $('d-input').value = '';
    $('d-ok').disabled = true;
    $('delete-dialog').showModal();
    $('d-input').focus();
  });
  $('d-input').addEventListener('input', () => {
    $('d-ok').disabled = $('d-input').value !== state.slug;
  });
  $('d-cancel').addEventListener('click', () => $('delete-dialog').close());
  $('delete-form').addEventListener('submit', async () => {
    if ($('d-input').value !== state.slug) return;
    const slug = state.slug;
    state.dirty = false;
    clearTimeout(state.timer);
    try {
      await api(`/posts/${slug}`, { method: 'DELETE' });
    } catch (e) {
      setSave(`Delete failed: ${e.message}`);
      return;
    }
    state.slug = null;
    $('frame').src = 'about:blank';
    $('editor').hidden = true;
    $('preview').hidden = true;
    $('empty').hidden = false;
    loadList();
  });

  /* ---------- new post ---------- */
  let slugTouched = false;
  $('new-btn').addEventListener('click', () => {
    $('new-form').reset();
    $('n-error').textContent = '';
    slugTouched = false;
    $('new-dialog').showModal();
    $('n-title').focus();
  });
  $('n-title').addEventListener('input', () => {
    if (!slugTouched) $('n-slug').value = slugify($('n-title').value);
  });
  $('n-slug').addEventListener('input', () => {
    slugTouched = true;
  });
  $('n-cancel').addEventListener('click', () => $('new-dialog').close());
  $('new-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const r = await api('/posts', json('POST', { title: $('n-title').value, slug: $('n-slug').value, description: $('n-desc').value }));
      $('new-dialog').close();
      await loadList();
      await openPost(r.slug);
    } catch (e) {
      $('n-error').textContent = e.message;
    }
  });

  /* ---------- wiring ---------- */
  for (const id of ['f-title', 'f-desc', 'f-date', 'f-cover-alt']) $(id).addEventListener('input', scheduleSave);
  $('f-tag').addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ',') return;
    ev.preventDefault();
    const t = $('f-tag').value.trim();
    if (t && !state.tags.includes(t)) state.tags.push(t);
    $('f-tag').value = '';
    renderChips();
    scheduleSave();
  });

  state.mde = new EasyMDE({
    element: $('body'),
    autoDownloadFontAwesome: false,
    spellChecker: false,
    status: false,
    forceSync: true,
    uploadImage: true,
    imageAccept: 'image/png, image/jpeg, image/webp, image/gif, image/avif, image/svg+xml',
    imageUploadFunction: async (file, onSuccess, onError) => {
      try {
        onSuccess((await upload(file)).path);
      } catch (e) {
        onError(e.message);
      }
    },
    toolbar: [
      { name: 'bold', action: EasyMDE.toggleBold, text: 'Bold', title: 'Bold' },
      { name: 'italic', action: EasyMDE.toggleItalic, text: 'Italic', title: 'Italic' },
      { name: 'heading', action: EasyMDE.toggleHeadingSmaller, text: 'Heading', title: 'Heading' },
      { name: 'quote', action: EasyMDE.toggleBlockquote, text: 'Quote', title: 'Quote' },
      { name: 'ul', action: EasyMDE.toggleUnorderedList, text: 'List', title: 'Bulleted list' },
      { name: 'code', action: EasyMDE.toggleCodeBlock, text: 'Code', title: 'Code block' },
      { name: 'link', action: EasyMDE.drawLink, text: 'Link', title: 'Link' },
      { name: 'upload-image', action: EasyMDE.drawUploadedImage, text: 'Image', title: 'Upload image (or drag/paste)' },
    ],
  });
  state.mde.codemirror.on('change', scheduleSave);
  window.addEventListener('beforeunload', (ev) => {
    if (state.dirty) ev.preventDefault();
  });

  refreshStatus();
  setInterval(refreshStatus, 5000);
  loadList().catch((e) => setSave(e.message));
})();
