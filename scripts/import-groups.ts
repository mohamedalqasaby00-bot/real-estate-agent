import fs from 'fs';
import path from 'path';
import { initDb, runMigrations, getAllGroups, addGroup, saveDb } from '../src/storage/index.js';

function extractId(url: string): string {
  const match = url.match(/\/groups\/(\d+)/);
  return match ? match[1] : url.split('/').pop() || '';
}

async function importGroups(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ الملف مش موجود: ${fullPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const urls = content.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && l.startsWith('http'));

  if (!urls.length) {
    console.error('❌ مافيش لينكات صالحة في الملف');
    process.exit(1);
  }

  console.log(`📄 لقيت ${urls.length} رابط`);

  await initDb();
  runMigrations();

  const existing = getAllGroups();
  const existingUrls = new Set(existing.map(g => g.url.replace(/\/$/, '')));

  let added = 0;
  let skipped = 0;

  for (const rawUrl of urls) {
    const url = rawUrl.replace(/\/$/, '').split('?')[0];
    if (existingUrls.has(url)) {
      skipped++;
      continue;
    }

    const id = extractId(url);
    addGroup(`Group ${id}`, url);
    existingUrls.add(url);
    added++;
  }

  saveDb();
  console.log(`📊 النتيجة: ${added} جديد + ${skipped} موجود = ${added + skipped}/${urls.length}`);
}

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('❌ استخدم: npx tsx scripts/import-groups.ts <مسار-الملف>');
  console.error('   الملف كل سطر فيه رابط مجموعة');
  process.exit(1);
}

importGroups(fileArg).catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
