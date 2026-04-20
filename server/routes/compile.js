// server/routes/compile.js
// SolteX -- Compilation API Route (Phase 3: Enhanced)

import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileLaTeX, cleanProject } from '../utils/latex.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_DIR = path.join(__dirname, '..', '..', 'projects');

const router = Router();

let isCompiling = false;

/**
 * POST /api/compile
 * Body: { projectPath, mainFile, draft }
 */
router.post('/compile', async (req, res) => {
  if (isCompiling) {
    return res.status(409).json({ success: false, error: 'Compilation already in progress.' });
  }

  try {
    isCompiling = true;
    const { projectPath, mainFile = 'main.tex', draft = false } = req.body;

    if (!projectPath) {
      isCompiling = false;
      return res.status(400).json({ success: false, error: 'Missing "projectPath"' });
    }

    const relativePath = projectPath.replace(/^projects\//, '');
    const absoluteProjectDir = path.resolve(PROJECTS_DIR, relativePath);

    if (!absoluteProjectDir.startsWith(path.resolve(PROJECTS_DIR))) {
      isCompiling = false;
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const mode = draft ? ' (draft)' : '';
    console.log(`Compiling: ${relativePath}/${mainFile}${mode}`);

    // Read per-project TeX engine (Phase 7)
    let texEngine = 'pdflatex';
    try {
      const fs = await import('fs/promises');
      const meta = JSON.parse(await fs.default.readFile(path.join(absoluteProjectDir, 'project.json'), 'utf-8'));
      if (meta.texEngine) texEngine = meta.texEngine;
    } catch {}

    const result = await compileLaTeX(absoluteProjectDir, mainFile, { draft, texEngine });

    let pdfUrl = null;
    if (result.pdfPath) {
      const pdfName = draft ? '_draft_wrapper.pdf' : mainFile.replace(/\.tex$/, '.pdf');
      pdfUrl = `/output/${relativePath}/output/${pdfName}`;
    }

    const sec = (result.duration / 1000).toFixed(1);
    console.log(`${result.success ? 'OK' : 'FAIL'} in ${sec}s`);

    res.json({
      success: result.success,
      pdfUrl,
      log: result.log,
      duration: result.duration,
    });
  } catch (err) {
    console.error('Compilation error:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    isCompiling = false;
  }
});

/**
 * POST /api/compile/clean
 * Body: { projectPath }
 */
router.post('/compile/clean', async (req, res) => {
  try {
    const { projectPath } = req.body;
    if (!projectPath) {
      return res.status(400).json({ success: false, error: 'Missing "projectPath"' });
    }

    const relativePath = projectPath.replace(/^projects\//, '');
    const absoluteProjectDir = path.resolve(PROJECTS_DIR, relativePath);

    if (!absoluteProjectDir.startsWith(path.resolve(PROJECTS_DIR))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    await cleanProject(absoluteProjectDir);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
