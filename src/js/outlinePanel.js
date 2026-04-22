// src/js/outlinePanel.js
// SolteX -- Document Outline Navigator (Phase 5, Feature 5.4)

import { getEditorView } from './editor.js';
import { EditorView } from '@codemirror/view';

const SECTION_LEVELS = {
  'part': 0, 'chapter': 1, 'section': 2,
  'subsection': 3, 'subsubsection': 4,
  'paragraph': 5, 'subparagraph': 6,
};

const SECTION_REGEX = /^\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{(.+?)\}/;

let outlineContainer = null;
let updateTimer = null;

export function initOutline() {
  outlineContainer = document.getElementById('outline-tree');
  if (!outlineContainer) return;
  updateOutline();
  console.log('SolteX: Outline panel initialized');
}

export function outlineUpdateExtension() {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    clearTimeout(updateTimer);
    updateTimer = setTimeout(updateOutline, 500);
  });
}

export function updateOutline() {
  const view = getEditorView();
  if (!view || !outlineContainer) return;
  const entries = parseOutline(view.state.doc.toString());
  renderOutline(entries);
}

function parseOutline(text) {
  const lines = text.split('\n');
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trimStart().match(SECTION_REGEX);
    if (match) {
      entries.push({
        level: SECTION_LEVELS[match[1]],
        command: match[1],
        title: cleanTitle(match[2]),
        line: i + 1,
      });
    }
  }
  return entries;
}

function cleanTitle(title) {
  return title
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .trim();
}

function renderOutline(entries) {
  if (!outlineContainer) return;
  if (entries.length === 0) {
    outlineContainer.innerHTML = '<p class="outline-empty">No sections found</p>';
    return;
  }

  outlineContainer.innerHTML = entries.map(e => {
    const indent = e.level * 16;
    const icon = e.level <= 1 ? '\u{1F4D6}' : e.level <= 3 ? '\u{1F4C4}' : '\u2022';
    const cls = e.level <= 1 ? 'outline-major' : e.level <= 3 ? '' : 'outline-minor';
    return `<div class="outline-entry ${cls}" style="padding-left:${8 + indent}px" data-line="${e.line}">
      <span class="outline-icon">${icon}</span>
      <span class="outline-title">${esc(e.title)}</span>
    </div>`;
  }).join('');

  outlineContainer.querySelectorAll('.outline-entry').forEach(el => {
    el.addEventListener('click', () => {
      const line = parseInt(el.dataset.line, 10);
      const view = getEditorView();
      if (!view) return;
      const target = Math.min(line, view.state.doc.lines);
      const lineObj = view.state.doc.line(target);
      view.dispatch({ selection: { anchor: lineObj.from }, scrollIntoView: true });
      view.focus();
    });
  });
}

function esc(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}
