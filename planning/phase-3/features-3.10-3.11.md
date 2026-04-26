# Features 3.10, 3.11 — PDF Zoom Controls & Detach to Tab

> **Phase**: 3 | **Features**: 10, 11
> **Goal**: Add zoom controls for the PDF viewer (presets, Ctrl+Scroll, keyboard shortcuts) and a button to open the PDF in a separate browser tab.
> **Estimated Effort**: 4–5 hours total
> **Dependencies**: Feature 1.5 (PDF viewer with `renderPage()`).

---

## Feature 3.10 — PDF Zoom Controls

### Overview

Currently (Phase 1), the PDF scales to fit the panel width automatically. This feature makes scale user-controllable while keeping "Fit Width" as the default.

### New File: `src/js/zoomControls.js`

```javascript
// src/js/zoomControls.js

// Presets
const ZOOM_PRESETS = [
  { label: '50%', scale: 0.5 },
  { label: '75%', scale: 0.75 },
  { label: '100%', scale: 1.0 },
  { label: '125%', scale: 1.25 },
  { label: '150%', scale: 1.5 },
  { label: '200%', scale: 2.0 },
];
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;

// State
let currentZoom = null; // null = "Fit Width" mode
let zoomLabel = null;

/**
 * Initialize zoom controls.
 */
export function initZoomControls() {
  zoomLabel = document.getElementById('zoom-level');

  document.getElementById('btn-zoom-in').addEventListener('click', zoomIn);
  document.getElementById('btn-zoom-out').addEventListener('click', zoomOut);
  document.getElementById('btn-zoom-fit-width').addEventListener('click', fitWidth);
  document.getElementById('btn-zoom-fit-page').addEventListener('click', fitPage);

  // Ctrl+Scroll on the PDF container
  const pdfContainer = document.getElementById('pdf-container');
  pdfContainer.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  }, { passive: false });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      zoomIn();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '-') {
      e.preventDefault();
      zoomOut();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      fitWidth();
    }
  });

  updateLabel();
  console.log('Zoom controls initialized');
}

/**
 * Get the current zoom scale.
 * If null, the PDF viewer should use "fit width" mode.
 * @returns {number|null}
 */
export function getZoomScale() {
  return currentZoom;
}

function zoomIn() {
  if (currentZoom === null) {
    // Switch from fit-width to explicit zoom
    currentZoom = getCurrentFitWidthScale();
  }
  currentZoom = Math.min(MAX_ZOOM, currentZoom + ZOOM_STEP);
  applyZoom();
}

function zoomOut() {
  if (currentZoom === null) {
    currentZoom = getCurrentFitWidthScale();
  }
  currentZoom = Math.max(MIN_ZOOM, currentZoom - ZOOM_STEP);
  applyZoom();
}

function fitWidth() {
  currentZoom = null; // Reset to auto-fit
  applyZoom();
}

function fitPage() {
  // Calculate scale to fit entire page height in the container
  const container = document.getElementById('pdf-container');
  const canvas = container.querySelector('.pdf-page');
  if (!canvas) return;

  // Approximate: use the container height and the PDF page aspect ratio
  // This requires knowing the original PDF page dimensions
  // For now, use a reasonable approximation
  const containerHeight = container.clientHeight;
  const pageHeight = canvas.height / (window.devicePixelRatio || 1);
  currentZoom = containerHeight / pageHeight;
  applyZoom();
}

function applyZoom() {
  updateLabel();
  // Dispatch event — the PDF viewer listens for this
  document.dispatchEvent(new CustomEvent('zoom-changed', {
    detail: { scale: currentZoom },
  }));
}

function updateLabel() {
  if (!zoomLabel) return;
  if (currentZoom === null) {
    zoomLabel.textContent = 'Fit';
  } else {
    zoomLabel.textContent = `${Math.round(currentZoom * 100)}%`;
  }
}

/**
 * Get the current "fit width" scale by examining the rendered canvas.
 */
function getCurrentFitWidthScale() {
  const container = document.getElementById('pdf-container');
  const canvas = container.querySelector('.pdf-page');
  if (!canvas) return 1.0;
  return canvas.clientWidth / (canvas.width / (window.devicePixelRatio || 1));
}
```

### Modify PDF Viewer to Support Zoom
In `src/js/pdfViewer.js`, update `renderPage()` to use the zoom scale:

