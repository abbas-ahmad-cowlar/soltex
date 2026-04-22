// server/routes/wordcount.js
// SolteX -- Word Count (Phase 5, Feature 5.9)

import { Router } from 'express';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_DIR = path.join(__dirname, '..', '..', 'projects');

const router = Router();

/**
 * GET /api/projects/:project/wordcount?file=main.tex
 */
router.get('/:project/wordcount', (req, res) => {
  const { project } = req.params;
  const file = req.query.file || 'main.tex';
  const projectDir = path.resolve(PROJECTS_DIR, project);

  if (!projectDir.startsWith(path.resolve(PROJECTS_DIR))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const filePath = path.join(projectDir, file);

  execFile('texcount', ['-1', '-sum', filePath], { timeout: 10000, cwd: projectDir }, (error, stdout) => {
    if (error) {
      // Fallback: naive word count
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return res.json({ words: naiveWordCount(content), method: 'naive' });
      } catch {
        return res.status(500).json({ error: 'Word count failed' });
      }
    }
    const words = parseInt(stdout.trim(), 10) || 0;
    res.json({ words, method: 'texcount' });
  });
});

function naiveWordCount(text) {
  const cleaned = text
    .replace(/%.*/g, '')
    .replace(/\\[a-zA-Z]+\*?(\{[^}]*\})*/g, '')
    .replace(/[{}$\\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length === 0 ? 0 : cleaned.split(/\s+/).length;
}

export default router;
