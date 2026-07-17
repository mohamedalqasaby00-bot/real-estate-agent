import { Router } from 'express';
import { getSupabase } from '../../storage/index.js';
import { config } from '../../config/index.js';

export const settingsRouter = Router();

settingsRouter.get('/', async (_req, res) => {
  try {
    const { data } = await getSupabase().from('settings').select('*');
    const settings: Record<string, string> = {};
    (data || []).forEach((r: { key: string; value: string }) => { settings[r.key] = r.value; });
    settings._chrome_profile = config.chrome.userDataDir;
    settings._media_dir = config.media.dir;
    settings._supabase_url = config.supabase.url;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

settingsRouter.put('/', async (req, res) => {
  try {
    const updates = Object.entries(req.body)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, value]) => ({ key, value: String(value) }));
    if (updates.length) {
      await getSupabase().from('settings').upsert(updates);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
