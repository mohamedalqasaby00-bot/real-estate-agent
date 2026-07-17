import { Router } from 'express';
import { queryAll, runSql } from '../../storage/index.js';
import { config } from '../../config/index.js';

export const settingsRouter = Router();

settingsRouter.get('/', (_req, res) => {
  const rows = queryAll<{ key: string; value: string }>('SELECT * FROM settings');
  const settings: Record<string, string> = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  settings._chrome_profile = config.chrome.userDataDir;
  settings._media_dir = config.media.dir;
  settings._db_path = config.db.path;
  res.json(settings);
});

settingsRouter.put('/', (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    if (key.startsWith('_')) continue;
    runSql('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
  }
  res.json({ success: true });
});
