// Publish dialog: confirm cover alt, description, tags and date, then open the PR (existing publish flow + step polling).
import { api, el, imageSrc, json, status } from './api.js';
import { chipsInput } from './dialogs.js';

export function openPublishDialog({ slug, meta, patchMeta, save, saveFailed, onDone }) {
  const dialog = document.getElementById('publish-dialog');
  const isDraft = meta.draft === true;
  let busy = false;
  let finished = false;

  const preview = el('div', { className: 'pub-card' });
  const renderPreview = () => {
    preview.replaceChildren(
      meta.cover ? el('img', { src: imageSrc(slug, meta.cover), alt: '' }) : el('div', { className: 'thumb none pub-thumb' }),
      el('h3', { textContent: meta.title || slug }),
      el('p', { className: 'muted', textContent: meta.description ?? '' }),
    );
  };

  const field = (label, ...kids) => el('label', { className: 'field' }, el('span', { className: 'field-label', textContent: label }), ...kids);
  const coverAlt = el('input', { type: 'text', maxLength: 300, value: meta.coverAlt ?? '', placeholder: 'Describe the cover image' });
  coverAlt.addEventListener('input', () => patchMeta({ coverAlt: coverAlt.value }));
  const desc = el('textarea', { rows: 3, maxLength: 500, value: meta.description ?? '' });
  desc.addEventListener('input', () => {
    patchMeta({ description: desc.value.replace(/\r?\n/g, ' ') });
    renderPreview();
  });
  const date = el('input', { type: 'date', value: meta.pubDate ?? '' });
  date.addEventListener('input', () => patchMeta({ pubDate: date.value || undefined }));
  const tags = chipsInput(meta.tags ?? [], (next) => patchMeta({ tags: next }));

  const error = el('p', { className: 'error' });
  error.setAttribute('role', 'alert');
  const steps = el('div', { className: 'steps' });
  steps.setAttribute('role', 'status');
  const result = el('div', { className: 'notice', hidden: true });
  result.setAttribute('role', 'status');
  const cancel = el('button', { type: 'button', className: 'btn', textContent: 'Cancel' });
  const go = el('button', { type: 'submit', className: 'btn dark', textContent: isDraft ? 'Publish now (opens PR)' : 'Publish update (opens PR)' });

  const form = el(
    'form',
    { className: 'pub-grid' },
    el('div', {}, el('h3', { textContent: 'Story preview' }), preview, ...(meta.cover ? [field('Cover alt text (required with a cover)', coverAlt)] : [])),
    el(
      'div',
      {},
      el('h2', { id: 'pub-title', textContent: `Publishing to alamhanz.xyz/blog/${slug}` }),
      field('Description', desc),
      field('Tags', tags.el),
      field('Date', date),
      el('p', { className: 'muted', textContent: `Pushes branch post/${slug} and opens a pull request into xyz. Your working tree is not touched.` }),
      error,
      steps,
      result,
      el('div', { className: 'actions' }, cancel, go),
    ),
  );
  renderPreview();
  dialog.replaceChildren(form);

  const finish = () => {
    dialog.close();
    if (finished) onDone();
  };
  cancel.addEventListener('click', () => {
    if (!busy) finish();
  });
  dialog.oncancel = (ev) => {
    if (busy) ev.preventDefault();
  };
  dialog.addEventListener('close', () => dialog.replaceChildren(), { once: true });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (finished) return finish();
    error.textContent = '';
    if (meta.cover && !(meta.coverAlt ?? '').trim()) {
      error.textContent = 'Add alt text for the cover image.';
      coverAlt.setAttribute('aria-invalid', 'true');
      coverAlt.focus();
      return;
    }
    if (!status.ghOk) {
      error.textContent = 'GitHub CLI is not ready: publishing needs `gh` installed and `gh auth login`.';
      return;
    }
    busy = true;
    go.disabled = true;
    cancel.disabled = true;
    steps.textContent = 'Saving...';
    await save();
    if (saveFailed()) {
      error.textContent = `Could not save before publishing: ${saveFailed()}`;
      busy = false;
      go.disabled = false;
      cancel.disabled = false;
      steps.textContent = '';
      return;
    }
    steps.textContent = 'Publishing...';
    const poll = setInterval(async () => {
      try {
        const { step } = await api(`/posts/${slug}/publish-step`);
        if (step) steps.textContent = `Publishing: ${step}...`;
      } catch {
        // ignore, the publish call reports the outcome
      }
    }, 700);
    try {
      const r = await api(`/posts/${slug}/publish`, json('POST', {}));
      steps.textContent = '';
      result.hidden = false;
      result.className = 'notice';
      if (r.noChanges) result.textContent = r.message;
      else result.append('Pull request: ', el('a', { href: r.url, target: '_blank', rel: 'noopener', textContent: r.url }), el('br'), r.hint ?? '');
      finished = true;
      go.textContent = 'Done';
      cancel.hidden = true;
    } catch (e) {
      steps.textContent = '';
      error.textContent = `Publish failed: ${e.message}`;
    } finally {
      clearInterval(poll);
      busy = false;
      go.disabled = false;
      cancel.disabled = false;
    }
  });

  dialog.showModal();
  (meta.cover ? coverAlt : desc).focus();
}
