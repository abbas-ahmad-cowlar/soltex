// src/js/autoSave.js
// SolteX -- Auto-Save Module (Fixed: proper save, toggle, debounced save-on-change)

import { getContent } from './editor.js';
import { getSetting } from './settings.js';

let saveTimer = null;
let lastSaved = null;
let currentFilePath = null;
let isDirty = false;
let autoSaveEnabled = true;

export function initAutoSave(filePath) {
  currentFilePath = filePath;
  startAutoSave();
  updateAutoSaveUI();
  console.log('SolteX: Auto-save initialized');
}

export function markDirty() {
  isDirty = true;
  const el = document.getElementById('file-status');
  if (el && el.textContent === 'Ready') {
    el.textContent = 'Modified';
  }
}

export function setAutoSavePath(filePath) {
  currentFilePath = filePath;
}

/**
 * Toggle auto-save on/off.
 */
export function toggleAutoSave() {
  autoSaveEnabled = !autoSaveEnabled;
  updateAutoSaveUI();
  if (autoSaveEnabled) {
    startAutoSave();
  } else {
    clearInterval(saveTimer);
    saveTimer = null;
  }
  console.log(`Auto-save: ${autoSaveEnabled ? 'ON' : 'OFF'}`);
  return autoSaveEnabled;
}

export function isAutoSaveEnabled() {
  return autoSaveEnabled;
}

/**
 * Save the current file immediately to its correct path.
 * This is what Ctrl+S calls — save only, no compilation.
 */
export async function saveCurrentFile() {
  if (!currentFilePath) return false;

  const el = document.getElementById('file-status');
  try {
    if (el) el.textContent = 'Saving...';
    const content = getContent();
    const res = await fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentFilePath, content }),
    });

    if (!res.ok) throw new Error('Save failed');

    isDirty = false;
    lastSaved = new Date();
    if (el) el.textContent = `Saved ${lastSaved.toLocaleTimeString()}`;
    return true;
  } catch (err) {
    console.warn('Save failed:', err);
    if (el) el.textContent = 'Save failed';
    return false;
  }
}

function startAutoSave() {
  clearInterval(saveTimer);
  const interval = (getSetting('autoSaveInterval') || 30) * 1000;
  saveTimer = setInterval(autoSave, interval);
}

async function autoSave() {
  if (!autoSaveEnabled || !isDirty || !currentFilePath) return;
  await saveCurrentFile();
}

function updateAutoSaveUI() {
  const btn = document.getElementById('btn-auto-save');
  if (btn) {
    btn.classList.toggle('btn-active', autoSaveEnabled);
    btn.title = `Auto-save: ${autoSaveEnabled ? 'ON' : 'OFF'}`;
    const label = btn.querySelector('.btn-text');
    if (label) label.textContent = autoSaveEnabled ? 'Auto-save: ON' : 'Auto-save: OFF';
  }
}
