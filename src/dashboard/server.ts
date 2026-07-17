import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { groupsRouter } from './routes/groups.js';
import { tasksRouter } from './routes/tasks.js';
import { mediaRouter } from './routes/media.js';
import { logsRouter } from './routes/logs.js';
import { settingsRouter } from './routes/settings.js';
import { startQueue } from '../scheduler/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startDashboard(): Promise<void> {
  const { initDb } = await import('../storage/index.js');
  initDb();

  const app = express();
  app.use(express.json());

  app.use('/api/groups', groupsRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/media', mediaRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/settings', settingsRouter);

  app.use(express.static(path.join(__dirname, 'public')));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  startQueue();

  app.listen(config.dashboard.port, () => {
    console.log(`📊 Dashboard: http://localhost:${config.dashboard.port}`);
  });
}

if (process.argv[1] && (process.argv[1].includes('server') || process.argv[1].includes('dashboard'))) {
  startDashboard().catch(err => {
    console.error('Dashboard error:', err);
    process.exit(1);
  });
}
