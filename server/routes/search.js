// server/routes/search.js
// SolteX -- Project-wide Search (Phase 5, Feature 5.3)

import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_DIR = path.join(__dirname, '..', '..', 'projects');

const router = Router();

const SEARCHABLE_EXTS = new Set([
  '.tex', '.bib', '.sty', '.cls', '.txt', '.md', '.csv', '.bst',
  '.dtx', '.ins', '.ltx', '.tikz', '.py', '.js', '.json', '.cfg',
]);

const MAX_RESULTS = 200;

/**
 * GET /api/projects/:project/search?q=<query>&caseSensitive=true&regex=true
 */
router.get('/:project/search', async (req, res) => {
  const { project } = req.params;
  const { q, caseSensitive, regex } = req.query;
  if (!q || !q.trim()) return res.json({ results: [], total: 0 });

  const projectDir = path.resolve(PROJECTS_DIR, project);
  if (!projectDir.startsWith(path.resolve(PROJECTS_DIR))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const results = [];
    await searchDir(projectDir, projectDir, q, {
      caseSensitive: caseSensitive === 'true',
      regex: regex === 'true',
    }, results);
    res.json({ results: results.slice(0, MAX_RESULTS), total: results.length });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

async function searchDir(baseDir, dir, query, opts, results) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return; }

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'output' || entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await searchDir(baseDir, fullPath, query, opts, results);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (!SEARCHABLE_EXTS.has(ext)) continue;
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        searchInFile(content, relPath, query, opts, results);
      } catch {}
    }
    if (results.length >= MAX_RESULTS * 2) return;
  }
}

function searchInFile(content, filePath, query, opts, results) {
  const lines = content.split('\n');
  let pattern;
  try {
    const src = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pattern = new RegExp(src, opts.caseSensitive ? 'g' : 'gi');
  } catch {
    const src = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pattern = new RegExp(src, 'gi');
  }

  for (let i = 0; i < lines.length; i++) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(lines[i])) !== null) {
      results.push({
        file: filePath,
        line: i + 1,
        column: match.index,
        context: lines[i].trim().substring(0, 200),
        matchLength: match[0].length,
      });
      if (results.length >= MAX_RESULTS * 2) return;
    }
  }
}

export default router;
