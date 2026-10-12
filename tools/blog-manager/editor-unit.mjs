// Node unit tests for the editor core: pure Markdown transforms and live-preview decorations (no DOM, no browser).
import assert from 'node:assert/strict';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { IMAGE_LINE, imageUrl, slugFacet } from './ui/src/editor/images.js';
import { computeDecorations } from './ui/src/editor/live-preview.js';
import { applyChanges, hasLinePrefix, insertBlock, insertLink, isWrapped, normalizeUrl, toggleLinePrefix, toggleWrap } from './ui/src/editor/md-commands.js';

const apply = (text, r) => applyChanges(text, r.changes);

function stateOf(doc, cursor = 0, slug = 'my-post') {
  return EditorState.create({ doc, selection: { anchor: cursor }, extensions: [markdown({ base: markdownLanguage }), slugFacet.of(slug)] });
}

/** [{ from, to, cls, kind }] for every decoration; kind is line | mark | hide | widget. */
function decos(state) {
  const out = [];
  computeDecorations(state).between(0, state.doc.length, (from, to, v) => {
    const spec = v.spec;
    const kind = spec.widget ? 'widget' : spec.class ? (from === to ? 'line' : 'mark') : 'hide';
    out.push({ from, to, cls: spec.class ?? '', kind });
  });
  return out;
}
const lineClasses = (state, lineNo) => {
  const from = state.doc.line(lineNo).from;
  return decos(state).filter((d) => d.kind === 'line' && d.from === from).map((d) => d.cls);
};
const hidden = (state) => decos(state).filter((d) => d.kind === 'hide');

