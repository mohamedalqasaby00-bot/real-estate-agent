import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY || ''
);

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '').replace(/\?.*$/, '').replace(/\/posts\/\d+$/, '');
}

async function migrate() {
  const dbPath = path.resolve(__dirname, '../data/agent.db');
  if (!fs.existsSync(dbPath)) {
    console.error('❌ agent.db not found');
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Migrate groups
  const groups = db.exec('SELECT * FROM groups')[0];
  if (groups) {
    console.log(`📁 Found ${groups.values.length} groups`);
    let imported = 0;
    let skipped = 0;

    for (const row of groups.values) {
      const [id, name, url, category, created_at, updated_at] = row;
      const normalizedUrl = normalizeUrl(String(url));

      const { data: existing } = await supabase
        .from('groups')
        .select('id')
        .eq('url', normalizedUrl)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from('groups').insert({
        id: String(id) || uuid(),
        name: String(name),
        url: normalizedUrl,
        category: String(category || ''),
        created_at: String(created_at) || new Date().toISOString(),
        updated_at: String(updated_at) || new Date().toISOString(),
      });

      if (error) {
        console.error(`❌ ${name}: ${error.message}`);
      } else {
        imported++;
      }
    }

    console.log(`✅ Groups: ${imported} imported, ${skipped} skipped`);
  }

  // Migrate settings
  const settings = db.exec('SELECT * FROM settings')[0];
  if (settings) {
    console.log(`⚙️ Found ${settings.values.length} settings`);
    const updates = settings.values.map(([key, value]) => ({ key: String(key), value: String(value) }));
    if (updates.length) {
      const { error } = await supabase.from('settings').upsert(updates);
      if (error) console.error(`❌ Settings: ${error.message}`);
      else console.log(`✅ Settings migrated`);
    }
  }

  db.close();
  console.log('\n🎉 Migration complete!');
}

migrate().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
