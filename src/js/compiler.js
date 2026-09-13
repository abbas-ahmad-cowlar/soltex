// src/js/compiler.js
// SolteX -- Compile Logic (Fixed: save/compile separation)

import { getContent } from './editor.js';

let isCompiling = false;
let draftMode = false;

// Dynamic project path from URL
const params = new URLSearchParams(window.location.search);
const projectSlug = params.get('project') || 'sample';
const PROJECT_PATH = `projects/${projectSlug}`;
let MAIN_FILE = 'main.tex';

// Callback to get the current file path — set by app.js
let getCurrentFilePathFn = null;

/**
 * Set the main file for compilation (called from app.js).
 */
export function setMainFile(file) {
  MAIN_FILE = file;
}

/**
 * Register a callback that returns the current file path.
 * This avoids a circular import between app.js and compiler.js.
 */
export function setCurrentFilePathGetter(fn) {
  getCurrentFilePathFn = fn;
}

/**
 * Initialize the compile button.
 * NOTE: Keyboard shortcuts (Ctrl+S, Ctrl+Enter) are now handled by app.js.
 */
export function initCompiler() {
  const btnCompile = document.getElementById('btn-compile');
  if (btnCompile) btnCompile.addEventListener('click', () => runCompile());

  // Draft toggle
  const btnDraft = document.getElementById('btn-draft');
  if (btnDraft) btnDraft.addEventListener('click', toggleDraftMode);

  console.log('SolteX: Compiler initialized');
}

/**
 * Toggle draft compilation mode.
 */
export function toggleDraftMode() {
  draftMode = !draftMode;
  const btn = document.getElementById('btn-draft');
  if (btn) {
    btn.classList.toggle('btn-active', draftMode);
    btn.title = draftMode ? 'Draft mode: ON (images skipped)' : 'Draft mode: OFF';
  }
  console.log(`Draft mode: ${draftMode ? 'ON' : 'OFF'}`);
  return draftMode;
}

/**
 * Save the current file to its CORRECT path, then compile main.tex.
 * This is the fixed pipeline: save current → compile main.
 */
export async function runCompile() {
  if (isCompiling) return;

  const btnCompile = document.getElementById('btn-compile');
  const compileStatus = document.getElementById('compile-status');
  const fileStatus = document.getElementById('file-status');

  try {
    isCompiling = true;

    if (btnCompile) {
      btnCompile.disabled = true;
      btnCompile.classList.add('btn-compiling');
      const icon = btnCompile.querySelector('.btn-icon');
      const text = btnCompile.querySelector('.btn-text');
      if (icon) icon.textContent = String.fromCodePoint(10227); // arrow
      if (text) text.textContent = 'Compiling...';
    }
    if (compileStatus) { compileStatus.textContent = ''; compileStatus.className = 'status-text'; }
    if (fileStatus) fileStatus.textContent = 'Saving...';

    // Step 1: Save the CURRENT file to its correct path (not main.tex)
    const content = getContent();
    const currentPath = getCurrentFilePathFn ? getCurrentFilePathFn() : `${PROJECT_PATH}/${MAIN_FILE}`;
    const saveRes = await fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentPath, content }),
    });
    if (!saveRes.ok) throw new Error('Failed to save file');

    if (fileStatus) fileStatus.textContent = 'Compiling...';

    // Step 2: Compile main.tex (always, regardless of which file is open)
    const compileRes = await fetch('/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: PROJECT_PATH, mainFile: MAIN_FILE, draft: draftMode }),
    });
    const result = await compileRes.json();

    if (result.success) {
      const sec = (result.duration / 1000).toFixed(1);
      const draftLabel = draftMode ? ' (draft)' : '';
      if (compileStatus) {
        compileStatus.textContent = `Compiled in ${sec}s${draftLabel}`;
        compileStatus.className = 'status-text success';
      }
      if (fileStatus) fileStatus.textContent = 'Ready';

      document.dispatchEvent(new CustomEvent('compile-success', {
        detail: { pdfUrl: result.pdfUrl, duration: result.duration, log: result.log },
      }));
    } else {
      // PDF may still have been produced despite errors (nonstopmode behavior)
      if (result.pdfUrl) {
        // Compiled with warnings — still have a PDF
        if (compileStatus) {
          compileStatus.textContent = 'Compiled with warnings';
          compileStatus.className = 'status-text warning';
        }
        if (fileStatus) fileStatus.textContent = 'Ready';
      } else {
        if (compileStatus) {
          compileStatus.textContent = 'Compilation failed';
          compileStatus.className = 'status-text error';
        }
        if (fileStatus) fileStatus.textContent = 'Error';
      }

      document.dispatchEvent(new CustomEvent('compile-error', {
        detail: { log: result.log, duration: result.duration, pdfUrl: result.pdfUrl },
      }));
    }
  } catch (err) {
    console.error('Compile error:', err);
    if (compileStatus) { compileStatus.textContent = 'Error'; compileStatus.className = 'status-text error'; }
    if (fileStatus) fileStatus.textContent = 'Error';
  } finally {
    isCompiling = false;
    if (btnCompile) {
      btnCompile.disabled = false;
      btnCompile.classList.remove('btn-compiling');
      const icon = btnCompile.querySelector('.btn-icon');
      const text = btnCompile.querySelector('.btn-text');
      if (icon) icon.textContent = String.fromCodePoint(9654); // play
      if (text) text.textContent = 'Compile';
    }
  }
}

/**
 * Recompile from scratch (clean + compile).
 */
export async function recompileClean() {
  await fetch('/api/compile/clean', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath: PROJECT_PATH }),
  });
  await runCompile();
}
