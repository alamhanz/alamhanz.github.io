// Floating toolbar above a non-empty selection: Bold, Italic, Link, H2, H3, Quote, Code.
import { EditorSelection, StateEffect, StateField } from '@codemirror/state';
import { EditorView, keymap, showTooltip } from '@codemirror/view';
import { hasLinePrefix, insertLink, isWrapped, normalizeUrl, toggleLinePrefix, toggleWrap } from './md-commands.js';

const setOpen = StateEffect.define();
export const openLinkInput = StateEffect.define();

/** Dispatch a pure md-commands result: edits against the current doc, selection in the new doc. */
export function applyResult(view, result) {
  const spec = { changes: result.changes, scrollIntoView: true, userEvent: 'input.format' };
  if (result.selection) spec.selection = EditorSelection.range(result.selection.anchor, result.selection.head ?? result.selection.anchor);
  view.dispatch(spec);
}

const wrapCommand = (marker) => (view) => {
  const { from, to } = view.state.selection.main;
  applyResult(view, toggleWrap(view.state.doc.toString(), from, to, marker));
  return true;
};
const prefixCommand = (prefix) => (view) => {
  const { from, to } = view.state.selection.main;
  applyResult(view, toggleLinePrefix(view.state.doc.toString(), from, to, prefix));
  return true;
};

export const formatCommands = {
  bold: wrapCommand('**'),
  italic: wrapCommand('*'),
  code: wrapCommand('`'),
  h2: prefixCommand('## '),
  h3: prefixCommand('### '),
  quote: prefixCommand('> '),
};

/** Whether the toolbar is allowed to show (hidden by Esc or when the editor loses focus). */
const toolbarOpen = StateField.define({
  create: () => true,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setOpen)) return e.value;
    return tr.selection ? true : value;
  },
});

const BUTTONS = [
  { id: 'bold', label: 'B', title: 'Bold (Ctrl+B)', pressed: (t, a, b) => isWrapped(t, a, b, '**') },
  { id: 'italic', label: 'I', title: 'Italic (Ctrl+I)', pressed: (t, a, b) => isWrapped(t, a, b, '*') },
  { id: 'link', label: 'Link', title: 'Link (Ctrl+K)' },
  { sep: true },
  { id: 'h2', label: 'H2', title: 'Heading (Ctrl+Alt+2)', pressed: (t, a, b) => hasLinePrefix(t, a, b, '## ') },
  { id: 'h3', label: 'H3', title: 'Subheading (Ctrl+Alt+3)', pressed: (t, a, b) => hasLinePrefix(t, a, b, '### ') },
  { id: 'quote', label: '“', title: 'Quote (Ctrl+Shift+9)', pressed: (t, a, b) => hasLinePrefix(t, a, b, '> ') },
  { id: 'code', label: '</>', title: 'Inline code (Ctrl+E)', pressed: (t, a, b) => isWrapped(t, a, b, '`') },
];

function createToolbar(view) {
  const dom = document.createElement('div');
  dom.className = 'cm-sel-toolbar';
  dom.setAttribute('role', 'toolbar');
  dom.setAttribute('aria-label', 'Text formatting');
  // keep the editor focus and selection while pressing buttons
  dom.addEventListener('mousedown', (ev) => {
    if (ev.target.tagName !== 'INPUT') ev.preventDefault();
  });

  const row = document.createElement('div');
  row.className = 'cm-sel-row';
  const buttons = new Map();
  for (const def of BUTTONS) {
    if (def.sep) {
      const sep = document.createElement('span');
      sep.className = 'cm-sel-sep';
      row.append(sep);
      continue;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `cm-sel-btn cm-sel-${def.id}`;
    b.textContent = def.label;
    b.title = def.title;
    b.setAttribute('aria-label', def.title.replace(/ \(.*\)$/, ''));
    b.addEventListener('click', () => (def.id === 'link' ? showLink() : formatCommands[def.id](view)));
    buttons.set(def.id, { b, def });
    row.append(b);
  }

  const form = document.createElement('form');
  form.className = 'cm-sel-linkform';
  form.hidden = true;
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Paste a link and press Enter';
  input.setAttribute('aria-label', 'Link URL');
  form.append(input);
  dom.append(row, form);

  function showLink() {
    row.hidden = true;
    form.hidden = false;
    input.value = '';
    input.removeAttribute('aria-invalid');
    input.focus();
  }
  function hideLink() {
    form.hidden = true;
    row.hidden = false;
  }
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const url = normalizeUrl(input.value);
    if (!url) {
      input.setAttribute('aria-invalid', 'true');
      input.title = 'Use an http(s) or mailto: link, a /path or #anchor';
      return;
    }
    const { from, to } = view.state.selection.main;
    applyResult(view, insertLink(view.state.doc.toString(), from, to, url));
    hideLink();
    view.focus();
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    ev.preventDefault();
    ev.stopPropagation();
    hideLink();
    view.focus();
  });

  const refresh = (state) => {
    const { from, to } = state.selection.main;
    const text = state.doc.toString();
    for (const { b, def } of buttons.values()) b.setAttribute('aria-pressed', def.pressed ? String(def.pressed(text, from, to)) : 'false');
  };
  refresh(view.state);

  return {
    dom,
    update(update) {
      if (update.docChanged || update.selectionSet) {
        if (!form.hidden && update.selectionSet && !update.docChanged) hideLink();
        refresh(update.state);
      }
      if (update.transactions.some((tr) => tr.effects.some((e) => e.is(openLinkInput))) && form.hidden) showLink();
    },
  };
}

function toolbarTooltip(state) {
  const sel = state.selection.main;
  if (sel.empty || !state.field(toolbarOpen)) return null;
  return { pos: sel.from, above: true, strictSide: true, arrow: true, create: createToolbar };
}

const toolbarField = StateField.define({
  create: toolbarTooltip,
  update(value, tr) {
    return tr.docChanged || tr.selection || tr.effects.length ? toolbarTooltip(tr.state) : value;
  },
  provide: (f) => showTooltip.from(f),
});

/** Toolbar state, tooltip, blur/focus handling and the formatting shortcuts. */
export const selectionToolbar = [
  toolbarOpen,
  toolbarField,
  EditorView.domEventHandlers({
    blur(event, view) {
      if (event.relatedTarget && view.dom.contains(event.relatedTarget)) return;
      view.dispatch({ effects: setOpen.of(false) });
    },
    focus(event, view) {
      if (!view.state.field(toolbarOpen)) view.dispatch({ effects: setOpen.of(true) });
    },
  }),
  keymap.of([
    { key: 'Mod-b', run: formatCommands.bold, preventDefault: true },
    { key: 'Mod-i', run: formatCommands.italic, preventDefault: true },
    { key: 'Mod-e', run: formatCommands.code, preventDefault: true },
    { key: 'Mod-Alt-2', run: formatCommands.h2, preventDefault: true },
    { key: 'Mod-Alt-3', run: formatCommands.h3, preventDefault: true },
    { key: 'Mod-Shift-9', run: formatCommands.quote, preventDefault: true },
    {
      key: 'Mod-k',
      preventDefault: true,
      run(view) {
        if (view.state.selection.main.empty) return true;
        // two steps: the toolbar must exist before it can receive the "open the link input" effect
        view.dispatch({ effects: setOpen.of(true) });
        view.dispatch({ effects: openLinkInput.of(null) });
        return true;
      },
    },
    {
      key: 'Escape',
      run(view) {
        if (view.state.selection.main.empty || !view.state.field(toolbarOpen)) return false;
        view.dispatch({ effects: setOpen.of(false) });
        return true;
      },
    },
  ]),
];
