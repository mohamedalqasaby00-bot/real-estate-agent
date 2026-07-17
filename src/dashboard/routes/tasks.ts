import { Router } from 'express';
import { getAllTasks, getTask, createTask, deleteTask } from '../../storage/index.js';

export const tasksRouter = Router();

tasksRouter.get('/', async (_req, res) => {
  try {
    res.json(await getAllTasks());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

tasksRouter.get('/:id', async (req, res) => {
  try {
    const task = await getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

tasksRouter.post('/', async (req, res) => {
  const { type, groupIds, textContent, mediaPaths, scheduledAt } = req.body;
  if (!groupIds || !textContent) {
    return res.status(400).json({ error: 'groupIds and textContent required' });
  }
  try {
    const task = await createTask(type || 'post', groupIds, textContent, mediaPaths || [], scheduledAt || null);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

tasksRouter.delete('/:id', async (req, res) => {
  try {
    const task = await getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    await deleteTask(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
