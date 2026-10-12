// Live preview: the document stays plain Markdown, decorations only change how it looks.
// Markers (#, **, `, [](), >) are hidden on every line the selection does not touch.
import { ensureSyntaxTree } from '@codemirror/language';
import { StateField } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { imageDecorations } from './images.js';

class TextWidget extends WidgetType {
  constructor(className, text) {
    super();
    this.className = className;
    this.text = text;
  }

  eq(other) {
    return other.className === this.className && other.text === this.text;
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = this.className;
    span.textContent = this.text;
    return span;
  }
}

const HIDE = Decoration.replace({});
const SHOW_MARK = Decoration.mark({ class: 'cm-md-mark' });
const BULLET = Decoration.replace({ widget: new TextWidget('cm-bullet', '•') });
const RULE = Decoration.replace({ widget: new TextWidget('cm-rule', '· · ·') });

const lineDeco = (cls) => Decoration.line({ class: cls });
const markDeco = (cls) => Decoration.mark({ class: cls });

const HEADING = { 1: 'cm-h2', 2: 'cm-h2', 3: 'cm-h3', 4: 'cm-h3', 5: 'cm-h3', 6: 'cm-h3' };
const INLINE = { StrongEmphasis: 'cm-strong', Emphasis: 'cm-em', InlineCode: 'cm-inline-code', Strikethrough: 'cm-strike', Link: 'cm-link' };
const MARKS = new Set(['EmphasisMark', 'StrikethroughMark', 'CodeMark']);

/** Line numbers touched by any selection range. */
export function activeLineNumbers(state) {
  const out = new Set();
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number;
    const b = state.doc.lineAt(r.to).number;
    for (let n = a; n <= b; n++) out.add(n);
  }
  return out;
}

/**
 * All live-preview decorations for the document, as a DecorationSet. Pure: depends only on the state
 * (text, selection, markdown syntax tree, slug facet), so it can be tested without a DOM.
 */
export function computeDecorations(state) {
  const { doc } = state;
  const active = activeLineNumbers(state);
  const images = imageDecorations(state, active);
  const ranges = [...images.ranges];
  const skip = (n) => images.lines.has(n);
  const lineOf = (pos) => doc.lineAt(pos).number;
  const addLine = (n, cls) => {
    if (!skip(n)) ranges.push(lineDeco(cls).range(doc.line(n).from));
  };
  const hideOrShow = (from, to) => {
    const n = lineOf(from);
    if (skip(n) || from >= to) return;
    ranges.push((active.has(n) ? SHOW_MARK : HIDE).range(from, to));
  };

  for (const n of images.captionLines) addLine(n, 'cm-caption');

  const tree = ensureSyntaxTree(state, doc.length, 200);
  tree?.iterate({
    enter(node) {
      const { name, from, to } = node;
      let m;
      if ((m = /^ATXHeading([1-6])$/.exec(name))) {
        addLine(lineOf(from), HEADING[m[1]]);
        return;
      }
      if ((m = /^SetextHeading([12])$/.exec(name))) {
        addLine(lineOf(from), HEADING[m[1]]);
        return;
      }
      if (name === 'HeaderMark') {
        const n = lineOf(from);
        // the space after the opening #'s goes with the marker
        const end = from === doc.line(n).from && doc.sliceString(to, to + 1) === ' ' ? to + 1 : to;
        hideOrShow(from, end);
        return;
      }
      if (INLINE[name]) {
        if (!skip(lineOf(from))) ranges.push(markDeco(INLINE[name]).range(from, to));
        if (name === 'Link') {
          const marks = [];
          for (let c = node.node.firstChild; c; c = c.nextSibling) if (c.name === 'LinkMark') marks.push(c);
          if (marks.length >= 3) {
            hideOrShow(marks[0].from, marks[0].to);
            hideOrShow(marks[1].from, to);
          }
        }
        return;
      }
      if (MARKS.has(name)) {
        // fenced-code fences keep their line (shown muted); only inline code ticks are hidden
        if (name === 'CodeMark' && node.node.parent?.name === 'FencedCode') return;
        hideOrShow(from, to);
        return;
      }
      if (name === 'Blockquote') {
        for (let n = lineOf(from); n <= lineOf(to); n++) addLine(n, 'cm-quote');
        return;
      }
      if (name === 'QuoteMark') {
        hideOrShow(from, doc.sliceString(to, to + 1) === ' ' ? to + 1 : to);
        return;
      }
      if (name === 'FencedCode') {
        const a = lineOf(from);
        const b = lineOf(to);
        for (let n = a; n <= b; n++) addLine(n, n === a || n === b ? 'cm-code-line cm-fence' : 'cm-code-line');
        return;
      }
      if (name === 'HorizontalRule') {
        const n = lineOf(from);
        if (skip(n)) return;
        if (active.has(n)) ranges.push(SHOW_MARK.range(from, to));
        else ranges.push(RULE.range(from, to));
        addLine(n, 'cm-hr');
        return;
      }
      if (name === 'ListItem') {
        for (let n = lineOf(from); n <= lineOf(to); n++) addLine(n, 'cm-li');
        return;
      }
      if (name === 'ListMark') {
        const n = lineOf(from);
        const text = doc.sliceString(from, to);
        if (skip(n)) return;
        if (!active.has(n) && /^[-*+]$/.test(text) && node.node.parent?.parent?.name === 'BulletList') ranges.push(BULLET.range(from, to));
        else ranges.push(SHOW_MARK.range(from, to));
        return;
      }
      if (name === 'Table') {
        for (let n = lineOf(from); n <= lineOf(to); n++) addLine(n, 'cm-table-line');
      }
    },
  });
  return Decoration.set(ranges, true);
}

export const livePreview = StateField.define({
  create: (state) => computeDecorations(state),
  update(value, tr) {
    if (tr.docChanged || tr.selection || tr.reconfigured) return computeDecorations(tr.state);
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});
