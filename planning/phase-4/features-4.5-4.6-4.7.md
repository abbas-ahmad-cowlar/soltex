# Features 4.5, 4.6, 4.7 — File Upload & Download

> **Phase**: 4 | **Features**: 5, 6, 7
> **Goal**: Drag-and-drop file upload into the file tree, ZIP upload with auto-extraction, and one-click project download as ZIP.
> **Estimated Effort**: 4–6 hours total
> **Dependencies**: Feature 4.3 (file tree), `multer` (npm), `archiver` (npm), `adm-zip` (npm).

---

## Feature 4.5 — Drag-and-Drop File Upload

### Step 1: Backend — Upload Endpoint

```javascript
// server/routes/upload.js
import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();
const PROJECTS_DIR = path.resolve(process.cwd(), 'projects');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per file
});

/**
 * POST /api/projects/:project/upload
 * Accepts multipart/form-data with files.
 * Query: ?dir=images (optional subdirectory)
 */
router.post('/:project/upload', upload.array('files', 20), async (req, res) => {
  const { project } = req.params;
  const targetDir = req.query.dir || ''; // Subdirectory to upload into
  const projectDir = path.resolve(PROJECTS_DIR, project);
  const uploadDir = path.resolve(projectDir, targetDir);

  // Path traversal check
  if (!uploadDir.startsWith(projectDir)) {
    return res.status(403).json({ error: 'Path traversal' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  try {
    await fs.mkdir(uploadDir, { recursive: true });

    const uploaded = [];
    for (const file of req.files) {
      const filePath = path.join(uploadDir, file.originalname);
      await fs.writeFile(filePath, file.buffer);
      uploaded.push(targetDir ? `${targetDir}/${file.originalname}` : file.originalname);
    }

    res.json({ success: true, files: uploaded });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});
```

### Step 2: Frontend — Drag-and-Drop Handler

Add to `fileTree.js`:

```javascript
/**
 * Set up drag-and-drop on the file tree container.
 */
function setupDragAndDrop() {
  const sidebar = document.getElementById('file-sidebar');

  sidebar.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sidebar.classList.add('drag-over');
  });

  sidebar.addEventListener('dragleave', (e) => {
    e.preventDefault();
    sidebar.classList.remove('drag-over');
  });

  sidebar.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    sidebar.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    // Determine target directory from drop target
    const targetRow = e.target.closest('.tree-row');
    let targetDir = '';
    if (targetRow && targetRow.dataset.type === 'folder') {
      targetDir = targetRow.dataset.path;
    }

    // Upload via FormData
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    try {
      const response = await fetch(
        `/api/projects/${currentProject}/upload?dir=${encodeURIComponent(targetDir)}`,
        { method: 'POST', body: formData }
      );
      const data = await response.json();
      console.log('Uploaded:', data.files);
      await refreshTree();
    } catch (err) {
      console.error('Upload failed:', err);
    }
  });
}
```

### CSS — Drop Zone Indicator
```css
.file-sidebar.drag-over {
  border-color: var(--accent-primary);
  background: rgba(124, 111, 247, 0.05);
}

.file-sidebar.drag-over::after {
  content: 'Drop files here';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(124, 111, 247, 0.1);
  color: var(--accent-primary);
  font-size: var(--font-size-md);
  font-weight: 600;
  pointer-events: none;
  z-index: 10;
}
```

---

## Feature 4.6 — Upload ZIP (Auto-Extract)

### Backend Endpoint

