import { Router } from 'express';
import { getAllHistory } from '../../storage/index.js';

export const logsRouter = Router();

logsRouter.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    res.json(await getAllHistory(limit));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
