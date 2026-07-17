import { Router } from 'express';
import { getAllGroups, addGroup, deleteGroup, getGroup, getGroupCategories, updateGroup } from '../../storage/index.js';

export const groupsRouter = Router();

groupsRouter.get('/', (_req, res) => {
  res.json(getAllGroups());
});

groupsRouter.get('/categories', (_req, res) => {
  res.json(getGroupCategories());
});

groupsRouter.post('/', (req, res) => {
  const { name, url, category } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'name and url required' });
  }
  try {
    const group = addGroup(name, url, category || '');
    res.status(201).json(group);
  } catch (err) {
    res.status(409).json({ error: 'Group URL already exists' });
  }
});

groupsRouter.put('/:id', (req, res) => {
  const group = getGroup(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  updateGroup(req.params.id, req.body);
  res.json(getGroup(req.params.id));
});

groupsRouter.delete('/:id', (req, res) => {
  const group = getGroup(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  deleteGroup(req.params.id);
  res.json({ success: true });
});
