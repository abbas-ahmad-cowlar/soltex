// src/js/fileTree.js
// SolteX -- File Tree Sidebar (Phase 4)

let treeContainer = null;
let currentProject = null;
let activeFile = null;
let onFileSelect = null;
let contextTarget = null;

/**
 * Initialize the file tree.
 */
export async function initFileTree(project, onSelect) {
  currentProject = project;
  onFileSelect = onSelect;
  treeContainer = document.getElementById('file-tree');
  if (!treeContainer) return;

  await refreshTree();
  setupContextMenu();
  setupDragAndDrop();
  setupFileToolbar();

  // Sidebar toggle
  const btn = document.getElementById('btn-toggle-sidebar');
  if (btn) btn.addEventListener('click', () => {
    document.getElementById('file-sidebar').classList.toggle('collapsed');
  });

  // Ctrl+B toggle
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      document.getElementById('file-sidebar').classList.toggle('collapsed');
    }
  });

  console.log(`SolteX: File tree initialized (${project})`);
}

export async function refreshTree() {
  if (!treeContainer || !currentProject) return;
  try {
    const res = await fetch(`/api/projects/${currentProject}/files`);
    const data = await res.json();
    renderTree(data.tree);
  } catch (err) {
    console.error('File tree error:', err);
    treeContainer.innerHTML = '<p class="tree-error">Failed to load files</p>';
  }
}

export function setActiveFile(filePath) {
  activeFile = filePath;
  if (!treeContainer) return;
  treeContainer.querySelectorAll('.tree-row').forEach(r => {
    r.classList.toggle('active', r.dataset.path === filePath);
  });
}

// -- Rendering --

function renderTree(items) {
  treeContainer.innerHTML = '';
  treeContainer.appendChild(createTreeLevel(items, 0));
}

function createTreeLevel(items, depth) {
  const ul = document.createElement('ul');
  ul.className = 'tree-level';
  if (depth > 0) ul.style.paddingLeft = '16px';

  for (const item of items) {
    const li = document.createElement('li');
    li.className = `tree-item tree-${item.type}`;

    const row = document.createElement('div');
    row.className = 'tree-row';
    row.dataset.path = item.path;
    row.dataset.type = item.type;

    if (item.type === 'folder') {
      const arrow = document.createElement('span');
      arrow.className = 'tree-arrow';
      arrow.textContent = String.fromCharCode(9662); // down triangle
      row.appendChild(arrow);

      row.addEventListener('click', () => {
        li.classList.toggle('collapsed');
        arrow.textContent = li.classList.contains('collapsed')
          ? String.fromCharCode(9656) // right
          : String.fromCharCode(9662); // down
      });
    }

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = item.type === 'folder' ? String.fromCharCode(128193) : getFileIcon(item.name);
    row.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'tree-name';
    name.textContent = item.name;
    row.appendChild(name);

    if (item.type === 'file') {
      row.addEventListener('click', () => selectFile(item.path, row));
    }

    // Context menu
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextTarget = { path: item.path, type: item.type, element: row };
      showContextMenu(e.clientX, e.clientY);
    });

    if (activeFile === item.path) row.classList.add('active');

    li.appendChild(row);

    if (item.type === 'folder' && item.children) {
      li.appendChild(createTreeLevel(item.children, depth + 1));
    }

    ul.appendChild(li);
  }

  return ul;
}

function selectFile(filePath, rowEl) {
  treeContainer.querySelectorAll('.tree-row.active').forEach(r => r.classList.remove('active'));
  rowEl.classList.add('active');
  activeFile = filePath;
  if (onFileSelect) onFileSelect(filePath);
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    tex: String.fromCodePoint(128221), // memo
    bib: String.fromCodePoint(128218), // books
    sty: String.fromCodePoint(127912), // palette
    cls: String.fromCodePoint(128203), // clipboard
    png: String.fromCodePoint(128444), // frame
    jpg: String.fromCodePoint(128444),
    pdf: String.fromCodePoint(128213), // book
    txt: String.fromCodePoint(128196), // page
    md: String.fromCodePoint(128221),
  };
  return map[ext] || String.fromCodePoint(128196);
}

// -- Context Menu --

