// server/routes/files.js
// SolteX -- File Management API Routes (Phase 4: Enhanced)

import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import archiver from 'archiver';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_DIR = path.join(__dirname, '..', '..', 'projects');

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const EXCLUDED = new Set(['output', 'project.json', '.git', 'node_modules', '_draft_wrapper.tex']);

function validatePath(base, relative) {
  const resolved = path.resolve(base, relative);
  if (!resolved.startsWith(path.resolve(base))) throw new Error('Path traversal');
  return resolved;
}

// -- Phase 1 compatibility routes --

/**
 * GET /api/file?path=projects/sample/main.tex
 */
router.get('/file', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'Missing path' });
    const relativePath = filePath.replace(/^projects\//, '');
    const absolutePath = validatePath(PROJECTS_DIR, relativePath);
    const content = await fs.readFile(absolutePath, 'utf-8');
    res.type('text/plain').send(content);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/file
 */
router.post('/file', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) return res.status(400).json({ error: 'Missing path or content' });
    const relativePath = filePath.replace(/^projects\//, '');
    const absolutePath = validatePath(PROJECTS_DIR, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf-8');
    res.json({ success: true, path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Phase 4: File tree listing --

/**
 * GET /api/projects/:project/files
 */
router.get('/projects/:project/files', async (req, res) => {
  const projectDir = path.resolve(PROJECTS_DIR, req.params.project);
  if (!projectDir.startsWith(path.resolve(PROJECTS_DIR))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const tree = await buildTree(projectDir, '');
    res.json({ tree });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

async function buildTree(baseDir, relativePath) {
  const fullPath = path.join(baseDir, relativePath);
  let entries;
  try { entries = await fs.readdir(fullPath, { withFileTypes: true }); }
  catch { return []; }

  const sorted = entries
    .filter(e => !EXCLUDED.has(e.name) && !e.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const result = [];
  for (const entry of sorted) {
    const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.push({ name: entry.name, path: entryPath, type: 'folder', children: await buildTree(baseDir, entryPath) });
    } else {
      result.push({ name: entry.name, path: entryPath, type: 'file' });
    }
  }
  return result;
}

// -- Phase 4: File/Folder CRUD --

/**
 * POST /api/projects/:project/files
 * Body: { path, type: 'file'|'folder', content? }
 */
router.post('/projects/:project/files', async (req, res) => {
  const projectDir = path.resolve(PROJECTS_DIR, req.params.project);
  const { path: filePath, type, content = '' } = req.body;
  try {
    const targetPath = validatePath(projectDir, filePath);
    if (type === 'folder') {
      await fs.mkdir(targetPath, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, 'utf-8');
    }
    await touchProject(projectDir);
    res.status(201).json({ success: true, path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/projects/:project/files
 * Body: { oldPath, newPath }
 */
router.put('/projects/:project/files', async (req, res) => {
  const projectDir = path.resolve(PROJECTS_DIR, req.params.project);
  const { oldPath, newPath } = req.body;
  try {
    const oldFull = validatePath(projectDir, oldPath);
    const newFull = validatePath(projectDir, newPath);
    await fs.rename(oldFull, newFull);
    await touchProject(projectDir);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/projects/:project/files
 * Body: { path }
 */
router.delete('/projects/:project/files', async (req, res) => {
  const projectDir = path.resolve(PROJECTS_DIR, req.params.project);
  const { path: filePath } = req.body;
  try {
    const targetPath = validatePath(projectDir, filePath);
    if (targetPath === path.resolve(projectDir)) {
      return res.status(400).json({ error: 'Cannot delete project root' });
    }
    await fs.rm(targetPath, { recursive: true, force: true });
    await touchProject(projectDir);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Phase 4: Upload/Download --

/**
 * POST /api/projects/:project/upload
 */
router.post('/projects/:project/upload', upload.array('files', 20), async (req, res) => {
  const projectDir = path.resolve(PROJECTS_DIR, req.params.project);
  const targetDir = req.query.dir || '';
  try {
    const uploadDir = validatePath(projectDir, targetDir);
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files' });
    await fs.mkdir(uploadDir, { recursive: true });
    const uploaded = [];
    for (const file of req.files) {
      await fs.writeFile(path.join(uploadDir, file.originalname), file.buffer);
      uploaded.push(targetDir ? `${targetDir}/${file.originalname}` : file.originalname);
    }
    await touchProject(projectDir);
    res.json({ success: true, files: uploaded });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/projects/:project/upload-zip
 */
router.post('/projects/:project/upload-zip', upload.single('file'), async (req, res) => {
  const projectDir = path.resolve(PROJECTS_DIR, req.params.project);
  if (!projectDir.startsWith(path.resolve(PROJECTS_DIR))) return res.status(403).json({ error: 'Access denied' });
  if (!req.file) return res.status(400).json({ error: 'No file' });

  try {
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();
    let count = 0;
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const entryPath = path.resolve(projectDir, entry.entryName);
      if (!entryPath.startsWith(path.resolve(projectDir))) continue; // block traversal
      await fs.mkdir(path.dirname(entryPath), { recursive: true });
      await fs.writeFile(entryPath, entry.getData());
      count++;
    }
    await touchProject(projectDir);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: 'ZIP extraction failed' });
  }
});

/**
 * GET /api/projects/:project/download
 */
router.get('/projects/:project/download', async (req, res) => {
  const projectDir = path.resolve(PROJECTS_DIR, req.params.project);
  if (!projectDir.startsWith(path.resolve(PROJECTS_DIR))) return res.status(403).json({ error: 'Access denied' });

  try {
    await fs.access(projectDir);
  } catch { return res.status(404).json({ error: 'Project not found' }); }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.project}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);
  archive.glob('**/*', { cwd: projectDir, ignore: ['output/**', 'project.json', '.git/**'], dot: false });
  archive.finalize();
});

/**
 * POST /api/projects/:project/open-explorer
 * Opens the project folder in the system file explorer.
 */
router.post('/projects/:project/open-explorer', async (req, res) => {
  const projectDir = path.resolve(PROJECTS_DIR, req.params.project);
  if (!projectDir.startsWith(path.resolve(PROJECTS_DIR))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const { exec } = await import('child_process');
    exec(`explorer "${projectDir}"`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Helper --

async function touchProject(projectDir) {
  const metaPath = path.join(projectDir, 'project.json');
  try {
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    meta.updatedAt = new Date().toISOString();
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  } catch {}
}

export default router;
