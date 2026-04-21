// src/js/autoCompile.js
// SolteX -- Auto-Compile with Debounce (Feature 3.1)

import { EditorView } from '@codemirror/view';

let enabled = false;
let debounceDelay = 3000;
let debounceTimer = null;
let runCompileFn = null;

/**
 * Initialize auto-compile with a reference to the compile function.
 * @param {Function} compileFn - The function to call for compilation
 */
export function initAutoCompile(compileFn) {
  runCompileFn = compileFn;
  const btn = document.getElementById('btn-auto-compile');
  if (btn) btn.addEventListener('click', toggleAutoCompile);
  console.log('SolteX: Auto-compile initialized (default: OFF)');
}

/**
 * CodeMirror extension for auto-compile.
 * Add this to the editor's extensions array.
 */
export function autoCompileExtension() {
  return EditorView.updateListener.of((update) => {
    if (!enabled || !update.docChanged) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (runCompileFn) {
        console.log('Auto-compile: triggering...');
        runCompileFn();
      }
    }, debounceDelay);
  });
}

/**
 * Toggle auto-compile on/off.
 */
export function toggleAutoCompile() {
  enabled = !enabled;
  const btn = document.getElementById('btn-auto-compile');
  if (btn) {
    btn.classList.toggle('btn-active', enabled);
    btn.title = `Auto-compile: ${enabled ? 'ON' : 'OFF'}`;
  }

  if (!enabled && debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  console.log(`Auto-compile: ${enabled ? 'ON' : 'OFF'}`);
  return enabled;
}

export function setDebounceDelay(ms) {
  debounceDelay = Math.max(500, Math.min(10000, ms));
}

export function isAutoCompileEnabled() {
  return enabled;
}
