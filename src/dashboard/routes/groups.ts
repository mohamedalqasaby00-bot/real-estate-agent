import { Router } from 'express';
import { getAllGroups, addGroup, deleteGroup, getGroup, getGroupCategories, updateGroup } from '../../storage/index.js';

export const groupsRouter = Router();

groupsRouter.get('/', async (_req, res) => {
  try {
    res.json(await getAllGroups());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

groupsRouter.get('/categories', async (_req, res) => {
  try {
    res.json(await getGroupCategories());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

groupsRouter.post('/', async (req, res) => {
  const { name, url, category } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'name and url required' });
  }
  try {
    const group = await addGroup(name, url, category || '');
    res.status(201).json(group);
  } catch (err) {
    res.status(409).json({ error: 'Group URL already exists' });
  }
});

groupsRouter.put('/:id', async (req, res) => {
  try {
    const group = await getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    await updateGroup(req.params.id, req.body);
    res.json(await getGroup(req.params.id));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

groupsRouter.delete('/:id', async (req, res) => {
  try {
    const group = await getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    await deleteGroup(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
