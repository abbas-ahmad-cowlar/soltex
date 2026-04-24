// server/utils/gitManager.js
// SolteX -- Centralized Git Operations (Phase 6)

import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_DIR = path.join(__dirname, '..', '..', 'projects');

/**
 * Get a simple-git instance for a project.
 */
export function getGit(project) {
  const dir = path.resolve(PROJECTS_DIR, project);
  return simpleGit(dir);
}

/**
 * Initialize a git repo for a project (idempotent).
 */
export async function initRepo(project) {
  const dir = path.resolve(PROJECTS_DIR, project);
  const gitDir = path.join(dir, '.git');

  try {
    await fs.access(gitDir);
    return; // Already initialized
  } catch {}

  const git = getGit(project);
  await git.init();

  // Create .gitignore
  const gitignore = `output/\n*.aux\n*.log\n*.synctex.gz\n*.fls\n*.fdb_latexmk\n*.bbl\n*.blg\n*.out\n*.toc\n*.lof\n*.lot\n_draft_wrapper.tex\n`;
  await fs.writeFile(path.join(dir, '.gitignore'), gitignore, 'utf-8');

  // Initial commit
  await git.add('.');
  await git.commit('Initial checkpoint');
  console.log(`Git initialized: ${project}`);
}

/**
 * Create a checkpoint (commit).
 */
export async function createCheckpoint(project, message = '') {
  const git = getGit(project);
  await git.add('.');

  const status = await git.status();
  if (status.files.length === 0) {
    return { created: false, reason: 'No changes to save' };
  }

  const label = message || `Checkpoint ${new Date().toLocaleString()}`;
  const result = await git.commit(label);
  return { created: true, hash: result.commit, message: label };
}

/**
 * List all checkpoints (git log).
 */
export async function listCheckpoints(project) {
  const git = getGit(project);
  try {
    const log = await git.log({ '--max-count': 100 });
    return log.all.map(entry => ({
      hash: entry.hash,
      shortHash: entry.hash.substring(0, 7),
      message: entry.message,
      date: entry.date,
      author: entry.author_name,
    }));
  } catch {
    return [];
  }
}

/**
 * Restore to a checkpoint (checkout).
 */
export async function restoreCheckpoint(project, hash) {
  const git = getGit(project);

  // Auto-save current state first
  await git.add('.');
  const status = await git.status();
  if (status.files.length > 0) {
    await git.commit(`Auto-save before restore to ${hash.substring(0, 7)}`);
  }

  // Restore
  await git.checkout(hash, ['--', '.']);
  return { restored: true, hash };
}

/**
 * Get diff between two commits (or working tree).
 */
export async function getDiff(project, fromHash, toHash) {
  const git = getGit(project);
  const args = [fromHash];
  if (toHash) args.push(toHash);
  const diff = await git.diff(args);
  return diff;
}

/**
 * Update a checkpoint's label using git notes.
 */
export async function updateCheckpointLabel(project, hash, label) {
  const git = getGit(project);
  await git.raw(['notes', 'add', '-f', '-m', label, hash]);
  return { updated: true };
}
