// src/js/splitPanel.js
// SolteX — Split Panel Divider Logic

/**
 * Initialize the draggable divider between editor and preview panels.
 */
export function initSplitPanel() {
  const divider = document.getElementById('divider');
  const editorPanel = document.getElementById('editor-panel');
  const previewPanel = document.getElementById('preview-panel');
  const workspace = document.getElementById('workspace');

  if (!divider || !editorPanel || !previewPanel || !workspace) {
    console.error('SplitPanel: Missing required DOM elements');
    return;
  }

  let isDragging = false;
  let startX = 0;
  let startEditorWidth = 0;

  const MIN_PANEL_WIDTH = 200; // px

  divider.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startEditorWidth = editorPanel.getBoundingClientRect().width;

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    divider.classList.add('dragging');

    // Prevent iframe/canvas from capturing mouse events
    editorPanel.style.pointerEvents = 'none';
    previewPanel.style.pointerEvents = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const workspaceWidth = workspace.getBoundingClientRect().width;
    const dividerWidth = divider.getBoundingClientRect().width;

    let newEditorWidth = startEditorWidth + dx;

    // Enforce minimum widths
    const maxEditorWidth = workspaceWidth - dividerWidth - MIN_PANEL_WIDTH;
    newEditorWidth = Math.max(MIN_PANEL_WIDTH, Math.min(maxEditorWidth, newEditorWidth));

    // Calculate the flex ratio
    const editorRatio = newEditorWidth / (workspaceWidth - dividerWidth);
    const previewRatio = 1 - editorRatio;

    editorPanel.style.flex = `${editorRatio}`;
    previewPanel.style.flex = `${previewRatio}`;
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;

    isDragging = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    divider.classList.remove('dragging');

    // Re-enable pointer events
    editorPanel.style.pointerEvents = '';
    previewPanel.style.pointerEvents = '';

    // Save split position to localStorage
    const editorFlex = editorPanel.style.flex;
    if (editorFlex) {
      localStorage.setItem('soltex-split-position', editorFlex);
    }
  });

  // Restore split position from localStorage
  const savedPosition = localStorage.getItem('soltex-split-position');
  if (savedPosition) {
    const editorRatio = parseFloat(savedPosition);
    if (editorRatio > 0 && editorRatio < 1) {
      editorPanel.style.flex = `${editorRatio}`;
      previewPanel.style.flex = `${1 - editorRatio}`;
    }
  }

  console.log('SolteX: Split panel initialized ✅');
}
