import { Router } from 'express';
import { getAllHistory } from '../../storage/index.js';

export const logsRouter = Router();

logsRouter.get('/', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  res.json(getAllHistory(limit));
});
