import { initDb, runMigrations, getAllGroups } from '../src/storage/index.js';

await initDb();
runMigrations();
const groups = getAllGroups();
console.log('Total:', groups.length);
const withNames = groups.filter(g => !g.name.match(/^(Group \d+|Home|Groups|Notifications)/));
console.log('Real names:', withNames.length);
console.log('Placeholders:', groups.length - withNames.length);
console.log('--- Sample ---');
for (const g of groups.slice(0, 5)) console.log(`${g.name} | ${g.category}`);
console.log('--- Last 5 ---');
for (const g of groups.slice(-5)) console.log(`${g.name} | ${g.category}`);
