# Feature 6.5 — Diff View Between Checkpoints

> **Phase**: 6 | **Feature**: 5
> **Goal**: Select two checkpoints → see a side-by-side diff of what changed (green = added, red = removed). Rendered in a modal overlay.
> **Estimated Effort**: 3–4 hours
> **Dependencies**: Features 6.3 (history panel, compare selection), `diff2html` (npm).

---

## Overview

When the user selects two checkpoints in the history panel and clicks "Compare", we:
1. Call `GET /api/projects/:name/diff?from=<hash1>&to=<hash2>` — backend runs `git diff`
2. Frontend receives the unified diff string
3. `diff2html` library converts it to side-by-side HTML
4. Render in a full-screen modal overlay

---

## Step 1: Diff Viewer Module

### File: `src/js/diffViewer.js`

```javascript
// src/js/diffViewer.js
import { html as diff2htmlHtml } from 'diff2html';

let currentProject = null;

/**
 * Initialize diff viewer.
 */
export function initDiffViewer(project) {
  currentProject = project;

  // Listen for compare events from the checkpoint panel
  document.addEventListener('compare-checkpoints', async (e) => {
    const { from, to } = e.detail;
    await showDiff(from, to);
  });
}

/**
 * Fetch diff and render in modal.
 */
async function showDiff(fromHash, toHash) {
  try {
    const params = new URLSearchParams({ from: fromHash, to: toHash });
    const response = await fetch(`/api/projects/${currentProject}/diff?${params}`);
    const data = await response.json();

    if (!data.diff || data.diff.trim().length === 0) {
      showToast('No differences between these checkpoints', 'info');
      return;
    }

    // Convert unified diff to HTML using diff2html
    const diffHtml = diff2htmlHtml(data.diff, {
      drawFileList: true,
      matching: 'lines',
      outputFormat: 'side-by-side',
      renderNothingWhenEmpty: false,
    });

    renderDiffModal(diffHtml, fromHash, toHash);
  } catch (err) {
    console.error('Diff error:', err);
    showToast('Failed to load diff', 'error');
  }
}

/**
 * Render the diff modal.
 */
function renderDiffModal(diffHtml, fromHash, toHash) {
  // Remove existing modal
  const existing = document.getElementById('diff-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'diff-modal';
  modal.className = 'diff-modal-overlay';
  modal.innerHTML = `
    <div class="diff-modal-content">
      <div class="diff-modal-header">
        <h3 class="diff-modal-title">
          Comparing
          <code>${fromHash.substring(0, 7)}</code>
          ↔
          <code>${toHash.substring(0, 7)}</code>
        </h3>
        <button class="btn btn-icon-only diff-modal-close" title="Close">✕</button>
      </div>
      <div class="diff-modal-body">
        ${diffHtml}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  modal.querySelector('.diff-modal-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', onEsc);
    }
  });
}
```

---

## Step 2: CSS for Diff Modal

```css
/* Diff Modal Overlay */
.diff-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
}

.diff-modal-content {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: 90vw;
  max-width: 1200px;
  height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
}

.diff-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-toolbar);
}

.diff-modal-title {
  margin: 0;
  font-size: var(--font-size-md);
  color: var(--text-primary);
}

.diff-modal-title code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--accent-primary);
}

.diff-modal-close {
  font-size: 18px;
}

.diff-modal-body {
  flex: 1;
  overflow: auto;
  padding: 0;
}

/* diff2html dark theme overrides */
.d2h-wrapper {
  background: var(--bg-primary) !important;
}

.d2h-file-header {
  background: var(--bg-toolbar) !important;
  border-bottom: 1px solid var(--border-color) !important;
  color: var(--text-primary) !important;
}

.d2h-file-name {
  color: var(--accent-primary) !important;
}

.d2h-code-line, .d2h-code-side-line {
  background: var(--bg-primary) !important;
  color: var(--text-primary) !important;
  font-family: var(--font-mono) !important;
  font-size: var(--font-size-sm) !important;
}

.d2h-ins { background: rgba(63, 185, 80, 0.15) !important; }
.d2h-del { background: rgba(255, 69, 58, 0.15) !important; }
.d2h-ins .d2h-code-line-ctn { color: var(--accent-success) !important; }
.d2h-del .d2h-code-line-ctn { color: var(--accent-error) !important; }

.d2h-code-line-prefix {
  color: var(--text-placeholder) !important;
  user-select: none;
}

.d2h-info {
  background: rgba(124, 111, 247, 0.1) !important;
  color: var(--accent-primary) !important;
}

.d2h-file-list {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-color) !important;
}
```

Also import the `diff2html` base CSS in your HTML:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css" />
```

---

## Step 3: Wire in `app.js`

```javascript
import { initDiffViewer } from './diffViewer.js';

// After project loads:
initDiffViewer(currentProject);
```

---

## Edge Cases

- **No differences**: Both checkpoints are identical → show "No differences" toast instead of an empty modal.
- **Large diff (1000+ lines)**: `diff2html` handles it. The modal scrolls. Performance is fine.
- **Binary files changed**: Git diff shows `Binary files differ`. `diff2html` renders this as a note, not a crash.
- **Escape / click outside**: Both close the modal.
- **diff2html CSS conflicts**: We override diff2html's light-theme classes to match our dark theme.

---

## Final Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Selecting 2 checkpoints triggers diff view | ☐ |
| 2 | Diff modal shows side-by-side comparison | ☐ |
| 3 | Added lines are green, removed lines are red | ☐ |
| 4 | File list at top shows which files changed | ☐ |
| 5 | Modal shows commit hashes in header | ☐ |
| 6 | Close via ✕ button, Escape key, or click outside | ☐ |
| 7 | No differences → informative toast message | ☐ |
| 8 | Dark theme overrides applied to diff2html | ☐ |
| 9 | Long diffs scroll properly | ☐ |

> **Done → Proceed to Features 6.7–6.8.**