export async function editorUnit(ok) {
  await ok('md-commands: toggleWrap wraps, unwraps (outside and inside), and handles empty selections', () => {
    assert.equal(apply('a word b', toggleWrap('a word b', 2, 6, '**')), 'a **word** b');
    assert.equal(apply('a **word** b', toggleWrap('a **word** b', 4, 8, '**')), 'a word b');
    assert.equal(apply('a **word** b', toggleWrap('a **word** b', 2, 10, '**')), 'a word b');
    assert.equal(apply('a  word b', toggleWrap('a  word b', 1, 7, '*')), 'a  *word* b');
    assert.equal(apply('x', toggleWrap('x', 0, 0, '`')), '``x');
    assert.equal(apply('a `c` b', toggleWrap('a `c` b', 3, 4, '`')), 'a c b');
    assert.equal(isWrapped('a **word** b', 4, 8, '**'), true);
    assert.equal(isWrapped('a word b', 2, 6, '**'), false);
    assert.equal(isWrapped('a *word* b', 3, 7, '**'), false);
  });
  await ok('md-commands: toggleLinePrefix / hasLinePrefix', () => {
    assert.equal(apply('Title', toggleLinePrefix('Title', 0, 5, '## ')), '## Title');
    assert.equal(apply('## Title', toggleLinePrefix('## Title', 0, 8, '## ')), 'Title');
    assert.equal(apply('# Title', toggleLinePrefix('# Title', 0, 7, '### ')), '### Title');
    const two = 'one\ntwo';
    assert.equal(apply(two, toggleLinePrefix(two, 0, 7, '> ')), '> one\n> two');
    assert.equal(hasLinePrefix('> one\n> two', 0, 11, '> '), true);
    assert.equal(hasLinePrefix('> one\ntwo', 0, 9, '> '), false);
  });
  await ok('md-commands: normalizeUrl accepts safe URLs and rejects javascript:/data:', () => {
    assert.equal(normalizeUrl('https://example.com/a'), 'https://example.com/a');
    assert.equal(normalizeUrl('example.com/x'), 'https://example.com/x');
    assert.equal(normalizeUrl('/about'), '/about');
    assert.equal(normalizeUrl('#top'), '#top');
    assert.equal(normalizeUrl('mailto:a@b.co'), 'mailto:a@b.co');
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.com', 'a b.com', '', null]) assert.equal(normalizeUrl(bad), null, String(bad));
  });
  await ok('md-commands: insertLink and insertBlock', () => {
    assert.equal(apply('see docs now', insertLink('see docs now', 4, 8, 'https://e.com')), 'see [docs](https://e.com) now');
    assert.equal(apply('', insertLink('', 0, 0, 'https://e.com')), '[https://e.com](https://e.com)');
    assert.equal(apply('a [b] c', insertLink('a [b] c', 2, 5, '/x')), 'a [\\[b\\]](/x) c');
    assert.equal(apply('para\n\n', insertBlock('para\n\n', 6, '---')), 'para\n\n---\n\n');
    assert.equal(apply('para', insertBlock('para', 4, '---')), 'para\n\n---\n\n');
    assert.equal(apply('', insertBlock('', 0, '```\n\n```', 4)), '```\n\n```\n\n');
  });

  await ok('live preview: headings are classed, # marker hidden off the line and shown on it', () => {
    const doc = '# Title\n\n### Small\n\nbody';
    const off = stateOf(doc, doc.length);
    assert.deepEqual(lineClasses(off, 1), ['cm-h2']);
    assert.deepEqual(lineClasses(off, 3), ['cm-h3']);
    assert.ok(hidden(off).some((d) => d.from === 0 && d.to === 2), '"# " hidden');
    const on = stateOf(doc, 3);
    assert.ok(!hidden(on).some((d) => d.from === 0), 'marker not hidden on the active line');
    assert.ok(decos(on).some((d) => d.kind === 'mark' && d.cls === 'cm-md-mark' && d.from === 0));
    assert.ok(hidden(on).some((d) => d.from === doc.indexOf('###')), 'other headings stay hidden');
  });
  await ok('live preview: inline markers hidden off-line, visible on-line; text itself never changes', () => {
    const doc = 'plain\n\nhello **bold** and `code`';
    const off = stateOf(doc, 0);
    const bold = doc.indexOf('**bold**');
    assert.ok(decos(off).some((d) => d.cls === 'cm-strong' && d.from === bold && d.to === bold + 8));
    assert.ok(decos(off).some((d) => d.cls === 'cm-inline-code'));
    assert.ok(hidden(off).some((d) => d.from === bold && d.to === bold + 2));
    assert.ok(hidden(off).some((d) => d.from === bold + 6 && d.to === bold + 8));
    const on = stateOf(doc, bold + 3);
    assert.equal(hidden(on).length, 0);
    assert.equal(on.doc.toString(), doc);
  });
  await ok('live preview: link target hidden off-line; quote, list, fence and rule get line classes', () => {
    const doc = '[site](https://e.com)\n\n> quote\n\n- item\n\n```\ncode\n```\n\n---\n\nend';
    const s = stateOf(doc, doc.length);
    assert.ok(hidden(s).some((d) => d.from === doc.indexOf('](') && d.to === doc.indexOf(')') + 1));
    assert.ok(lineClasses(s, 3).includes('cm-quote'));
    assert.ok(lineClasses(s, 5).includes('cm-li'));
    assert.ok(decos(s).some((d) => d.kind === 'widget' && d.from === doc.indexOf('- item')), 'bullet widget');
    assert.ok(lineClasses(s, 7).some((c) => c.includes('cm-fence')));
    assert.ok(lineClasses(s, 8).includes('cm-code-line'));
    assert.ok(lineClasses(s, 11).includes('cm-hr'));
    assert.ok(decos(s).some((d) => d.kind === 'widget' && d.from === doc.indexOf('---')), 'rule widget');
  });
  await ok('live preview: local images become widgets, active line shows raw text, foreign images do not', () => {
    const img = '![alt](../../assets/blog/my-post/a.png)';
    const doc = `intro\n\n${img}\n\n![x](https://example.com/x.png)\n\n![y](../../assets/blog/other/y.png)`;
    const at = doc.indexOf(img);
    const off = stateOf(doc, 0);
    assert.ok(decos(off).some((d) => d.kind === 'widget' && d.from <= at + img.length && d.to >= at), 'image widget');
    assert.ok(!decos(off).some((d) => d.kind === 'widget' && d.from === doc.indexOf('![x]')), 'remote image not rendered as a widget');
    const on = stateOf(doc, at + 2);
    assert.ok(!decos(on).some((d) => d.kind === 'widget' && d.from <= at + img.length && d.to >= at), 'raw text on the active line');
  });
  await ok('images: IMAGE_LINE regex and imageUrl mapping', () => {
    const m = IMAGE_LINE.exec('![a \\] b](../../assets/blog/my-post/pic-1.png "cap")');
    assert.ok(m);
    assert.equal(m[1], 'a \\] b');
    assert.equal(m[3], 'my-post');
    assert.equal(m[4], 'pic-1.png');
    assert.equal(m[5], 'cap');
    for (const bad of ['![a](https://e.com/a.png)', '![a](../../assets/blog/x/../a.png)', '![a](../../assets/blog/x/a.exe)', 'text ![a](../../assets/blog/x/a.png)', '![a](../../assets/blog/X/a.png)']) {
      assert.equal(IMAGE_LINE.test(bad), false, bad);
    }
    assert.equal(imageUrl('my-post', '../../assets/blog/my-post/a.png'), '/api/posts/my-post/images/a.png');
    assert.equal(imageUrl('my-post', '../../assets/blog/other/a.png'), null);
    assert.equal(imageUrl('my-post', 'https://e.com/a.png'), null);
    assert.equal(imageUrl('my-post', '../../assets/blog/my-post/..%2fx.png'), null);
  });
}
