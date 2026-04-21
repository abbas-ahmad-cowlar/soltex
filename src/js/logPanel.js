// src/js/logPanel.js
// SolteX -- Error/Warning Log Panel (Features 3.5, 3.6, 3.7)

import { parseLatexLog, countEntries } from './logParser.js';
import { goToLine } from './editor.js';

let panelEl = null;
let listEl = null;
let isOpen = false;

/**
 * Initialize the log panel.
 */
export function initLogPanel() {
  panelEl = document.getElementById('log-panel');
  listEl = document.getElementById('log-entries');

  if (!panelEl || !listEl) {
    console.warn('LogPanel: missing DOM elements');
    return;
  }

  // Toggle button
  const btnLogs = document.getElementById('btn-logs');
  if (btnLogs) btnLogs.addEventListener('click', togglePanel);

  // Close button inside panel
  const btnClose = document.getElementById('log-panel-close');
  if (btnClose) btnClose.addEventListener('click', () => { if (isOpen) togglePanel(); });

  // Listen for compile events
  document.addEventListener('compile-success', (e) => {
    updateFromLog(e.detail.log || '');
  });
  document.addEventListener('compile-error', (e) => {
    updateFromLog(e.detail.log || '');
    if (!isOpen) togglePanel(); // auto-open on error
  });

  console.log('SolteX: Log panel initialized');
}

function updateFromLog(logText) {
  const entries = parseLatexLog(logText);
  const counts = countEntries(entries);
  updateBadge(counts);
  renderEntries(entries);
}

function renderEntries(entries) {
  if (!listEl) return;
  listEl.innerHTML = '';

  if (entries.length === 0) {
    listEl.innerHTML = '<p class="log-empty">No errors or warnings</p>';
    return;
  }

  entries.forEach((entry) => {
    const el = document.createElement('div');
    el.className = `log-entry log-${entry.type}`;

    const icon = entry.type === 'error' ? 'x' : entry.type === 'warning' ? '!' : '-';
    const lineText = entry.line ? `l.${entry.line}` : '';

    el.innerHTML = `
      <span class="log-icon">${icon}</span>
      <span class="log-line">${lineText}</span>
      <span class="log-message">${escapeHtml(entry.message)}</span>
    `;

    if (entry.line) {
      el.classList.add('log-clickable');
      el.addEventListener('click', () => goToLine(entry.line));
    }

    listEl.appendChild(el);
  });
}

function updateBadge(counts) {
  const badge = document.getElementById('logs-badge');
  if (!badge) return;

  if (counts.errors === 0 && counts.warnings === 0) {
    badge.style.display = 'none';
    return;
  }

  let text = '';
  if (counts.errors > 0) text += `${counts.errors}E`;
  if (counts.warnings > 0) text += `${text ? ' ' : ''}${counts.warnings}W`;

  badge.textContent = text;
  badge.style.display = 'inline';
  badge.className = counts.errors > 0 ? 'badge badge-error' : 'badge badge-warning';
}

function togglePanel() {
  isOpen = !isOpen;
  if (panelEl) panelEl.style.display = isOpen ? 'block' : 'none';
  const btn = document.getElementById('btn-logs');
  if (btn) btn.classList.toggle('btn-active', isOpen);
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}