```javascript
import AdmZip from 'adm-zip';

/**
 * POST /api/projects/:project/upload-zip
 * Accepts a single .zip file and extracts it into the project.
 */
router.post('/:project/upload-zip', upload.single('file'), async (req, res) => {
  const { project } = req.params;
  const projectDir = path.resolve(PROJECTS_DIR, project);

  if (!projectDir.startsWith(PROJECTS_DIR)) {
    return res.status(403).json({ error: 'Path traversal' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!req.file.originalname.endsWith('.zip')) {
    return res.status(400).json({ error: 'Only .zip files are supported' });
  }

  try {
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();

    for (const entry of entries) {
      // Skip directories (they're created automatically)
      if (entry.isDirectory) continue;

      // Security: Prevent path traversal in zip entries
      const entryPath = path.resolve(projectDir, entry.entryName);
      if (!entryPath.startsWith(projectDir)) {
        console.warn(`ZIP traversal blocked: ${entry.entryName}`);
        continue;
      }

      // Create parent directory
      await fs.mkdir(path.dirname(entryPath), { recursive: true });
      // Write file
      await fs.writeFile(entryPath, entry.getData());
    }

    res.json({ success: true, count: entries.filter(e => !e.isDirectory).length });
  } catch (err) {
    console.error('ZIP extraction error:', err);
    res.status(500).json({ error: 'ZIP extraction failed' });
  }
});
```

### Frontend
When a `.zip` file is dropped, detect it and call the zip endpoint instead:
```javascript
// In drop handler:
if (files.length === 1 && files[0].name.endsWith('.zip')) {
  const formData = new FormData();
  formData.append('file', files[0]);
  await fetch(`/api/projects/${currentProject}/upload-zip`, {
    method: 'POST', body: formData,
  });
} else {
  // Regular file upload (Feature 4.5)
}
```

---

## Feature 4.7 — Download Project as ZIP

### Backend Endpoint

```javascript
import archiver from 'archiver';

/**
 * GET /api/projects/:project/download
 * Streams the project directory as a .zip file.
 */
router.get('/:project/download', async (req, res) => {
  const { project } = req.params;
  const projectDir = path.resolve(PROJECTS_DIR, project);

  if (!projectDir.startsWith(PROJECTS_DIR)) {
    return res.status(403).json({ error: 'Path traversal' });
  }

  try {
    // Check project exists
    await fs.access(projectDir);
  } catch {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Set response headers for ZIP download
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${project}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  // Add project directory contents (excluding output/ and project.json)
  archive.glob('**/*', {
    cwd: projectDir,
    ignore: ['output/**', 'project.json', '.git/**'],
    dot: false,
  });

  archive.finalize();
});
```

### Frontend
```javascript
document.getElementById('btn-download').addEventListener('click', () => {
  window.location.href = `/api/projects/${currentProject}/download`;
});
```

Add a toolbar button:
```html
<button id="btn-download" class="btn btn-toolbar" title="Download project as ZIP">
  <span class="btn-icon">⬇</span>
  <span class="btn-text">ZIP</span>
</button>
```

---

## Edge Cases

- **Large file upload (50MB)**: Multer limits enforce the cap. Show an error if exceeded.
- **ZIP with nested directories**: `adm-zip` handles them. Path traversal in zip entries (e.g., `../../etc/passwd`) is explicitly blocked.
- **ZIP with existing files**: Overwrites silently. Phase 5+ could add a confirmation.
- **Download excludes output/**: Only source files are included in the ZIP.
- **Empty project download**: Creates a ZIP with no files. Valid ZIP, just empty.

---

## npm Dependencies

```bash
npm install multer archiver adm-zip
```

---

## Final Checklist — Features 4.5, 4.6, 4.7

| # | Check | Status |
|---|-------|--------|
| 1 | Drag files from desktop into sidebar → files appear in tree | ☐ |
| 2 | Drop onto a folder → files upload into that folder | ☐ |
| 3 | Drop zone indicator (blue border) shows during drag | ☐ |
| 4 | Upload a `.zip` → contents extracted into project | ☐ |
| 5 | ZIP with nested folders → directory structure preserved | ☐ |
| 6 | ZIP path traversal entries are blocked | ☐ |
| 7 | "Download ZIP" button downloads project as `.zip` | ☐ |
| 8 | Downloaded ZIP excludes `output/` and `project.json` | ☐ |
| 9 | File size limit (50MB) enforced | ☐ |
| 10 | File tree refreshes after upload | ☐ |

> **Done → Proceed to Features 4.8–4.11.**
