// server/routes/checkpoints.js
// SolteX -- Checkpoint API (Phase 6)

import { Router } from 'express';
import { initRepo, createCheckpoint, listCheckpoints, restoreCheckpoint, getDiff, updateCheckpointLabel } from '../utils/gitManager.js';

const router = Router();

/**
 * POST /api/projects/:project/checkpoint
 * Body: { message?: string }
 */
router.post('/:project/checkpoint', async (req, res) => {
  try {
    await initRepo(req.params.project);
    const result = await createCheckpoint(req.params.project, req.body.message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/projects/:project/checkpoints
 */
router.get('/:project/checkpoints', async (req, res) => {
  try {
    await initRepo(req.params.project);
    const checkpoints = await listCheckpoints(req.params.project);
    res.json({ checkpoints });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/projects/:project/restore
 * Body: { hash: string }
 */
router.post('/:project/restore', async (req, res) => {
  const { hash } = req.body;
  if (!hash) return res.status(400).json({ error: 'Hash is required' });
  try {
    const result = await restoreCheckpoint(req.params.project, hash);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/projects/:project/diff?from=abc&to=def
 */
router.get('/:project/diff', async (req, res) => {
  const { from, to } = req.query;
  if (!from) return res.status(400).json({ error: 'From hash is required' });
  try {
    const diff = await getDiff(req.params.project, from, to);
    res.json({ diff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/projects/:project/checkpoint/:hash
 * Body: { label: string }
 */
router.put('/:project/checkpoint/:hash', async (req, res) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: 'Label is required' });
  try {
    const result = await updateCheckpointLabel(req.params.project, req.params.hash, label);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
