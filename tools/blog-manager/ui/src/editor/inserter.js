// The "+" button on an empty line: Image (upload), Divider, Code block.
import { ensureSyntaxTree } from '@codemirror/language';
import { Facet, Prec, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, keymap } from '@codemirror/view';
import { insertBlock } from './md-commands.js';
import { applyResult } from './selection-toolbar.js';

/** { pickImage(): void } supplied by createEditor. */
export const inserterActions = Facet.define({ combine: (v) => v.at(-1) ?? { pickImage() {} } });

const ITEMS = [
  { id: 'image', label: 'Img', title: 'Image' },
  { id: 'divider', label: '—', title: 'Divider' },
  { id: 'code', label: '{ }', title: 'Code block' },
];

const setMenu = StateEffect.define();
const setFocus = StateEffect.define();

const menuState = StateField.define({
  create: () => ({ open: false, index: 0 }),
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setMenu)) return e.value;
    return value.open && (tr.docChanged || tr.selection) ? { open: false, index: 0 } : value;
  },
});

const focusState = StateField.define({
  create: () => false,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setFocus)) return e.value;
    return value;
  },
});

function insertAtCursor(view, id) {
  const text = view.state.doc.toString();
  const pos = view.state.selection.main.head;
  if (id === 'divider') applyResult(view, insertBlock(text, pos, '---'));
  else if (id === 'code') applyResult(view, insertBlock(text, pos, '```\n\n```', 4));
  else view.state.facet(inserterActions).pickImage();
}

function choose(view, id) {
  view.dispatch({ effects: setMenu.of({ open: false, index: 0 }) });
  insertAtCursor(view, id);
  if (id !== 'image') view.focus();
}

class PlusWidget extends WidgetType {
  constructor(open, index) {
    super();
    this.open = open;
    this.index = index;
  }

  eq(other) {
    return other.open === this.open && other.index === this.index;
  }

  toDOM(view) {
    const wrap = document.createElement('span');
    wrap.className = 'cm-plus-wrap';
    wrap.contentEditable = 'false';
    wrap.addEventListener('mousedown', (ev) => ev.preventDefault());
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = `cm-plus${this.open ? ' cm-plus-open' : ''}`;
    plus.textContent = '+';
    plus.title = 'Insert (Ctrl+Alt+Enter)';
    plus.setAttribute('aria-label', 'Insert image, divider or code block');
    plus.setAttribute('aria-expanded', String(this.open));
    plus.addEventListener('click', () => {
      view.dispatch({ effects: setMenu.of({ open: !this.open, index: 0 }) });
      view.focus();
    });
    wrap.append(plus);
    if (this.open) {
      const menu = document.createElement('span');
      menu.className = 'cm-plus-menu';
      menu.setAttribute('role', 'menu');
      ITEMS.forEach((item, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `cm-plus-item${i === this.index ? ' cm-plus-active' : ''}`;
        b.textContent = item.label;
        b.title = item.title;
        b.setAttribute('role', 'menuitem');
        b.setAttribute('aria-label', item.title);
        b.addEventListener('click', () => choose(view, item.id));
        menu.append(b);
      });
      wrap.append(menu);
    }
    return wrap;
  }

  ignoreEvent() {
    return true;
  }
}

function insideFence(state, pos) {
  const tree = ensureSyntaxTree(state, state.doc.length, 100);
  for (let n = tree?.resolveInner(pos, -1); n; n = n.parent) if (n.name === 'FencedCode') return true;
  return false;
}

const plusField = StateField.define({
  create: () => Decoration.none,
  update(value, tr) {
    const { state } = tr;
    if (!tr.docChanged && !tr.selection && !tr.effects.length) return value;
    const sel = state.selection.main;
    const line = state.doc.lineAt(sel.head);
    if (!sel.empty || line.length !== 0 || !state.field(focusState) || insideFence(state, sel.head)) return Decoration.none;
    const { open, index } = state.field(menuState);
    return Decoration.set([Decoration.widget({ widget: new PlusWidget(open, index), side: -1 }).range(line.from)]);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const menuKeys = (fn) => (view) => {
  const m = view.state.field(menuState);
  return m.open ? fn(view, m) : false;
};

export const inserter = [
  menuState,
  focusState,
  plusField,
  EditorView.focusChangeEffect.of((_state, focusing) => setFocus.of(focusing)),
  Prec.highest(
    keymap.of([
      {
        key: 'Mod-Alt-Enter',
        preventDefault: true,
        run(view) {
          const line = view.state.doc.lineAt(view.state.selection.main.head);
          if (line.length !== 0) return false;
          view.dispatch({ effects: setMenu.of({ open: !view.state.field(menuState).open, index: 0 }) });
          return true;
        },
      },
      { key: 'ArrowRight', run: menuKeys((view, m) => view.dispatch({ effects: setMenu.of({ open: true, index: (m.index + 1) % ITEMS.length }) }) || true) },
      { key: 'ArrowDown', run: menuKeys((view, m) => view.dispatch({ effects: setMenu.of({ open: true, index: (m.index + 1) % ITEMS.length }) }) || true) },
      { key: 'ArrowLeft', run: menuKeys((view, m) => view.dispatch({ effects: setMenu.of({ open: true, index: (m.index + ITEMS.length - 1) % ITEMS.length }) }) || true) },
      { key: 'ArrowUp', run: menuKeys((view, m) => view.dispatch({ effects: setMenu.of({ open: true, index: (m.index + ITEMS.length - 1) % ITEMS.length }) }) || true) },
      { key: 'Enter', run: menuKeys((view, m) => (choose(view, ITEMS[m.index].id), true)) },
      { key: 'Escape', run: menuKeys((view) => (view.dispatch({ effects: setMenu.of({ open: false, index: 0 }) }), true)) },
    ]),
  ),
];