function setupContextMenu() {
  const menu = document.getElementById('context-menu');
  if (!menu) return;

  document.addEventListener('click', () => hideContextMenu());

  menu.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    hideContextMenu();

    switch (action) {
      case 'new-file': {
        const name = prompt('File name:');
        if (!name) return;
        const fp = contextTarget?.type === 'folder' ? `${contextTarget.path}/${name}` : name;
        await fetch(`/api/projects/${currentProject}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fp, type: 'file' }),
        });
        await refreshTree();
        break;
      }
      case 'new-folder': {
        const name = prompt('Folder name:');
        if (!name) return;
        const fp = contextTarget?.type === 'folder' ? `${contextTarget.path}/${name}` : name;
        await fetch(`/api/projects/${currentProject}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fp, type: 'folder' }),
        });
        await refreshTree();
        break;
      }
      case 'rename': {
        if (!contextTarget) return;
        const oldName = contextTarget.path.split('/').pop();
        const newName = prompt('New name:', oldName);
        if (!newName || newName === oldName) return;
        const parent = contextTarget.path.includes('/')
          ? contextTarget.path.substring(0, contextTarget.path.lastIndexOf('/'))
          : '';
        const newPath = parent ? `${parent}/${newName}` : newName;
        await fetch(`/api/projects/${currentProject}/files`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath: contextTarget.path, newPath }),
        });
        await refreshTree();
        break;
      }
      case 'delete': {
        if (!contextTarget) return;
        if (!confirm(`Delete "${contextTarget.path}"? This cannot be undone.`)) return;
        await fetch(`/api/projects/${currentProject}/files`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: contextTarget.path }),
        });
        await refreshTree();
        break;
      }
    }
  });
}

function showContextMenu(x, y) {
  const menu = document.getElementById('context-menu');
  if (!menu) return;
  menu.style.display = 'block';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
}

function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  if (menu) menu.style.display = 'none';
  contextTarget = null;
}

// -- Drag & Drop --

function setupDragAndDrop() {
  const sidebar = document.getElementById('file-sidebar');
  if (!sidebar) return;

  sidebar.addEventListener('dragover', (e) => {
    e.preventDefault();
    sidebar.classList.add('drag-over');
  });
  sidebar.addEventListener('dragleave', () => sidebar.classList.remove('drag-over'));
  sidebar.addEventListener('drop', async (e) => {
    e.preventDefault();
    sidebar.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    // Determine target folder
    const targetRow = e.target.closest('.tree-row');
    let targetDir = '';
    if (targetRow && targetRow.dataset.type === 'folder') {
      targetDir = targetRow.dataset.path;
    }

    // ZIP auto-extract
    if (files.length === 1 && files[0].name.endsWith('.zip')) {
      const formData = new FormData();
      formData.append('file', files[0]);
      await fetch(`/api/projects/${currentProject}/upload-zip`, { method: 'POST', body: formData });
    } else {
      const formData = new FormData();
      for (const file of files) formData.append('files', file);
      await fetch(`/api/projects/${currentProject}/upload?dir=${encodeURIComponent(targetDir)}`, {
        method: 'POST', body: formData,
      });
    }

    await refreshTree();
  });
}

// -- File Toolbar --

function setupFileToolbar() {
  // New File
  const btnNewFile = document.getElementById('btn-new-file');
  if (btnNewFile) {
    btnNewFile.addEventListener('click', async () => {
      const name = prompt('File name (e.g. chapter1.tex, refs.bib, style.sty):');
      if (!name) return;
      await fetch(`/api/projects/${currentProject}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: name, type: 'file' }),
      });
      await refreshTree();
    });
  }

  // New Folder
  const btnNewFolder = document.getElementById('btn-new-folder');
  if (btnNewFolder) {
    btnNewFolder.addEventListener('click', async () => {
      const name = prompt('Folder name (e.g. chapters, images, appendices):');
      if (!name) return;
      await fetch(`/api/projects/${currentProject}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: name, type: 'folder' }),
      });
      await refreshTree();
    });
  }

  // Upload Files
  const btnUpload = document.getElementById('btn-upload-files');
  const uploadInput = document.getElementById('upload-files-input');
  if (btnUpload && uploadInput) {
    btnUpload.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', async () => {
      if (!uploadInput.files.length) return;
      const formData = new FormData();
      for (const file of uploadInput.files) formData.append('files', file);
      await fetch(`/api/projects/${currentProject}/upload`, {
        method: 'POST', body: formData,
      });
      uploadInput.value = '';
      await refreshTree();
    });
  }

  // Import ZIP
  const btnZip = document.getElementById('btn-import-zip');
  const zipInput = document.getElementById('upload-zip-input');
  if (btnZip && zipInput) {
    btnZip.addEventListener('click', () => zipInput.click());
    zipInput.addEventListener('change', async () => {
      if (!zipInput.files.length) return;
      const formData = new FormData();
      formData.append('file', zipInput.files[0]);
      await fetch(`/api/projects/${currentProject}/upload-zip`, {
        method: 'POST', body: formData,
      });
      zipInput.value = '';
      await refreshTree();
    });
  }

  // Open in Explorer
  const btnExplorer = document.getElementById('btn-open-explorer');
  if (btnExplorer) {
    btnExplorer.addEventListener('click', async () => {
      await fetch(`/api/projects/${currentProject}/open-explorer`, { method: 'POST' });
    });
  }
}
