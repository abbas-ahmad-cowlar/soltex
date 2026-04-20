// src/js/editor.js
// SolteX — CodeMirror 6 Editor Module (Phase 2: Enhanced)

import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, toggleComment } from '@codemirror/commands';
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { bracketMatching, indentOnInput, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle, foldService } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { latex } from 'codemirror-lang-latex';
import { latexCompletionSource } from './latexCompletions.js';
import { autoCompileExtension } from './autoCompile.js';
import { outlineUpdateExtension } from './outlinePanel.js';
import { themeCompartment, getInitialTheme } from './themes.js';

let editorView = null;

// ── Compartments (dynamic extension slots) ───────────────────────────────────
const lineWrapCompartment = new Compartment();
const keybindingCompartment = new Compartment();
let wordWrapEnabled = true;

// ── Custom LaTeX Fold Service ────────────────────────────────────────────────
const latexFoldService = foldService.of((state, from, to) => {
  const line = state.doc.lineAt(from);
  const text = line.text.trim();

  // Fold \begin{env}...\end{env}
  const beginMatch = text.match(/^\\begin\{([^}]+)\}/);
  if (beginMatch) {
    const envName = beginMatch[1];
    const endPattern = `\\end{${envName}}`;
    for (let i = line.number + 1; i <= state.doc.lines; i++) {
      const checkLine = state.doc.line(i);
      if (checkLine.text.trim().startsWith(endPattern)) {
        return { from: line.to, to: checkLine.from - 1 };
      }
    }
  }

  // Fold \section{}, \subsection{}, etc.
  const sectionMatch = text.match(/^\\(part|chapter|section|subsection|subsubsection|paragraph)\{/);
  if (sectionMatch) {
    const level = ['part', 'chapter', 'section', 'subsection', 'subsubsection', 'paragraph'].indexOf(sectionMatch[1]);
    const sameOrHigher = ['part', 'chapter', 'section', 'subsection', 'subsubsection', 'paragraph'].slice(0, level + 1);
    const pattern = new RegExp(`^\\\\(${sameOrHigher.join('|')})\\{`);

    for (let i = line.number + 1; i <= state.doc.lines; i++) {
      const checkLine = state.doc.line(i);
      if (pattern.test(checkLine.text.trim())) {
        return { from: line.to, to: checkLine.from - 1 };
      }
    }
    // Fold to end of document
    const lastLine = state.doc.line(state.doc.lines);
    if (lastLine.number > line.number) {
      return { from: line.to, to: lastLine.to };
    }
  }

  return null;
});

// ── \begin/\end Auto-Pairing ─────────────────────────────────────────────────
const beginEndHandler = EditorView.inputHandler.of((view, from, to, text) => {
  if (text !== '\n') return false;

  const line = view.state.doc.lineAt(from);
  const lineText = line.text;
  const match = lineText.match(/\\begin\{([^}]+)\}\s*$/);

  if (match) {
    const envName = match[1];
    const indent = lineText.match(/^(\s*)/)[1];
    const insert = `\n${indent}  \n${indent}\\end{${envName}}`;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + 1 + indent.length + 2 }, // cursor on indented blank line
    });
    return true;
  }
  return false;
});

// ── Go-to-Line ───────────────────────────────────────────────────────────────
function goToLineCommand(view) {
  showGoToLineDialog();
  return true;
}

/**
 * Initialize the CodeMirror editor and mount it to the given container.
 */
