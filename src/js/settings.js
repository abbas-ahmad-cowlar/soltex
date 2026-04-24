// src/js/settings.js
// SolteX -- Settings Panel (Phase 6)

import { setKeybindingMode, toggleWordWrap, getEditorView } from './editor.js';
import { getAvailableThemes, getCurrentTheme, setEditorTheme } from './themes.js';

const DEFAULTS = {
  fontSize: 14,
  fontFamily: 'JetBrains Mono',
  wordWrap: true,
  keybindings: 'default',
  autoCompile: true,
  autoCompileDelay: 3000,
  spellCheck: false,
  theme: 'one-dark',
  autoSaveInterval: 30,
  texEngine: 'pdflatex',
};

let settings = { ...DEFAULTS };

export function initSettings() {
  loadSettings();
  applySettings();

  const btn = document.getElementById('btn-settings');
  if (btn) btn.addEventListener('click', openSettingsModal);

  console.log('SolteX: Settings initialized');
}

export function getSetting(key) {
  return settings[key] ?? DEFAULTS[key];
}

export function setSetting(key, value) {
  settings[key] = value;
  saveSettings();
  applySettings();
}

function loadSettings() {
  try {
    const stored = localStorage.getItem('soltex-settings');
    if (stored) settings = { ...DEFAULTS, ...JSON.parse(stored) };
  } catch {}
}

function saveSettings() {
  localStorage.setItem('soltex-settings', JSON.stringify(settings));
}

function applySettings() {
  // Font size
  const editor = document.querySelector('.cm-editor');
  if (editor) {
    editor.style.fontSize = `${settings.fontSize}px`;
  }

  // Apply keybinding mode
  if (settings.keybindings !== 'default') {
    setKeybindingMode(settings.keybindings);
  }
}

function openSettingsModal() {
  let modal = document.getElementById('settings-modal');
  if (modal) { modal.style.display = 'flex'; return; }

  modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box modal-wide">
      <h2 class="modal-title">Settings</h2>
      <div class="settings-grid">
        <div class="setting-row">
          <label class="setting-label">Font Size</label>
          <input type="range" id="set-font-size" min="10" max="24" value="${settings.fontSize}" class="setting-range">
          <span id="set-font-size-val">${settings.fontSize}px</span>
        </div>
        <div class="setting-row">
          <label class="setting-label">Keybindings</label>
          <select id="set-keybindings" class="setting-select">
            <option value="default" ${settings.keybindings === 'default' ? 'selected' : ''}>Default</option>
            <option value="vim" ${settings.keybindings === 'vim' ? 'selected' : ''}>Vim</option>
            <option value="emacs" ${settings.keybindings === 'emacs' ? 'selected' : ''}>Emacs</option>
          </select>
        </div>
        <div class="setting-row">
          <label class="setting-label">Word Wrap</label>
          <input type="checkbox" id="set-word-wrap" ${settings.wordWrap ? 'checked' : ''}>
        </div>
        <div class="setting-row">
          <label class="setting-label">Auto-Save (seconds)</label>
          <input type="number" id="set-autosave" min="5" max="300" value="${settings.autoSaveInterval}" class="setting-input">
        </div>
        <div class="setting-row">
          <label class="setting-label">Auto-Compile Delay (ms)</label>
          <input type="number" id="set-autocompile-delay" min="1000" max="10000" step="500" value="${settings.autoCompileDelay}" class="setting-input">
        </div>
        <div class="setting-row">
          <label class="setting-label">Editor Theme</label>
          <select id="set-theme" class="setting-select">
            ${getAvailableThemes().map(t => `<option value="${t.id}" ${getCurrentTheme() === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
          </select>
        </div>
        <div class="setting-row">
          <label class="setting-label">TeX Engine</label>
          <select id="set-tex-engine" class="setting-select">
            <option value="pdflatex" ${settings.texEngine === 'pdflatex' ? 'selected' : ''}>pdfLaTeX</option>
            <option value="xelatex" ${settings.texEngine === 'xelatex' ? 'selected' : ''}>XeLaTeX</option>
            <option value="lualatex" ${settings.texEngine === 'lualatex' ? 'selected' : ''}>LuaLaTeX</option>
          </select>
        </div>
      </div>
      <div class="modal-actions">
        <button id="settings-close" class="btn btn-ghost">Close</button>
        <button id="settings-reset" class="btn btn-ghost">Reset Defaults</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
  modal.querySelector('#settings-close').addEventListener('click', () => modal.style.display = 'none');

  modal.querySelector('#settings-reset').addEventListener('click', () => {
    settings = { ...DEFAULTS };
    saveSettings();
    applySettings();
    modal.remove();
    openSettingsModal();
  });

  // Font size
  const fontSlider = modal.querySelector('#set-font-size');
  const fontVal = modal.querySelector('#set-font-size-val');
  fontSlider.addEventListener('input', () => {
    fontVal.textContent = `${fontSlider.value}px`;
    setSetting('fontSize', parseInt(fontSlider.value));
  });

  // Keybindings
  modal.querySelector('#set-keybindings').addEventListener('change', (e) => {
    setSetting('keybindings', e.target.value);
    setKeybindingMode(e.target.value);
  });

  // Word wrap
  modal.querySelector('#set-word-wrap').addEventListener('change', (e) => {
    setSetting('wordWrap', e.target.checked);
    toggleWordWrap();
  });

  // Auto-save interval
  modal.querySelector('#set-autosave').addEventListener('change', (e) => {
    setSetting('autoSaveInterval', parseInt(e.target.value));
  });

  // Auto-compile delay
  modal.querySelector('#set-autocompile-delay').addEventListener('change', (e) => {
    setSetting('autoCompileDelay', parseInt(e.target.value));
  });

  // Theme
  modal.querySelector('#set-theme').addEventListener('change', (e) => {
    setSetting('theme', e.target.value);
    setEditorTheme(e.target.value, getEditorView());
  });

  // TeX Engine
  modal.querySelector('#set-tex-engine').addEventListener('change', (e) => {
    setSetting('texEngine', e.target.value);
  });
}
