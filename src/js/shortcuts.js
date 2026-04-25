// src/js/shortcuts.js
// SolteX -- Keyboard Shortcuts Registry (Phase 7)

const registry = [];

/**
 * Register a keyboard shortcut.
 * @param {string} keys - e.g. 'Ctrl+Shift+F'
 * @param {string} description - human-readable description
 * @param {Function} handler - callback
 */
export function registerShortcut(keys, description, handler) {
  registry.push({ keys, description, handler });
}

/**
 * Initialize the shortcuts system.
 */
export function initShortcuts() {
  // Register built-in shortcuts
  registerShortcut('Ctrl+S', 'Save file', null);
  registerShortcut('Ctrl+F', 'Find in file', null);
  registerShortcut('Ctrl+H', 'Find & Replace', null);
  registerShortcut('Ctrl+Shift+F', 'Search in project', null);
  registerShortcut('Ctrl+Shift+S', 'Save checkpoint', null);
  registerShortcut('Ctrl+G', 'Go to line', null);
  registerShortcut('Ctrl+/', 'Toggle comment', null);
  registerShortcut('Alt+Z', 'Toggle word wrap', null);
  registerShortcut('Ctrl+B', 'Compile', null);
  registerShortcut('Ctrl+Shift+B', 'Clean recompile', null);
  registerShortcut('Ctrl+-', 'Zoom out PDF', null);
  registerShortcut('Ctrl++', 'Zoom in PDF', null);

  // Help dialog shortcut
  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && e.shiftKey && !e.ctrlKey) {
      // Don't trigger if focus is in an input/editor
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (document.activeElement?.closest('.cm-editor')) return;
      e.preventDefault();
      showShortcutsDialog();
    }
  });

  console.log('SolteX: Shortcuts initialized');
}

function showShortcutsDialog() {
  let modal = document.getElementById('shortcuts-modal');
  if (modal) {
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    return;
  }

  modal = document.createElement('div');
  modal.id = 'shortcuts-modal';
  modal.className = 'modal-overlay';

  const rows = registry.map(s => `
    <div class="shortcut-row">
      <kbd class="shortcut-key">${s.keys}</kbd>
      <span class="shortcut-desc">${s.description}</span>
    </div>
  `).join('');

  modal.innerHTML = `
    <div class="modal-box modal-wide">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h2 class="modal-title" style="margin:0">Keyboard Shortcuts</h2>
        <button class="btn btn-ghost" id="shortcuts-close">Close</button>
      </div>
      <div class="shortcuts-grid">${rows}</div>
      <p style="margin:12px 0 0;font-size:11px;color:var(--text-placeholder)">
        Press <kbd class="shortcut-key" style="font-size:10px">Shift+?</kbd> to toggle this dialog
      </p>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
  modal.querySelector('#shortcuts-close').addEventListener('click', () => modal.style.display = 'none');
}