export function initEditor(container, initialContent = '') {
  container.innerHTML = '';

  const state = EditorState.create({
    doc: initialContent,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),

      // Folding with custom LaTeX fold service
      foldGutter({
        openText: '▶',
        closedText: '▼',
      }),
      latexFoldService,

      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),

      bracketMatching(),
      closeBrackets(),
      indentOnInput(),

      // LaTeX autocomplete
      autocompletion({ activateOnTyping: true, maxRenderedOptions: 20 }),
      EditorState.languageData.of(() => [{ autocomplete: latexCompletionSource }]),

      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      latex(),
      themeCompartment.of(getInitialTheme()),

      // Compartments for toggleable features
      lineWrapCompartment.of(EditorView.lineWrapping),
      keybindingCompartment.of([]),

      // Auto-compile listener
      autoCompileExtension(),

      // Outline auto-update on doc changes
      outlineUpdateExtension(),

      // Built-in search (Ctrl+F, Ctrl+H)
      search(),

      // \begin/\end auto-pairing
      beginEndHandler,

      // Keymaps
      keymap.of([
        ...closeBracketsKeymap,
        ...completionKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        indentWithTab,
        { key: 'Ctrl-/', run: toggleComment },
        { key: 'Alt-z', run: () => { toggleWordWrap(); return true; } },
        { key: 'Ctrl-g', run: goToLineCommand },
      ]),

      // Cursor position tracking
      EditorView.updateListener.of((update) => {
        if (update.selectionSet || update.docChanged) {
          const pos = update.state.selection.main.head;
          const line = update.state.doc.lineAt(pos);
          const col = pos - line.from + 1;
          const cursorEl = document.getElementById('cursor-position');
          if (cursorEl) {
            cursorEl.textContent = `Ln ${line.number}, Col ${col}`;
          }
        }
      }),

      // Editor theme
      EditorView.theme({
        '&': { height: '100%', fontSize: '14px' },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
        },
        '.cm-content': { padding: '8px 0' },
        '.cm-gutters': { backgroundColor: 'transparent', borderRight: '1px solid #3a3a5c' },
        '.cm-foldGutter .cm-gutterElement': { padding: '0 4px', cursor: 'pointer', color: '#666680' },
      }),
    ],
  });

  editorView = new EditorView({ state, parent: container });
  return editorView;
}

// ── Exported Functions ───────────────────────────────────────────────────────

export function getContent() {
  if (!editorView) return '';
  return editorView.state.doc.toString();
}

export function setContent(content) {
  if (!editorView) return;
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: content },
  });
}

export function getEditorView() {
  return editorView;
}

/** Toggle word wrap on/off */
export function toggleWordWrap() {
  if (!editorView) return;
  wordWrapEnabled = !wordWrapEnabled;
  editorView.dispatch({
    effects: lineWrapCompartment.reconfigure(
      wordWrapEnabled ? EditorView.lineWrapping : []
    ),
  });
}

/** Set keybinding mode: 'default', 'vim', or 'emacs' */
export async function setKeybindingMode(mode) {
  if (!editorView) return;
  let extension = [];

  if (mode === 'vim') {
    try {
      const { vim } = await import('@replit/codemirror-vim');
      extension = vim();
    } catch { console.warn('Vim mode not installed'); }
  } else if (mode === 'emacs') {
    try {
      const { emacs } = await import('@replit/codemirror-emacs');
      extension = emacs();
    } catch { console.warn('Emacs mode not installed'); }
  }

  editorView.dispatch({
    effects: keybindingCompartment.reconfigure(extension),
  });
}

/** Jump editor to a specific line number */
export function goToLine(lineNum) {
  if (!editorView) return;
  const maxLine = editorView.state.doc.lines;
  const targetLine = Math.max(1, Math.min(lineNum, maxLine));
  const line = editorView.state.doc.line(targetLine);

  editorView.dispatch({
    selection: { anchor: line.from },
    scrollIntoView: true,
  });
  editorView.focus();
}

// ── Go-to-Line Dialog ────────────────────────────────────────────────────────

function showGoToLineDialog() {
  // Remove existing dialog if present
  const existing = document.getElementById('goto-line-dialog');
  if (existing) { existing.remove(); return; }

  if (!editorView) return;
  const maxLine = editorView.state.doc.lines;
  const currentLine = editorView.state.doc.lineAt(editorView.state.selection.main.head).number;

  const dialog = document.createElement('div');
  dialog.id = 'goto-line-dialog';
  dialog.className = 'goto-line-dialog';
  dialog.innerHTML = `
    <label for="goto-line-input">Go to Line (1–${maxLine}):</label>
    <input id="goto-line-input" type="number" min="1" max="${maxLine}" value="${currentLine}" />
    <button id="goto-line-btn" class="btn btn-primary btn-sm">Go</button>
  `;

  document.getElementById('editor-panel').appendChild(dialog);

  const input = document.getElementById('goto-line-input');
  input.focus();
  input.select();

  const submit = () => {
    const num = parseInt(input.value, 10);
    if (!isNaN(num)) goToLine(num);
    dialog.remove();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') { dialog.remove(); editorView.focus(); }
  });

  document.getElementById('goto-line-btn').addEventListener('click', submit);
}
