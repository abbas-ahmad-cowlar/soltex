# Features 6.3, 6.4, 6.6 — Checkpoint History, Restore & Labels

> **Phase**: 6 | **Features**: 3, 4, 6
> **Goal**: (6.3) A sidebar panel showing all checkpoints chronologically. (6.4) A "Restore" button that reverts the project to a selected checkpoint. (6.6) Editable labels for checkpoints.
> **Estimated Effort**: 7–10 hours total
> **Dependencies**: Features 6.1 + 6.2 (Git init + checkpoint creation).

---

## Step 1: Frontend — Checkpoint History Panel

### File: `src/js/checkpointPanel.js`

```javascript
// src/js/checkpointPanel.js

let historyContainer = null;
let currentProject = null;
let selectedCheckpoints = []; // For diff comparison (max 2)

/**
 * Initialize the history panel.
 */
export async function initCheckpointPanel(project) {
  currentProject = project;
  historyContainer = document.getElementById('history-list');
  if (!historyContainer) return;

  await refreshHistory();

  // Listen for new checkpoints
  document.addEventListener('checkpoint-saved', refreshHistory);
  console.log('Checkpoint panel initialized');
}

/**
 * Load and render checkpoint history.
 */
export async function refreshHistory() {
  try {
    const response = await fetch(`/api/projects/${currentProject}/checkpoints`);
    const data = await response.json();
    renderHistory(data.checkpoints);
  } catch (err) {
    console.error('Failed to load checkpoints:', err);
    if (historyContainer) {
      historyContainer.innerHTML = '<p class="history-empty">Failed to load history</p>';
    }
  }
}

function renderHistory(checkpoints) {
  if (!historyContainer) return;

  if (checkpoints.length === 0) {
    historyContainer.innerHTML = `
      <p class="history-empty">No checkpoints yet.<br />
      Press <kbd>Ctrl+S</kbd> to save one.</p>`;
    return;
  }

  historyContainer.innerHTML = checkpoints.map((cp, idx) => {
    const date = new Date(cp.date);
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const stats = cp.filesChanged;
    const statsStr = stats.changed > 0
      ? `${stats.changed} file${stats.changed !== 1 ? 's' : ''}`
      : '';

    // Extract label (before the timestamp in parens)
    const label = extractLabel(cp.message);
    const isSelected = selectedCheckpoints.includes(cp.hash);

    return `
      <div class="history-entry ${isSelected ? 'selected' : ''}" data-hash="${cp.hash}">
        <div class="history-header">
          <span class="history-dot ${idx === 0 ? 'dot-latest' : ''}"></span>
          <div class="history-meta">
            <span class="history-label" data-hash="${cp.hash}"
                  title="Click to edit label">${escapeHtml(label)}</span>
            <span class="history-time">${dateStr} ${timeStr}</span>
          </div>
        </div>
        <div class="history-stats">${statsStr}</div>
        <div class="history-actions">
          <button class="btn-sm btn-ghost" data-action="restore" data-hash="${cp.hash}"
                  title="Restore to this checkpoint">↩ Restore</button>
          <button class="btn-sm btn-ghost" data-action="compare" data-hash="${cp.hash}"
                  title="Select for comparison">⇄ Compare</button>
        </div>
      </div>
    `;
  }).join('');

  // Wire click handlers
  historyContainer.querySelectorAll('[data-action="restore"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleRestore(btn.dataset.hash);
    });
  });

  historyContainer.querySelectorAll('[data-action="compare"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleCompareSelect(btn.dataset.hash);
    });
  });

  // Label editing
  historyContainer.querySelectorAll('.history-label').forEach(el => {
    el.addEventListener('dblclick', () => {
      handleLabelEdit(el.dataset.hash, el);
    });
  });
}

/**
 * Extract the human-readable label from a commit message.
 * Messages are formatted as: "Label (Apr 26, 2026 02:30:00 PM)"
 * or "Checkpoint: Apr 26, 2026 02:30:00 PM"
 */
function extractLabel(message) {
  // If it starts with "Checkpoint:", show just the timestamp
  if (message.startsWith('Checkpoint:')) {
    return message;
  }
  // If it has a label before the timestamp parens
  const match = message.match(/^(.+?)\s*\(/);
  return match ? match[1] : message;
}

// ============ Feature 6.4 — Restore ============

async function handleRestore(hash) {
  const confirmed = confirm(
    'Restore to this checkpoint?\n\nYour current changes will be auto-saved first.'
  );
  if (!confirmed) return;

  try {
    // Save current file to disk first
    await saveCurrentFileToDisk();

    const response = await fetch(`/api/projects/${currentProject}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash }),
    });

    if (!response.ok) {
      showToast('Restore failed', 'error');
      return;
    }

    showToast('Restored successfully', 'success');

    // Reload everything — file tree, editor content, history
    document.dispatchEvent(new CustomEvent('project-restored'));
    await refreshHistory();

    // Reload the current file in the editor
    const fileResponse = await fetch(
      `/api/projects/${currentProject}/file?path=${encodeURIComponent(getCurrentFilePath())}`
    );
    const fileData = await fileResponse.json();
    if (fileData.content !== undefined) {
      reloadEditorContent(fileData.content);
    }
  } catch (err) {
    console.error('Restore error:', err);
    showToast('Restore failed', 'error');
  }
}

