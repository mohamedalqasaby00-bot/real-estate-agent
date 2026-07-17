import { Router } from 'express';
import { getAllTasks, getTask, createTask, deleteTask } from '../../storage/index.js';

export const tasksRouter = Router();

tasksRouter.get('/', (_req, res) => {
  res.json(getAllTasks());
});

tasksRouter.get('/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

tasksRouter.post('/', (req, res) => {
  const { type, groupIds, textContent, mediaPaths, scheduledAt } = req.body;
  if (!groupIds || !textContent) {
    return res.status(400).json({ error: 'groupIds and textContent required' });
  }
  const task = createTask(type || 'post', groupIds, textContent, mediaPaths || [], scheduledAt || null);
  res.status(201).json(task);
});

tasksRouter.delete('/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  deleteTask(req.params.id);
  res.json({ success: true });
});
