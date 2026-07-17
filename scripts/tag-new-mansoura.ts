import { initDb, runMigrations, getAllGroups, updateGroup, saveDb } from '../src/storage/index.js';

await initDb();
runMigrations();

const groups = getAllGroups();
let updated = 0;

for (const g of groups) {
  if (g.name.match(/المنصور[هة] الجدي[ده]/)) {
    updateGroup(g.id, { category: 'المنصورة الجديدة' });
    updated++;
    console.log(`✅ ${g.name}`);
  }
}

saveDb();
console.log(`\n📊 Updated ${updated} groups to category "المنصورة الجديدة"`);
