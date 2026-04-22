// server/routes/projects.js
// SolteX -- Project Management API Routes (Phase 4)

import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { initRepo } from '../utils/gitManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_DIR = path.join(__dirname, '..', '..', 'projects');
const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates');

const router = Router();

/**
 * GET /api/projects/templates
 * List all available templates.
 */
router.get('/templates', async (req, res) => {
  try {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
    const entries = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
    const templates = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      let meta = { name: entry.name, description: '', category: 'General', icon: '\u{1F4C4}' };
      try {
        const raw = await fs.readFile(path.join(TEMPLATES_DIR, entry.name, 'template.json'), 'utf-8');
        meta = { ...meta, ...JSON.parse(raw) };
      } catch {}
      templates.push({ slug: entry.name, ...meta });
    }
    res.json({ templates });
  } catch { res.status(500).json({ error: 'Failed to list templates' }); }
});

/**
 * GET /api/projects
 * List all projects with metadata.
 */
router.get('/', async (req, res) => {
  try {
    await fs.mkdir(PROJECTS_DIR, { recursive: true });
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;

      const projectDir = path.join(PROJECTS_DIR, entry.name);
      const metaPath = path.join(projectDir, 'project.json');

      let metadata;
      try {
        metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      } catch {
        metadata = createDefaultMeta(entry.name);
        await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
      }

      const stat = await fs.stat(projectDir);
      projects.push({
        slug: entry.name,
        name: metadata.name || entry.name,
        mainFile: metadata.mainFile || 'main.tex',
        createdAt: metadata.createdAt || stat.birthtime.toISOString(),
        updatedAt: metadata.updatedAt || stat.mtime.toISOString(),
        tags: metadata.tags || [],
        archived: metadata.archived || false,
      });
    }

    projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json({ projects });
  } catch (err) {
    console.error('Error listing projects:', err);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

/**
 * POST /api/projects
 * Body: { name, template? }
 */
router.post('/', async (req, res) => {
  const { name, template } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const slug = name.trim().toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 64);

  if (!slug) return res.status(400).json({ error: 'Invalid project name' });

  const projectDir = path.join(PROJECTS_DIR, slug);

  try {
    await fs.access(projectDir);
    return res.status(409).json({ error: 'A project with this name already exists' });
  } catch { /* good -- doesn't exist */ }

  try {
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.join(projectDir, 'output'), { recursive: true });

    const metadata = createDefaultMeta(name.trim());
    await fs.writeFile(path.join(projectDir, 'project.json'), JSON.stringify(metadata, null, 2), 'utf-8');

    // Template support
    if (template) {
      const templateDir = path.resolve(TEMPLATES_DIR, template);
      if (templateDir.startsWith(path.resolve(TEMPLATES_DIR))) {
        try {
          await fs.cp(templateDir, projectDir, { recursive: true });
          await fs.rm(path.join(projectDir, 'template.json'), { force: true });
        } catch {
          await fs.writeFile(path.join(projectDir, 'main.tex'), getBlankTemplate(name.trim()), 'utf-8');
        }
      }
    } else {
      await fs.writeFile(path.join(projectDir, 'main.tex'), getBlankTemplate(name.trim()), 'utf-8');
    }

    // Initialize git repo for checkpoints (Phase 6)
    try { await initRepo(slug); } catch (e) { console.warn('Git init skipped:', e.message); }

    res.status(201).json({ slug, name: name.trim() });
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * GET /api/projects/:name
 * Get project metadata.
 */
router.get('/:name', async (req, res) => {
  const projectDir = path.resolve(PROJECTS_DIR, req.params.name);
  if (!projectDir.startsWith(path.resolve(PROJECTS_DIR))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const metaPath = path.join(projectDir, 'project.json');
    let metadata;
    try {
      metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    } catch {
      metadata = createDefaultMeta(req.params.name);
    }
    res.json({ slug: req.params.name, ...metadata });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/projects/:name
 * Update project metadata.
 */
router.put('/:name', async (req, res) => {
  const projectDir = path.resolve(PROJECTS_DIR, req.params.name);
  if (!projectDir.startsWith(path.resolve(PROJECTS_DIR))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const metaPath = path.join(projectDir, 'project.json');
    let metadata;
    try {
      metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    } catch {
      metadata = createDefaultMeta(req.params.name);
    }

    // Merge updates
    const updates = req.body;
    if (updates.name !== undefined) metadata.name = updates.name;
    if (updates.mainFile !== undefined) metadata.mainFile = updates.mainFile;
    if (updates.tags !== undefined) metadata.tags = updates.tags;
    if (updates.archived !== undefined) metadata.archived = updates.archived;
    metadata.updatedAt = new Date().toISOString();

    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
    res.json({ success: true, ...metadata });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/projects/:name
 */
router.delete('/:name', async (req, res) => {
  const projectDir = path.resolve(PROJECTS_DIR, req.params.name);
  if (!projectDir.startsWith(path.resolve(PROJECTS_DIR))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await fs.rm(projectDir, { recursive: true, force: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Helpers --

function createDefaultMeta(name) {
  return {
    name,
    mainFile: 'main.tex',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    archived: false,
  };
}

function getBlankTemplate(title = 'Untitled Document') {
  return `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage[margin=1in]{geometry}

\\title{${title}}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}

Start writing here.

\\end{document}
`;
}

export default router;
