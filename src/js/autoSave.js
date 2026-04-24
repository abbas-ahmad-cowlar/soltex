// src/js/autoSave.js
// SolteX -- Auto-Save Module (Phase 6)

import { getContent } from './editor.js';
import { getSetting } from './settings.js';

let saveTimer = null;
let lastSaved = null;
let currentFilePath = null;
let isDirty = false;

export function initAutoSave(filePath) {
  currentFilePath = filePath;
  startAutoSave();
  console.log('SolteX: Auto-save initialized');
}

export function markDirty() {
  isDirty = true;
}

export function setAutoSavePath(filePath) {
  currentFilePath = filePath;
}

function startAutoSave() {
  clearInterval(saveTimer);
  const interval = (getSetting('autoSaveInterval') || 30) * 1000;
  saveTimer = setInterval(autoSave, interval);
}

async function autoSave() {
  if (!isDirty || !currentFilePath) return;

  try {
    const content = getContent();
    await fetch(`/api/file?path=${encodeURIComponent(currentFilePath)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: content,
    });

    isDirty = false;
    lastSaved = new Date();

    const el = document.getElementById('file-status');
    if (el) el.textContent = `Saved ${lastSaved.toLocaleTimeString()}`;
  } catch (err) {
    console.warn('Auto-save failed:', err);
  }
}
