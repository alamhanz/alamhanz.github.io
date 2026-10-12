// Editor look, injected by CodeMirror (style-mod), so the app stylesheet does not need to know about it.
// Body: Inter (as on the site). Headings and UI: Poppins. Colors: theme #30475E, selection #F05454, button #121212.
import { EditorView } from '@codemirror/view';

const POPPINS = 'Poppins, "Segoe UI", system-ui, sans-serif';
const INTER = 'Inter, "Segoe UI", system-ui, sans-serif';
const MONO = 'ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace';

export const editorTheme = EditorView.theme({
  '&': { fontFamily: INTER, fontSize: '20px', color: '#30475E', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: INTER, lineHeight: '1.7', overflow: 'visible' },
  '.cm-content': { padding: '0', caretColor: '#30475E' },
  '.cm-line': { position: 'relative', padding: '0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#30475E', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(240, 84, 84, 0.25)' },
  '.cm-placeholder': { color: '#a4adb7' },

  '.cm-md-mark': { color: '#a4adb7', fontFamily: MONO, fontSize: '0.8em', fontWeight: '400', fontStyle: 'normal' },
  '.cm-h2': { fontFamily: POPPINS, fontSize: '30px', fontWeight: '700', color: '#121212', lineHeight: '1.3', paddingTop: '22px', paddingBottom: '4px' },
  '.cm-h3': { fontFamily: POPPINS, fontSize: '24px', fontWeight: '600', color: '#121212', lineHeight: '1.3', paddingTop: '16px', paddingBottom: '2px' },
  '.cm-strong': { fontWeight: '700' },
  '.cm-em': { fontStyle: 'italic' },
  '.cm-strike': { textDecoration: 'line-through' },
  '.cm-link': { color: '#30475E', textDecoration: 'underline', textDecorationColor: '#F05454', textUnderlineOffset: '3px' },
  '.cm-inline-code': { fontFamily: MONO, fontSize: '0.8em', background: '#e9edf1', borderRadius: '3px', padding: '1px 4px' },
  '.cm-quote': { borderLeft: '3px solid #30475E', paddingLeft: '18px', fontStyle: 'italic' },
  '.cm-li': { paddingLeft: '4px' },
  '.cm-bullet': { display: 'inline-block', width: '1.2em', color: '#30475E' },
  '.cm-table-line': { fontFamily: MONO, fontSize: '0.8em' },
  '.cm-code-line': { fontFamily: MONO, fontSize: '16px', lineHeight: '1.6', background: '#e9edf1', padding: '0 14px' },
  '.cm-code-line.cm-fence': { color: '#7d8a98', fontSize: '13px' },
  '.cm-hr': { textAlign: 'center' },
  '.cm-rule': { letterSpacing: '0.5em', color: '#121212', fontSize: '22px', paddingLeft: '0.5em' },
  '.cm-caption': { textAlign: 'center', fontSize: '15px', fontStyle: 'italic', color: '#6b7785', marginTop: '-10px' },

  '.cm-image': { margin: '8px 0 6px' },
  '.cm-image img': { display: 'block', maxWidth: '100%', margin: '0 auto', borderRadius: '4px' },
  '.cm-image-broken img': { display: 'none' },
  '.cm-image-broken::before': { content: '"Image could not be loaded"', display: 'block', padding: '24px', textAlign: 'center', color: '#6b7785', background: '#e9edf1', borderRadius: '4px', fontSize: '14px' },
  '.cm-image-chip': { padding: '24px', textAlign: 'center', color: '#6b7785', background: '#e9edf1', borderRadius: '4px', fontSize: '14px' },
  '.cm-image-bar': { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', opacity: '0.55', transition: 'opacity .15s' },
  '.cm-image:hover .cm-image-bar, .cm-image-bar:focus-within': { opacity: '1' },
  '.cm-image-alt': { flex: '1', font: `14px ${INTER}`, padding: '5px 8px', border: '1px solid #dfe3e8', borderRadius: '6px', background: '#fff', color: '#30475E' },
  '.cm-image-caption-btn': { font: `600 12px ${POPPINS}`, padding: '5px 10px', border: '1px solid #30475E', borderRadius: '999px', background: '#fff', color: '#30475E', cursor: 'pointer' },
  '.cm-image-alt:focus-visible, .cm-image-caption-btn:focus-visible': { outline: '3px solid #F05454', outlineOffset: '2px' },

  '.cm-plus-wrap': { position: 'absolute', left: '-54px', top: '3px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: '5', fontFamily: POPPINS, lineHeight: '1' },
  '.cm-plus': { width: '36px', height: '36px', border: '1px solid #6b7785', borderRadius: '50%', background: '#fff', color: '#6b7785', fontSize: '22px', cursor: 'pointer', padding: '0', transition: 'transform .15s' },
  '.cm-plus-open': { transform: 'rotate(45deg)', borderColor: '#30475E', color: '#30475E' },
  '.cm-plus-menu': { display: 'flex', gap: '8px' },
  '.cm-plus-item': { width: '36px', height: '36px', border: '1px solid #30475E', borderRadius: '50%', background: '#fff', color: '#30475E', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '0' },
  '.cm-plus-active': { background: '#121212', color: '#fff', borderColor: '#121212' },
  '.cm-plus:focus-visible, .cm-plus-item:focus-visible': { outline: '3px solid #F05454', outlineOffset: '2px' },

  '.cm-tooltip.cm-sel-toolbar': { background: '#121212', border: 'none', borderRadius: '8px', padding: '4px', boxShadow: '0 6px 18px rgba(0,0,0,.25)', fontFamily: POPPINS },
  '.cm-tooltip-above.cm-sel-toolbar .cm-tooltip-arrow:before': { borderTopColor: '#121212' },
  '.cm-tooltip-above.cm-sel-toolbar .cm-tooltip-arrow:after': { borderTopColor: '#121212' },
  '.cm-sel-row': { display: 'flex', alignItems: 'center', gap: '2px' },
  '.cm-sel-btn': { minWidth: '34px', height: '34px', padding: '0 8px', border: '0', borderRadius: '5px', background: 'transparent', color: '#fff', font: `600 14px ${POPPINS}`, cursor: 'pointer' },
  '.cm-sel-btn:hover': { background: '#2a2a2a' },
  '.cm-sel-btn[aria-pressed="true"]': { color: '#F05454' },
  '.cm-sel-italic': { fontStyle: 'italic', fontFamily: 'Georgia, serif' },
  '.cm-sel-code': { fontFamily: MONO, fontSize: '12px' },
  '.cm-sel-link': { fontSize: '13px' },
  '.cm-sel-btn:focus-visible': { outline: '2px solid #F05454', outlineOffset: '-2px' },
  '.cm-sel-sep': { width: '1px', height: '20px', background: '#444', margin: '0 3px' },
  '.cm-sel-linkform input': { width: '260px', height: '34px', padding: '0 10px', border: '1px solid #444', borderRadius: '5px', background: '#1d1d1d', color: '#fff', font: `14px ${INTER}` },
  '.cm-sel-linkform input[aria-invalid="true"]': { borderColor: '#F05454' },
  '.cm-sel-linkform input:focus-visible': { outline: '2px solid #F05454' },

  '&.cm-source .cm-content': { fontFamily: MONO, fontSize: '15px', lineHeight: '1.65' },
  '&.cm-source .cm-scroller': { fontFamily: MONO, lineHeight: '1.65' },
  '&.cm-source .cm-line': { padding: '0 2px' },
});
