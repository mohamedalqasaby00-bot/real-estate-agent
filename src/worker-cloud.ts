import dotenv from 'dotenv';
dotenv.config();

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';
const REST = `${SUPABASE_URL}/rest/v1`;
const HEADERS = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

function downloadUrl(url: string, headers?: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    client.get(url, { headers: headers || {} }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadUrl(res.headers.location!, headers).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function supaQuery(table: string, filter?: string): Promise<any[]> {
  let url = `${REST}/${table}?select=*`;
  if (filter) url += `&${filter}`;
  const data = await downloadUrl(url, HEADERS);
  return JSON.parse(data);
}

async function supaUpdate(table: string, id: string, data: any) {
  const body = JSON.stringify(data);
  return new Promise<void>((resolve, reject) => {
    const parsedUrl = new URL(`${REST}/${table}?id=eq.${id}`);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.request(parsedUrl, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Content-Length': Buffer.byteLength(body).toString() },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve());
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function supaInsert(table: string, data: any) {
  const body = JSON.stringify(data);
  return new Promise<any>((resolve, reject) => {
    const parsedUrl = new URL(`${REST}/${table}`);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.request(parsedUrl, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Length': Buffer.byteLength(body).toString() },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location!, destPath).then(resolve).catch(reject);
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function postToGroup(page: any, groupUrl: string, text: string, mediaPaths: string[]): Promise<{ success: boolean; groupName: string; error?: string }> {
  try {
    await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    const groupName = await page.title();

    const composer = page.locator('div[role="textbox"]').first();
    if (await composer.isVisible()) {
      await composer.click();
      await page.waitForTimeout(1000);
      await composer.fill(text);
    } else {
      const pseudoComposer = page.locator('div[contenteditable="true"]').first();
      if (await pseudoComposer.isVisible()) {
        await pseudoComposer.click();
        await page.waitForTimeout(1000);
        await pseudoComposer.fill(text);
      } else {
        throw new Error('Could not find post composer');
      }
    }

    if (mediaPaths.length) {
      for (const mediaPath of mediaPaths) {
        const fileInput = page.locator('input[type="file"][accept*="image"], input[type="file"][accept*="video"]').first();
        if (await fileInput.isVisible()) {
          await fileInput.setInputFiles(mediaPath);
          await page.waitForTimeout(3000);
        }
      }
    }

    await page.waitForTimeout(2000);

    const postBtn = page.locator('div[aria-label="نشر"], div[aria-label*="Post"], div[role="button"]:has-text("نشر"), div[role="button"]:has-text("Post")').first();
    if (await postBtn.isVisible()) {
      await postBtn.click();
      await page.waitForTimeout(3000);
    } else {
      const submitBtn = page.locator('button[type="submit"]').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
      }
    }

    return { success: true, groupName };
  } catch (err: any) {
    return { success: false, groupName: groupUrl, error: err.message };
  }
}

function randomDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * (300000 - 180000 + 1)) + 180000;
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('🔄 GitHub Actions Worker starting...');

  // Load cookies from Supabase
  console.log('☁️  Loading cookies from Supabase...');
  const settings = await supaQuery('settings', 'key=eq.facebook_cookies&select=value');
  if (!settings.length || !settings[0].value) {
    console.error('❌ No Facebook cookies found in Supabase');
    process.exit(1);
  }

  const storageState = JSON.parse(settings[0].value);
  console.log(`✅ Loaded ${storageState.cookies.length} cookies`);

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    storageState,
    viewport: { width: 1366, height: 768 },
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
  });

  // Check login
  const page = await context.newPage();
  await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const url = page.url();
  if (url.includes('login') || url.includes('checkpoint')) {
    console.error('❌ Facebook session expired! Re-run export-cookies locally.');
    await browser.close();
    process.exit(1);
  }
  console.log('✅ Facebook login OK');
  await page.close();

  // Get pending tasks
  const tasks = await supaQuery('tasks', 'status=eq.pending&order=created_at');
  console.log(`📋 Found ${tasks.length} pending tasks`);

  if (tasks.length === 0) {
    console.log('✅ No tasks to process');
    await browser.close();
    process.exit(0);
  }

  // Process first task only (GitHub Actions runs every 15 min)
  const task = tasks[0];
  console.log(`🚀 Processing task ${task.id}: ${(task.text_content || '').slice(0, 50)}...`);

  // Claim task
  await supaUpdate('tasks', task.id, { status: 'running', locked_by: 'github-actions' });

  const groupIds: string[] = typeof task.group_ids === 'string' ? JSON.parse(task.group_ids) : task.group_ids;
  const mediaRaw: string[] = typeof task.media_paths === 'string' ? JSON.parse(task.media_paths) : (task.media_paths || []);

  // Get group URLs
  const groups = await supaQuery('groups', 'select=id,url,name');
  const groupMap = new Map(groups.map((g: any) => [g.id, g]));

  // Download media
  const mediaDir = '/tmp/media';
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
  const localMediaPaths: string[] = [];
  for (const item of mediaRaw) {
    if (item.startsWith('http')) {
      const ext = item.split('?')[0].split('.').pop() || 'jpg';
      const fileName = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const destPath = path.join(mediaDir, fileName);
      console.log(`📥 Downloading: ${item}`);
      await downloadFile(item, destPath);
      localMediaPaths.push(destPath);
    }
  }

  // Post to each group
  const postPage = await context.newPage();
  let allSuccess = true;

  for (let i = 0; i < groupIds.length; i++) {
    const groupId = groupIds[i];
    const group = groupMap.get(groupId);
    if (!group) {
      console.log(`⚠️  Group ${groupId} not found, skipping`);
      continue;
    }

    console.log(`[${i + 1}/${groupIds.length}] Posting to: ${group.name}`);
    const result = await postToGroup(postPage, group.url, task.text_content, localMediaPaths);

    await supaInsert('history', {
      task_id: task.id,
      group_id: groupId,
      group_name: group.name,
      status: result.success ? 'done' : 'failed',
      error_message: result.error || null,
      media_count: localMediaPaths.length,
    });

    if (result.success) {
      console.log(`  ✅ ${group.name}`);
    } else {
      console.log(`  ❌ ${group.name}: ${result.error}`);
      allSuccess = false;
    }

    if (i < groupIds.length - 1) {
      console.log('  ⏳ Waiting 3-5 minutes...');
      await randomDelay();
    }
  }

  await postPage.close();

  // Update task status
  if (allSuccess) {
    await supaUpdate('tasks', task.id, { status: 'done' });
    console.log('✅ Task completed successfully');
  } else {
    const retries = (task.retries || 0) + 1;
    if (retries >= (task.max_retries || 3)) {
      await supaUpdate('tasks', task.id, { status: 'failed', retries });
    } else {
      await supaUpdate('tasks', task.id, { status: 'pending', retries });
    }
    console.log(`⚠️  Task completed with failures (retry ${retries}/${task.max_retries || 3})`);
  }

  // Cleanup
  for (const p of localMediaPaths) {
    try { fs.unlinkSync(p); } catch { /* ignore */ }
  }

  await browser.close();
  console.log('🏁 Worker finished');
}

main().catch(err => {
  console.error('❌ Worker failed:', err);
  process.exit(1);
});
