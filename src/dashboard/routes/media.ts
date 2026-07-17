import { Router } from 'express';
import { listMedia, getMedia, deleteMedia, importMedia } from '../../media/index.js';

export const mediaRouter = Router();

mediaRouter.get('/', (_req, res) => {
  res.json(listMedia());
});

mediaRouter.get('/:id', (req, res) => {
  const entry = getMedia(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Media not found' });
  res.json(entry);
});

mediaRouter.post('/import', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath required' });
  try {
    const result = await importMedia(filePath);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mediaRouter.delete('/:id', (req, res) => {
  const entry = getMedia(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Media not found' });
  deleteMedia(req.params.id);
  res.json({ success: true });
});
