// New-post and delete dialogs (markup lives in index.html), plus the tag chips input.
import { api, el, json, slugify } from './api.js';

const $ = (id) => document.getElementById(id);

/** "Write a story": create a draft, then onCreated(slug). The slug follows the title until it is typed by hand. */
export function initNewDialog(onCreated) {
  let slugTouched = false;
  $('new-btn').addEventListener('click', openNewDialog);
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
      onCreated(r.slug);
    } catch (e) {
      $('n-error').textContent = e.message;
    }
  });

  function openNewDialog() {
    $('new-form').reset();
    $('n-error').textContent = '';
    slugTouched = false;
    $('new-dialog').showModal();
    $('n-title').focus();
  }
  return openNewDialog;
}

let deleteSlug = null;
let deleteDone = null;

export function initDeleteDialog() {
  $('d-input').addEventListener('input', () => {
    $('d-ok').disabled = $('d-input').value !== deleteSlug;
  });
  $('d-cancel').addEventListener('click', () => $('delete-dialog').close());
  $('delete-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if ($('d-input').value !== deleteSlug) return;
    try {
      await api(`/posts/${deleteSlug}`, { method: 'DELETE' });
    } catch (e) {
      $('d-error').textContent = `Delete failed: ${e.message}`;
      return;
    }
    $('delete-dialog').close();
    deleteDone?.(deleteSlug);
  });
}

/** Type-the-slug confirmation, then DELETE; onDone(slug) after the file is gone. */
export function confirmDelete(slug, onDone) {
  deleteSlug = slug;
  deleteDone = onDone;
  $('d-slug').textContent = slug;
  $('d-input').value = '';
  $('d-error').textContent = '';
  $('d-ok').disabled = true;
  $('delete-dialog').showModal();
  $('d-input').focus();
}

/** Tag chips + input. Returns { el, setTags }. onChange(tags) after every add/remove. */
export function chipsInput(initial, onChange) {
  let tags = [...initial];
  const box = el('div', { className: 'chips' });
  const input = el('input', { type: 'text', maxLength: 40, placeholder: 'Add a tag, press Enter' });
  input.setAttribute('aria-label', 'Add tag');
  const render = () => {
    box.replaceChildren(
      ...tags.map((t, i) => {
        const rm = el('button', { type: 'button', textContent: 'x', title: `Remove tag ${t}` });
        rm.setAttribute('aria-label', `Remove tag ${t}`);
        rm.addEventListener('click', () => {
          tags.splice(i, 1);
          render();
          onChange([...tags]);
        });
        return el('span', { className: 'tag-chip' }, t, rm);
      }),
      input,
    );
  };
  const add = () => {
    const t = input.value.trim().replace(/,$/, '').trim();
    input.value = '';
    if (t && !tags.includes(t)) {
      tags.push(t);
      render();
      onChange([...tags]);
      return true;
    }
    return false;
  };
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ',') {
      ev.preventDefault();
      if (add()) input.focus();
    } else if (ev.key === 'Backspace' && !input.value && tags.length) {
      tags.pop();
      render();
      onChange([...tags]);
      input.focus();
    }
  });
  input.addEventListener('blur', add);
  render();
  return {
    el: box,
    setTags(next) {
      tags = [...next];
      render();
    },
  };
}