// ============ Feature 6.6 — Labels ============

async function handleLabelEdit(hash, labelEl) {
  const currentLabel = labelEl.textContent;
  const newLabel = prompt('Checkpoint label:', currentLabel);
  if (!newLabel || newLabel === currentLabel) return;

  try {
    await fetch(`/api/projects/${currentProject}/checkpoint/${hash}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel }),
    });

    labelEl.textContent = newLabel;
    showToast('Label updated', 'success');
  } catch (err) {
    showToast('Failed to update label', 'error');
  }
}

// ============ Compare Selection ============

function handleCompareSelect(hash) {
  const idx = selectedCheckpoints.indexOf(hash);
  if (idx >= 0) {
    selectedCheckpoints.splice(idx, 1);
  } else {
    selectedCheckpoints.push(hash);
    if (selectedCheckpoints.length > 2) {
      selectedCheckpoints.shift(); // Keep only last 2
    }
  }

  // Update UI selection
  historyContainer.querySelectorAll('.history-entry').forEach(el => {
    el.classList.toggle('selected', selectedCheckpoints.includes(el.dataset.hash));
  });

  // If 2 selected, trigger diff
  if (selectedCheckpoints.length === 2) {
    document.dispatchEvent(new CustomEvent('compare-checkpoints', {
      detail: { from: selectedCheckpoints[0], to: selectedCheckpoints[1] },
    }));
    selectedCheckpoints = [];
  }
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}
```

---

## Step 2: HTML — History Tab in Sidebar

```html
<!-- Add to sidebar tabs -->
<button class="sidebar-tab" data-panel="history" title="History">🕐</button>

<!-- Add as a sidebar panel -->
<div id="panel-history" class="sidebar-panel" style="display: none;">
  <div class="history-header-bar">
    <span class="sidebar-title">CHECKPOINTS</span>
  </div>
  <div id="history-list" class="history-list">
    <p class="history-empty">Loading...</p>
  </div>
</div>
```

---

## Step 3: CSS

```css
/* History Panel */
.history-list { overflow-y: auto; flex: 1; padding: 0; }
.history-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--text-placeholder);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}
.history-empty kbd {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  padding: 1px 5px;
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
}

.history-entry {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  transition: background var(--transition-fast);
}

.history-entry:hover { background: var(--bg-tertiary); }
.history-entry.selected { background: rgba(124, 111, 247, 0.08); }

.history-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.history-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-placeholder);
  flex-shrink: 0;
  margin-top: 5px;
}

.dot-latest { background: var(--accent-success); }

.history-meta { flex: 1; min-width: 0; }

.history-label {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-weight: 500;
  cursor: pointer;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-label:hover { text-decoration: underline dotted; }

.history-time {
  font-size: var(--font-size-xs);
  color: var(--text-placeholder);
}

.history-stats {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin: 4px 0 4px 16px;
}

.history-actions {
  display: flex;
  gap: 4px;
  margin-left: 16px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.history-entry:hover .history-actions { opacity: 1; }

.btn-sm {
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-sm:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
```

---

## Edge Cases

- **No checkpoints yet**: Shows "No checkpoints yet. Press Ctrl+S to save one." with styled `<kbd>` element.
- **Restore with no unsaved changes**: The auto-checkpoint before restore detects "clean" state and skips the commit — just restores directly.
- **Restore to the current state**: Effectively a no-op. No crash.
- **Label editing**: Double-click the label text → `prompt()`. Enter to save, Escape/cancel to abort.
- **Diff selection**: User clicks "Compare" on two entries. If they click a third, the first is deselected (FIFO behavior, max 2).
- **50 checkpoint limit**: `getCheckpoints` defaults to last 50 commits. For most projects, this is more than enough. Pagination can be added in Phase 7 if needed.
- **Auto-save commits**: Commits from auto-save-before-restore show differently (prefixed with "Auto-save before restore"). The user can tell them apart from manual checkpoints.

---

## Final Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | History tab (🕐) appears in sidebar | ☐ |
| 2 | Checkpoints listed chronologically (newest first) | ☐ |
| 3 | Each entry shows label/message, date, time | ☐ |
| 4 | Latest checkpoint has a green dot | ☐ |
| 5 | "Restore" button appears on hover | ☐ |
| 6 | Restore auto-saves current state first | ☐ |
| 7 | After restore, editor shows the old content | ☐ |
| 8 | File tree refreshes after restore | ☐ |
| 9 | Double-click label → prompt to edit → label updates | ☐ |
| 10 | "Compare" button selects entry for diff | ☐ |
| 11 | Two selected → triggers diff event | ☐ |
| 12 | Empty history shows helpful message | ☐ |
| 13 | History refreshes when a new checkpoint is saved | ☐ |

> **Done → Proceed to Feature 6.5 (Diff View).**