```javascript
import { getZoomScale } from './zoomControls.js';

// In renderPage():
async function renderPage(pageNum) {
  const page = await currentPdf.getPage(pageNum);

  const zoomScale = getZoomScale();
  let viewport;

  if (zoomScale === null) {
    // Fit width (existing behavior)
    const unscaledViewport = page.getViewport({ scale: 1 });
    const containerWidth = container.clientWidth - 20;
    const fitScale = containerWidth / unscaledViewport.width;
    viewport = page.getViewport({ scale: fitScale });
  } else {
    // Fixed zoom level
    viewport = page.getViewport({ scale: zoomScale });
  }

  // ... rest of rendering (canvas, context, etc.)
}

// Listen for zoom changes:
document.addEventListener('zoom-changed', () => {
  if (currentPdf) reRenderAllPages();
});
```

---

### Zoom Toolbar HTML
```html
<div id="zoom-toolbar" class="zoom-toolbar">
  <button id="btn-zoom-out" class="btn btn-icon-only" title="Zoom out (Ctrl+-)">−</button>
  <span id="zoom-level" class="zoom-label">Fit</span>
  <button id="btn-zoom-in" class="btn btn-icon-only" title="Zoom in (Ctrl++)">+</button>
  <button id="btn-zoom-fit-width" class="btn btn-icon-only" title="Fit width (Ctrl+0)">↔</button>
  <button id="btn-zoom-fit-page" class="btn btn-icon-only" title="Fit page">⇕</button>
</div>
```

### Zoom Toolbar CSS
```css
.zoom-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-left: 1px solid var(--border-color);
}

.zoom-label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  min-width: 36px;
  text-align: center;
  font-family: var(--font-mono);
}

.btn-icon-only {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 16px;
  line-height: 1;
  transition: all var(--transition-fast);
}

.btn-icon-only:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
```

### Edge Cases — Zoom
- **Zoom + resize panel**: Zoom level stays fixed. Only "Fit Width" mode re-adapts.
- **Zoom + re-render**: Each zoom change re-renders all pages. Debounce Ctrl+Scroll to prevent lag.
- **Zoom 400%**: Very large canvases. Memory usage increases. Acceptable for Phase 3.

---

## Feature 3.11 — Detach PDF to Separate Tab

### Overview
A single button that opens the compiled PDF in a new browser tab.

### Implementation

```javascript
// In app.js or pdfViewer.js:
document.getElementById('btn-detach').addEventListener('click', () => {
  const pdfUrl = lastPdfUrl; // Stored from the last compile-success event
  if (pdfUrl) {
    window.open(pdfUrl, '_blank');
  } else {
    console.warn('No PDF to detach — compile first');
  }
});
```

### HTML
```html
<button id="btn-detach" class="btn btn-toolbar" title="Open PDF in new tab">
  <span class="btn-icon">↗</span>
</button>
```

### Notes
- The PDF URL is already served by Express static middleware
- The detached tab shows the raw PDF — no zoom controls, no sync
- Recompiling doesn't auto-update the detached tab (user must refresh)
- This is primarily for multi-monitor setups where you want the PDF on a second screen

---

## Final Acceptance Checklist — Features 3.10, 3.11

| # | Check | Status |
|---|-------|--------|
| 1 | Zoom toolbar appears in the preview panel area | ☐ |
| 2 | "+" button zooms in | ☐ |
| 3 | "−" button zooms out | ☐ |
| 4 | Zoom label shows current percentage (e.g., "125%") | ☐ |
| 5 | "Fit" label shows in fit-width mode | ☐ |
| 6 | Fit Width button (↔) resets to fit-width mode | ☐ |
| 7 | Fit Page button (⇕) fits entire page vertically | ☐ |
| 8 | Ctrl+Scroll zooms in/out on the PDF container | ☐ |
| 9 | Ctrl+= zooms in, Ctrl+- zooms out, Ctrl+0 resets | ☐ |
| 10 | Zoom is clamped between 25% and 400% | ☐ |
| 11 | Zooming re-renders all pages at new scale | ☐ |
| 12 | Detach button (↗) opens PDF in a new browser tab | ☐ |
| 13 | Detached tab shows the correct PDF | ☐ |
| 14 | No PDF compiled yet → detach button logs warning | ☐ |

> **Done → Phase 3 complete! Run the Phase 3 Integration Test Plan.**
