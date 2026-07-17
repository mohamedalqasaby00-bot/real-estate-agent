import { initDb, runMigrations, getAllGroups, updateGroup, saveDb } from '../src/storage/index.js';

await initDb();
runMigrations();

const groups = getAllGroups();
let updated = 0;

for (const g of groups) {
  if (g.category === 'Public' || g.category === 'Private') {
    updateGroup(g.id, { category: '' });
    updated++;
  }
}

saveDb();
console.log(`✅ Cleared ${updated} groups from Public/Private categories`);
