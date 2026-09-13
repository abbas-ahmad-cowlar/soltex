// src/js/app.js
// SolteX -- Frontend Entry Point (Fixed: save/compile separation)

import { initEditor, getContent, setContent, getEditorView, toggleWordWrap, setKeybindingMode, goToLine } from './editor.js';
import { initCompiler, runCompile, recompileClean, toggleDraftMode, setCurrentFilePathGetter } from './compiler.js';
import { initPdfViewer } from './pdfViewer.js';
import { initSplitPanel } from './splitPanel.js';
import { initAutoCompile } from './autoCompile.js';
import { initLogPanel } from './logPanel.js';
import { initFileTree, setActiveFile, refreshTree } from './fileTree.js';
import { initSearchPanel } from './searchPanel.js';
import { initOutline } from './outlinePanel.js';
import { initCheckpointPanel } from './checkpointPanel.js';
import { initSettings, getSetting } from './settings.js';
import { initAutoSave, markDirty, setAutoSavePath, saveCurrentFile, toggleAutoSave } from './autoSave.js';
import { initShortcuts } from './shortcuts.js';
import { initThemeToggle, onThemeToggle } from './themeToggle.js';
import { setEditorTheme } from './themes.js';

const params = new URLSearchParams(window.location.search);
const projectSlug = params.get('project') || 'sample';
let currentFilePath = null;
let mainFile = 'main.tex';

/**
 * Get the current file path (used by compiler.js to save to the correct file).
 */
export function getCurrentFilePath() {
  return currentFilePath;
}

console.log(`SolteX v0.7.1 -- Project: ${projectSlug}`);

document.addEventListener('DOMContentLoaded', async () => {
  // Theme & icons
  initThemeToggle();
  if (window.lucide) window.lucide.createIcons();

  // Sync editor theme when app theme toggles
  onThemeToggle((isDark) => {
    const view = getEditorView();
    if (view) {
      // false = auto-sync, not explicit user choice
      setEditorTheme(isDark ? 'one-dark' : 'soltex-light', view, false);
    }
  });

  const nameEl = document.getElementById('project-name');
  if (nameEl) nameEl.textContent = projectSlug;

  // Fetch project metadata
  try {
    const metaRes = await fetch(`/api/projects/${projectSlug}`);
    if (metaRes.ok) {
      const meta = await metaRes.json();
      mainFile = meta.mainFile || 'main.tex';
      if (nameEl) nameEl.textContent = meta.name || projectSlug;
    }
  } catch {}

  // Initialize Editor
  const editorContainer = document.getElementById('editor-container');
  const fileStatus = document.getElementById('file-status');
  currentFilePath = `projects/${projectSlug}/${mainFile}`;

  try {
    fileStatus.textContent = 'Loading...';
    const res = await fetch(`/api/file?path=${encodeURIComponent(currentFilePath)}`);
    if (!res.ok) throw new Error(res.statusText);

    const content = await res.text();
    const editor = initEditor(editorContainer, content);
    fileStatus.textContent = 'Ready';

    window.soltex = {
      getContent, setContent, editor,
      toggleWordWrap, setKeybindingMode, goToLine,
      runCompile, recompileClean, toggleDraftMode,
      refreshTree, markDirty, saveCurrentFile,
    };
  } catch (err) {
    console.error('Editor init error:', err);
    fileStatus.textContent = 'Error';
    editorContainer.innerHTML = `<div style="padding:40px;color:var(--text-placeholder);text-align:center">
      <p>Failed to load file</p><p style="font-size:12px">${err.message}</p></div>`;
  }

  // Tell compiler.js how to get the current file path (avoids circular import)
  setCurrentFilePathGetter(() => currentFilePath);

  // File tree
  await initFileTree(projectSlug, (filePath) => openFile(filePath));
  setActiveFile(mainFile);

  // Search panel
  initSearchPanel(projectSlug, (file, line) => openFile(file, line));

  // Outline panel
  initOutline();

  // Checkpoint panel
  initCheckpointPanel(projectSlug, () => {
    openFile(mainFile);
    refreshTree();
  });

  // Settings
  initSettings();

  // Auto-save
  initAutoSave(currentFilePath);

  // Keyboard shortcuts (Phase 7)
  initShortcuts();

  // ── Keyboard Shortcuts: Save & Compile ──────────────────────────────────
  document.addEventListener('keydown', (e) => {
    // Ctrl+S = Save current file only (no compile)
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
      e.preventDefault();
      saveCurrentFile();
    }
    // Ctrl+Enter = Save current file + compile main.tex
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runCompile();
    }
  });

  // Auto-save toggle button
  const btnAutoSave = document.getElementById('btn-auto-save');
  if (btnAutoSave) btnAutoSave.addEventListener('click', toggleAutoSave);

  // Sidebar tab switching
  initSidebarTabs();

  // Compilation modules
  initCompiler();
  initAutoCompile(runCompile);
  initLogPanel();
  initPdfViewer();
  initSplitPanel();

  const btnClean = document.getElementById('btn-clean');
  if (btnClean) btnClean.addEventListener('click', recompileClean);

  // Word count after compile
  document.addEventListener('compile-success', updateWordCount);

  // Sidebar toggle for responsive
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('file-sidebar');
      if (sidebar) sidebar.classList.toggle('sidebar-open');
    });
  }

  console.log('SolteX: All modules loaded (save/compile fix applied)');
});

// -- Open file in editor (saves current file first!) --
async function openFile(filePath, lineNum) {
  // Save the current file before switching
  if (currentFilePath) {
    await saveCurrentFile();
  }

  const fullPath = `projects/${projectSlug}/${filePath}`;
  const fileStatus = document.getElementById('file-status');
  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(fullPath)}`);
    if (!res.ok) { console.warn(`Cannot open: ${filePath}`); return; }
    const content = await res.text();
    const view = getEditorView();
    if (view) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
      currentFilePath = fullPath;
      setAutoSavePath(fullPath);
      if (fileStatus) fileStatus.textContent = 'Ready';

      if (lineNum) {
        const target = Math.min(lineNum, view.state.doc.lines);
        const line = view.state.doc.line(target);
        view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
      }

      setActiveFile(filePath);
    }
  } catch (err) {
    console.error('Failed to load file:', err);
  }
}

// -- Sidebar tabs --
function initSidebarTabs() {
  document.querySelectorAll('.sidebar-tab[data-panel]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-tab[data-panel]').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sidebar-panel').forEach(p => p.style.display = 'none');
      tab.classList.add('active');
      const panel = document.getElementById(`panel-${tab.dataset.panel}`);
      if (panel) panel.style.display = 'block';
    });
  });
}

// -- Word count --
async function updateWordCount() {
  try {
    const res = await fetch(`/api/projects/${projectSlug}/wordcount?file=${mainFile}`);
    const data = await res.json();
    const el = document.getElementById('word-count');
    if (el) el.textContent = `Words: ${data.words.toLocaleString()}`;
  } catch {}
}
