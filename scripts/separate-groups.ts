import fs from 'fs';
import { initDb, runMigrations, getAllGroups } from '../src/storage/index.js';

await initDb();
runMigrations();

const all = getAllGroups();
const newMansoura = all.filter(g => g.category === 'المنصورة الجديدة');
const rest = all.filter(g => g.category !== 'المنصورة الجديدة');

const toCSV = (groups: typeof all) => {
  const header = 'Name,URL,Category';
  const rows = groups.map(g => `"${g.name.replace(/"/g, '""')}","${g.url}","${g.category}"`);
  return [header, ...rows].join('\n');
};

fs.writeFileSync('output/new-mansoura-groups.csv', toCSV(newMansoura));
fs.writeFileSync('output/new-mansoura-groups.json', JSON.stringify(newMansoura, null, 2));
fs.writeFileSync('output/remaining-groups.csv', toCSV(rest));
fs.writeFileSync('output/remaining-groups.json', JSON.stringify(rest, null, 2));

console.log(`🏢 المنصورة الجديدة: ${newMansoura.length} جروب`);
console.log(`📋 الباقي: ${rest.length} جروب`);
console.log(`\n📁 ملفات تم إنشاؤها:`);
console.log(`   output/new-mansoura-groups.csv`);
console.log(`   output/new-mansoura-groups.json`);
console.log(`   output/remaining-groups.csv`);
console.log(`   output/remaining-groups.json`);
