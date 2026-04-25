// src/js/themes.js
// SolteX -- Editor Theme Manager (Phase 7)

import { EditorView } from '@codemirror/view';
import { Compartment } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';

export const themeCompartment = new Compartment();

const THEMES = {
  'one-dark': {
    name: 'One Dark',
    extension: oneDark,
  },
  'monokai': {
    name: 'Monokai',
    extension: EditorView.theme({
      '&': { backgroundColor: '#272822' },
      '.cm-content': { color: '#f8f8f2' },
      '.cm-gutters': { backgroundColor: '#272822', color: '#75715e', borderRight: '1px solid #3e3d32' },
      '.cm-activeLine': { backgroundColor: '#3e3d3222' },
      '.cm-activeLineGutter': { backgroundColor: '#3e3d3244' },
      '.cm-selectionMatch': { backgroundColor: '#3e3d3266' },
    }, { dark: true }),
  },
  'dracula': {
    name: 'Dracula',
    extension: EditorView.theme({
      '&': { backgroundColor: '#282a36' },
      '.cm-content': { color: '#f8f8f2' },
      '.cm-gutters': { backgroundColor: '#282a36', color: '#6272a4', borderRight: '1px solid #44475a' },
      '.cm-activeLine': { backgroundColor: '#44475a33' },
      '.cm-activeLineGutter': { backgroundColor: '#44475a44' },
    }, { dark: true }),
  },
  'solarized-dark': {
    name: 'Solarized Dark',
    extension: EditorView.theme({
      '&': { backgroundColor: '#002b36' },
      '.cm-content': { color: '#839496' },
      '.cm-gutters': { backgroundColor: '#002b36', color: '#586e75', borderRight: '1px solid #073642' },
      '.cm-activeLine': { backgroundColor: '#073642' },
      '.cm-activeLineGutter': { backgroundColor: '#07364244' },
    }, { dark: true }),
  },
  'github-dark': {
    name: 'GitHub Dark',
    extension: EditorView.theme({
      '&': { backgroundColor: '#0d1117' },
      '.cm-content': { color: '#c9d1d9' },
      '.cm-gutters': { backgroundColor: '#0d1117', color: '#484f58', borderRight: '1px solid #21262d' },
      '.cm-activeLine': { backgroundColor: '#161b2233' },
      '.cm-activeLineGutter': { backgroundColor: '#161b2244' },
    }, { dark: true }),
  },
};

let currentTheme = 'one-dark';

export function getAvailableThemes() {
  return Object.entries(THEMES).map(([id, t]) => ({ id, name: t.name }));
}

export function getCurrentTheme() {
  return currentTheme;
}

export function setEditorTheme(themeId, view) {
  if (!THEMES[themeId] || !view) return;
  currentTheme = themeId;
  view.dispatch({
    effects: themeCompartment.reconfigure(THEMES[themeId].extension),
  });
  localStorage.setItem('soltex-theme', themeId);
}

export function getInitialTheme() {
  const stored = localStorage.getItem('soltex-theme');
  if (stored && THEMES[stored]) {
    currentTheme = stored;
    return THEMES[stored].extension;
  }
  return THEMES['one-dark'].extension;
}
