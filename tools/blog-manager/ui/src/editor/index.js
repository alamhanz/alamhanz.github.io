// Markdown-first editor: CodeMirror 6 holds the exact Markdown body; live-preview decorations only change how it looks.
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { imageDropPaste, insertImageFiles, isImageFile, slugFacet } from './images.js';
import { inserter, inserterActions } from './inserter.js';
import { livePreview } from './live-preview.js';
import { selectionToolbar } from './selection-toolbar.js';
import { editorTheme } from './theme.js';

export { imageUrl } from './images.js';

const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.avif,.svg,image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml';

/**
 * createEditor({ parent, doc, slug, upload, onChange, onError })
 *   upload(File) -> Promise<{ path, markdown }>   onChange() runs on user edits only
 * Returns { getValue, setValue, setSlug, setMode, focus, destroy, insertImages, view }.
 */
export function createEditor({ parent, doc = '', slug = '', upload, onChange = () => {}, onError = () => {} }) {
  const live = new Compartment();
  const slugCompartment = new Compartment();
  let mode = 'live';
  let currentSlug = slug;
  let eol = '\n';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = IMAGE_ACCEPT;
  fileInput.multiple = true;
  fileInput.hidden = true;
  fileInput.setAttribute('aria-hidden', 'true');
  fileInput.tabIndex = -1;
  fileInput.addEventListener('change', () => {
    const files = [...fileInput.files].filter(isImageFile);
    fileInput.value = '';
    if (files.length) insertImageFiles(view, files, upload, onError);
  });

  const liveExtensions = () => [livePreview, selectionToolbar, inserter, inserterActions.of({ pickImage: () => fileInput.click() })];

  const extensions = () => [
    history(),
    markdown({ base: markdownLanguage }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
    placeholder('Tell your story...'),
    editorTheme,
    EditorView.contentAttributes.of({ 'aria-label': 'Story body', spellcheck: 'true' }),
    EditorView.editorAttributes.of(() => (mode === 'source' ? { class: 'cm-source' } : {})),
    slugCompartment.of(slugFacet.of(currentSlug)),
    imageDropPaste(() => upload, () => onError),
    live.of(mode === 'live' ? liveExtensions() : []),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) onChange();
    }),
  ];

  const makeState = (text) => {
    // keep CRLF files CRLF: CodeMirror splits on any line break, so remember what to join with
    eol = /\r\n/.test(text) && !/(?<!\r)\n/.test(text) ? '\r\n' : '\n';
    return EditorState.create({ doc: text, extensions: extensions() });
  };

  const view = new EditorView({ state: makeState(doc), parent });
  parent.append(fileInput);

  return {
    view,
    getValue: () => view.state.doc.sliceString(0, undefined, eol),
    setValue(text) {
      view.setState(makeState(String(text ?? '')));
    },
    setSlug(next) {
      currentSlug = next;
      view.dispatch({ effects: slugCompartment.reconfigure(slugFacet.of(next)) });
    },
    setMode(next) {
      if (next !== 'live' && next !== 'source') return;
      mode = next;
      // the editorAttributes callback reads `mode`; the reconfigure forces CodeMirror to re-read it
      view.dispatch({ effects: live.reconfigure(mode === 'live' ? liveExtensions() : []) });
    },
    insertImages: (files) => insertImageFiles(view, [...files].filter(isImageFile), upload, onError),
    focus: () => view.focus(),
    destroy() {
      view.destroy();
      fileInput.remove();
    },
  };
}
