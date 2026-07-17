import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, runMigrations, getAllGroups, updateGroup, addGroup, saveDb } from '../src/storage/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ScrapedGroup {
  name: string;
  url: string;
  privacy: string;
  members: string;
}

function normalizeUrl(url: string): string {
  return url
    .replace(/\/$/, '')
    .replace(/\?.*$/, '')
    .replace(/\/posts\/\d+$/, '');
}

function extractGroupId(url: string): string {
  const match = url.match(/\/groups\/([^/?]+)/);
  return match ? match[1] : '';
}

async function main() {
  const jsonPath = path.resolve(__dirname, '../../facebook-agent/output/facebook_groups.json');
  const scraped: ScrapedGroup[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  console.log(`📄 Loaded ${scraped.length} scraped groups`);

  await initDb();
  runMigrations();

  const existing = getAllGroups();
  console.log(`📂 DB has ${existing.length} groups`);

  let updated = 0;
  let added = 0;
  let skipped = 0;

  const existingUrlMap = new Map<string, string>();
  for (const g of existing) {
    existingUrlMap.set(normalizeUrl(g.url), g.id);
  }

  const seen = new Set<string>();

  for (const s of scraped) {
    if (s.name === 'Home' || s.name === 'Groups' || s.name === 'Notifications') {
      skipped++;
      continue;
    }

    const norm = normalizeUrl(s.url);
    if (seen.has(norm)) {
      skipped++;
      continue;
    }
    seen.add(norm);

    const groupId = extractGroupId(s.url);
    if (!groupId) {
      skipped++;
      continue;
    }

    const existingId = existingUrlMap.get(norm);
    if (existingId) {
      updateGroup(existingId, { name: s.name, category: s.privacy || '' });
      updated++;
    } else {
      addGroup(s.name, s.url, s.privacy || '');
      added++;
    }
  }

  saveDb();
  console.log(`✅ Updated: ${updated}, Added: ${added}, Skipped: ${skipped}`);
}

main().catch(err => { console.error(err); process.exit(1); });
