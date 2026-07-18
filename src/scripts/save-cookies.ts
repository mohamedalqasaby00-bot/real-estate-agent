import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cookiesPath = path.join(__dirname, '../../data/facebook-cookies.json');
const cookies = fs.readFileSync(cookiesPath, 'utf-8');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vhfgpmpmkctzpwxtbogi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';

async function main() {
  const cookiesJson = JSON.parse(cookies);

  // Delete old
  await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.facebook_cookies`, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  console.log('Deleted old entry');

  // Insert
  const r = await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ key: 'facebook_cookies', value: cookies }),
  });

  const data = await r.json();
  console.log(`Inserted: status ${r.status}`);
  console.log(`Value type: ${typeof data[0]?.value}`);
  console.log(`Value length: ${data[0]?.value?.length}`);

  // Verify by reading back
  const verify = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.facebook_cookies&select=value`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  const vData = await verify.json();
  const parsed = JSON.parse(vData[0].value);
  console.log(`Verified: ${parsed.cookies.length} cookies`);
  console.log('Cookie names:', parsed.cookies.map((c: any) => c.name).join(', '));
}

main().catch(console.error);
