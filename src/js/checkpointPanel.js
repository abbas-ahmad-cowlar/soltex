// src/js/checkpointPanel.js
// SolteX -- Checkpoint History Panel (Phase 6)

let currentProject = null;
let onRestore = null;

export function initCheckpointPanel(project, restoreCallback) {
  currentProject = project;
  onRestore = restoreCallback;

  const btnSave = document.getElementById('btn-save-checkpoint');
  if (btnSave) {
    btnSave.addEventListener('click', saveCheckpoint);
  }

  // Ctrl+S also saves checkpoint (in addition to compile)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      saveCheckpoint();
    }
  });

  loadCheckpoints();
  console.log('SolteX: Checkpoint panel initialized');
}

async function saveCheckpoint() {
  const message = prompt('Checkpoint label (optional):') || '';
  try {
    const res = await fetch(`/api/projects/${currentProject}/checkpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (data.created) {
      showToast(`Checkpoint saved: ${data.message}`);
      loadCheckpoints();
    } else {
      showToast(data.reason || 'No changes to save');
    }
  } catch (err) {
    console.error('Checkpoint error:', err);
  }
}

async function loadCheckpoints() {
  const container = document.getElementById('checkpoint-list');
  if (!container) return;

  try {
    const res = await fetch(`/api/projects/${currentProject}/checkpoints`);
    const data = await res.json();
    renderCheckpoints(data.checkpoints);
  } catch {
    container.innerHTML = '<p class="outline-empty">Failed to load history</p>';
  }
}

function renderCheckpoints(checkpoints) {
  const container = document.getElementById('checkpoint-list');
  if (!container) return;

  if (!checkpoints.length) {
    container.innerHTML = '<p class="outline-empty">No checkpoints yet.<br>Press Ctrl+Shift+S to save one.</p>';
    return;
  }

  container.innerHTML = checkpoints.map((cp, i) => {
    const date = new Date(cp.date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const isLatest = i === 0;
    return `
      <div class="checkpoint-entry ${isLatest ? 'checkpoint-latest' : ''}" data-hash="${cp.hash}">
        <div class="checkpoint-info">
          <span class="checkpoint-hash">${cp.shortHash}</span>
          <span class="checkpoint-date">${date}</span>
        </div>
        <div class="checkpoint-msg">${esc(cp.message)}</div>
        <div class="checkpoint-actions">
          ${!isLatest ? `<button class="btn btn-ghost btn-xs" data-action="restore" title="Restore">Restore</button>` : '<span class="checkpoint-current">Current</span>'}
          <button class="btn btn-ghost btn-xs" data-action="diff" title="View changes">Diff</button>
        </div>
      </div>
    `;
  }).join('');

  // Restore handlers
  container.querySelectorAll('[data-action="restore"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const hash = btn.closest('.checkpoint-entry').dataset.hash;
      if (!confirm('Restore to this checkpoint? Current changes will be auto-saved first.')) return;
      try {
        await fetch(`/api/projects/${currentProject}/restore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hash }),
        });
        showToast('Restored successfully');
        if (onRestore) onRestore();
        loadCheckpoints();
      } catch (err) {
        console.error('Restore error:', err);
      }
    });
  });

  // Diff handlers
  container.querySelectorAll('[data-action="diff"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const hash = btn.closest('.checkpoint-entry').dataset.hash;
      try {
        const res = await fetch(`/api/projects/${currentProject}/diff?from=${hash}^&to=${hash}`);
        const data = await res.json();
        showDiffModal(data.diff);
      } catch (err) {
        console.error('Diff error:', err);
      }
    });
  });
}

function showDiffModal(diff) {
  let modal = document.getElementById('diff-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'diff-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box modal-wide">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h2 class="modal-title" style="margin:0">Changes</h2>
          <button class="btn btn-ghost" id="diff-close">Close</button>
        </div>
        <pre id="diff-content" class="diff-content"></pre>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#diff-close').addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
  }

  const content = modal.querySelector('#diff-content');
  content.innerHTML = diff
    ? diff.split('\n').map(line => {
        const cls = line.startsWith('+') ? 'diff-add' : line.startsWith('-') ? 'diff-del' : 'diff-ctx';
        return `<span class="${cls}">${esc(line)}</span>`;
      }).join('\n')
    : '<span class="diff-ctx">No changes</span>';

  modal.style.display = 'flex';
}

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('toast-visible');
  setTimeout(() => toast.classList.remove('toast-visible'), 3000);
}

function esc(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}
