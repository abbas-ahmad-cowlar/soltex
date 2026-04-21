// src/js/pdfViewer.js
// SolteX -- PDF Viewer Module (Phase 3: Zoom + Detach)

import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

let currentPdf = null;
let lastPdfUrl = null;
let currentZoom = null; // null = fit-width

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;

/**
 * Initialize the PDF viewer.
 */
export function initPdfViewer() {
  // Compile events
  document.addEventListener('compile-success', (e) => {
    const { pdfUrl } = e.detail;
    if (pdfUrl) {
      lastPdfUrl = pdfUrl;
      loadPDF(`${pdfUrl}?t=${Date.now()}`);
    }
  });

  document.addEventListener('compile-error', () => {
    // Keep current PDF visible
  });

  // Zoom buttons
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnFitWidth = document.getElementById('btn-zoom-fit-width');
  const btnFitPage = document.getElementById('btn-zoom-fit-page');
  const btnDetach = document.getElementById('btn-detach');

  if (btnZoomIn) btnZoomIn.addEventListener('click', zoomIn);
  if (btnZoomOut) btnZoomOut.addEventListener('click', zoomOut);
  if (btnFitWidth) btnFitWidth.addEventListener('click', fitWidth);
  if (btnFitPage) btnFitPage.addEventListener('click', fitPage);
  if (btnDetach) btnDetach.addEventListener('click', detachPdf);

  // Ctrl+Scroll zoom
  const pdfContainer = document.getElementById('pdf-container');
  if (pdfContainer) {
    pdfContainer.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomIn(); else zoomOut();
    }, { passive: false });
  }

  updateZoomLabel();
  console.log('SolteX: PDF Viewer initialized');
}

// -- Zoom Functions --

function zoomIn() {
  if (currentZoom === null) currentZoom = getFitWidthScale();
  currentZoom = Math.min(MAX_ZOOM, currentZoom + ZOOM_STEP);
  applyZoom();
}

function zoomOut() {
  if (currentZoom === null) currentZoom = getFitWidthScale();
  currentZoom = Math.max(MIN_ZOOM, currentZoom - ZOOM_STEP);
  applyZoom();
}

function fitWidth() {
  currentZoom = null;
  applyZoom();
}

function fitPage() {
  const container = document.getElementById('pdf-container');
  if (!container || !currentPdf) return;
  currentPdf.getPage(1).then((page) => {
    const viewport = page.getViewport({ scale: 1 });
    const containerHeight = container.clientHeight - 20;
    currentZoom = containerHeight / viewport.height;
    applyZoom();
  });
}

function applyZoom() {
  updateZoomLabel();
  if (currentPdf) reRenderAll();
}

function updateZoomLabel() {
  const label = document.getElementById('zoom-level');
  if (!label) return;
  label.textContent = currentZoom === null ? 'Fit' : `${Math.round(currentZoom * 100)}%`;
}

function getFitWidthScale() {
  const container = document.getElementById('pdf-container');
  if (!container) return 1.0;
  const containerWidth = container.clientWidth - 40;
  // Approximate
  return containerWidth / 595; // A4 width in points
}

function detachPdf() {
  if (lastPdfUrl) {
    window.open(lastPdfUrl, '_blank');
  } else {
    console.warn('No PDF to detach -- compile first');
  }
}

// -- PDF Loading & Rendering --

async function loadPDF(url) {
  const container = document.getElementById('pdf-container');
  if (!container) return;

  try {
    container.innerHTML = '<div class="placeholder-state"><p class="placeholder-text">Rendering PDF...</p></div>';

    const loadingTask = pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;
    currentPdf = pdf;
    container.innerHTML = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      await renderPage(container, pageNum);
    }
  } catch (err) {
    console.error('PDF render error:', err);
    container.innerHTML = `<div class="placeholder-state"><p class="placeholder-text">Failed to render PDF</p><p class="placeholder-hint">${err.message}</p></div>`;
  }
}

async function reRenderAll() {
  if (!currentPdf) return;
  const container = document.getElementById('pdf-container');
  if (!container) return;

  container.innerHTML = '';
  for (let pageNum = 1; pageNum <= currentPdf.numPages; pageNum++) {
    await renderPage(container, pageNum);
  }
}

async function renderPage(container, pageNum) {
  const page = await currentPdf.getPage(pageNum);
  const unscaledViewport = page.getViewport({ scale: 1 });

  let scale;
  if (currentZoom === null) {
    const containerWidth = container.clientWidth - 40;
    scale = containerWidth / unscaledViewport.width;
  } else {
    scale = currentZoom;
  }

  const viewport = page.getViewport({ scale });

  const pageWrapper = document.createElement('div');
  pageWrapper.className = 'pdf-page';

  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = viewport.width * dpr;
  canvas.height = viewport.height * dpr;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  pageWrapper.appendChild(canvas);
  container.appendChild(pageWrapper);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  await page.render({ canvasContext: ctx, viewport }).promise;
}

export function clearPDF() {
  const container = document.getElementById('pdf-container');
  if (!container) return;
  container.innerHTML = `<div class="placeholder-state"><p class="placeholder-text">No PDF yet -- click Compile</p></div>`;
  currentPdf = null;
  lastPdfUrl = null;
}
