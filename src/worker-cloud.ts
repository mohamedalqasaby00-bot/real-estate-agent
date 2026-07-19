import dotenv from 'dotenv';
dotenv.config();

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const BATCH_SIZE = 10;
const DELAY_MIN_MS = 30000;
const DELAY_MAX_MS = 60000;
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
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          console.error(`⚠️  supaUpdate ${table} failed (${res.statusCode}): ${d}`);
        }
        resolve();
      });
    });
    req.on('error', (err) => { console.error(`⚠️  supaUpdate ${table} error: ${err.message}`); resolve(); });
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
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          console.error(`⚠️  supaInsert ${table} failed (${res.statusCode}): ${d}`);
          resolve(null);
        } else {
          try { resolve(JSON.parse(d)); } catch { resolve(null); }
        }
      });
    });
    req.on('error', (err) => { console.error(`⚠️  supaInsert ${table} error: ${err.message}`); resolve(null); });
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
    await page.waitForTimeout(5000);
    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
      throw new Error('Session expired');
    }
    let groupName = await page.title();
    if (groupName === 'Facebook' || !groupName) groupName = groupUrl.split('/').pop() || groupUrl;

    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (bodyText.includes('Your membership is pending') || bodyText.includes('your request to join')) {
      throw new Error('Membership pending');
    }

    for (const sel of ['div[role="dialog"] div[aria-label="Close"]', 'div[aria-label="Close"]']) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(1000);
      }
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    let dialogOpened = false;
    const allWriteEls = await page.locator('[aria-label="Write something..."], [aria-label="اكتب ماذا يدور في خاطرك..."]').all();
    console.log(`  🔍 Found ${allWriteEls.length} "Write something" elements`);

    for (let i = 0; i < allWriteEls.length; i++) {
      const el = allWriteEls[i];
      if (!await el.isVisible().catch(() => false)) continue;
      const box = await el.boundingBox().catch(() => null);
      if (!box || box.y > 600) {
        console.log(`  ⏭️ Skipping element ${i} (y=${box?.y}) - too far down`);
        continue;
      }

      console.log(`  🖱️ Clicking "Write something" element ${i} at y=${box.y}`);
      await el.click();
      await page.waitForTimeout(3000);

      const dialogCheck = await page.locator('div[role="dialog"]').first().isVisible({ timeout: 2000 }).catch(() => false);
      if (dialogCheck) {
        const dText = await page.locator('div[role="dialog"]').first().innerText().catch(() => '');
        if (dText.includes('Post to') || dText.includes('Create') || dText.includes('public') || dText.includes('نشر') || dText.includes('Write something')) {
          dialogOpened = true;
          console.log(`  ✅ Create Post dialog opened from element ${i}`);
          break;
        }
      }

      console.log(`  ❌ Element ${i} did not open Create Post dialog, closing...`);
      for (const closeSel of ['div[role="dialog"] div[aria-label="Close"]', 'div[aria-label="Close"]']) {
        const cBtn = page.locator(closeSel).first();
        if (await cBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await cBtn.click().catch(() => {});
          await page.waitForTimeout(500);
        }
      }
      await page.waitForTimeout(500);
    }

    if (!dialogOpened) {
      const fallbackEls = await page.locator('span').filter({ hasText: 'Write something' }).all();
      for (let i = 0; i < fallbackEls.length; i++) {
        const box = await fallbackEls[i].boundingBox().catch(() => null);
        if (!box || box.y > 600) continue;
        await fallbackEls[i].click();
        await page.waitForTimeout(3000);
        const dialogCheck = await page.locator('div[role="dialog"]').first().isVisible({ timeout: 2000 }).catch(() => false);
        if (dialogCheck) {
          dialogOpened = true;
          break;
        }
        for (const closeSel of ['div[role="dialog"] div[aria-label="Close"]', 'div[aria-label="Close"]']) {
          const cBtn = page.locator(closeSel).first();
          if (await cBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await cBtn.click().catch(() => {});
            await page.waitForTimeout(500);
          }
        }
      }
    }

    if (!dialogOpened) throw new Error('Could not open Create Post dialog');

    const dialog = page.locator('div[role="dialog"]').first();
    const dialogTitle = await dialog.innerText().catch(() => '');
    console.log(`  📸 Dialog: ${dialogTitle.slice(0, 150)}`);

    let editor: any = null;
    const editorSelectors = [
      'div[role="dialog"] div[data-lexical-editor="true"]',
      'div[role="dialog"] div[contenteditable="true"][role="textbox"]',
      'div[role="dialog"] div[contenteditable="true"]',
    ];
    for (const sel of editorSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        editor = el;
        break;
      }
    }

    if (!editor) {
      console.log(`  📸 Dialog text: ${dialogText.slice(0, 300)}`);
      throw new Error('Could not find text editor in dialog');
    }

    await editor.click();
    await page.waitForTimeout(500);
    await page.keyboard.type(text, { delay: 20 });
    await page.waitForTimeout(1500);

    if (mediaPaths.length) {
      for (const mediaPath of mediaPaths) {
        const fileInput = page.locator('div[role="dialog"] input[type="file"]').first();
        if (await fileInput.count()) {
          await fileInput.setInputFiles(mediaPath);
        } else {
          await page.locator('input[type="file"]').first().setInputFiles(mediaPath);
        }
        await page.waitForTimeout(5000);
      }
    }

    let postBtn: any = null;
    const allBtns = page.locator('div[role="dialog"] div[role="button"], div[role="dialog"] span[role="button"]');
    const btnCount = await allBtns.count();
    for (let i = 0; i < btnCount; i++) {
      const btnText = (await allBtns.nth(i).innerText().catch(() => '')).trim();
      if (btnText === 'Post' || btnText === 'نشر' || btnText === 'Share') {
        const disabled = await allBtns.nth(i).getAttribute('aria-disabled').catch(() => null);
        if (disabled !== 'true') {
          postBtn = allBtns.nth(i);
          break;
        }
      }
    }

    if (!postBtn) throw new Error('Could not find Post button');

    const textBeforePost = await editor.innerText().catch(() => '');
    await postBtn.click();
    await page.waitForTimeout(5000);

    const dialogAfter = await dialog.isVisible({ timeout: 5000 }).catch(() => false);
    if (dialogAfter) {
      const editorAfter = await page.locator('div[role="dialog"] div[data-lexical-editor="true"]').first().innerText().catch(() => '');
      if (editorAfter.includes(text.slice(0, 15))) {
        throw new Error('Post did not publish - dialog still open with text');
      }
    }

    return { success: true, groupName };
  } catch (err: any) {
    return { success: false, groupName: groupUrl, error: err.message };
  }
}

function randomDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1)) + DELAY_MIN_MS;
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('🔄 GitHub Actions Worker starting...');
  console.log(`📦 Batch size: ${BATCH_SIZE} groups per run`);

  const postingSetting = await supaQuery('settings', 'key=eq.posting_enabled&select=value');
  if (postingSetting.length && postingSetting[0].value === 'false') {
    console.log('⏸️ Posting is DISABLED. Exiting.');
    process.exit(0);
  }

  const settings = await supaQuery('settings', 'key=eq.facebook_cookies&select=value');
  if (!settings.length || !settings[0].value) {
    console.error('❌ No Facebook cookies found in Supabase');
    process.exit(1);
  }

  const storageState = JSON.parse(settings[0].value);
  console.log(`✅ Loaded ${storageState.cookies.length} cookies`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    storageState,
    viewport: { width: 1366, height: 768 },
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  });

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

  const runningTasks = await supaQuery('tasks', 'status=eq.running&order=created_at');
  for (const rt of runningTasks) {
    console.log(`🔄 Resetting stale running task ${rt.id} to pending`);
    await supaUpdate('tasks', rt.id, { status: 'pending', locked_by: 'none' });
  }

  const tasks = await supaQuery('tasks', 'status=eq.pending&order=created_at');
  console.log(`📋 Found ${tasks.length} pending tasks`);

  if (tasks.length === 0) {
    console.log('✅ No tasks to process');
    await browser.close();
    process.exit(0);
  }

  const task = tasks[0];
  console.log(`🚀 Processing task ${task.id}: ${(task.text_content || '').slice(0, 50)}...`);

  await supaUpdate('tasks', task.id, { status: 'running', locked_by: 'github-actions' });

  const groupIds: string[] = typeof task.group_ids === 'string' ? JSON.parse(task.group_ids) : task.group_ids;
  const mediaRaw: string[] = typeof task.media_paths === 'string' ? JSON.parse(task.media_paths) : (task.media_paths || []);

  const groups = await supaQuery('groups', 'select=id,url,name');
  const groupMap = new Map(groups.map((g: any) => [g.id, g]));

  const historyRecords = await supaQuery('history', `task_id=eq.${task.id}&select=group_id`);
  const doneGroupIds = new Set(historyRecords.map((h: any) => h.group_id));

  const remainingGroupIds = groupIds.filter((id: string) => !doneGroupIds.has(id));
  console.log(`📊 Total: ${groupIds.length} | Done: ${doneGroupIds.size} | Remaining: ${remainingGroupIds.length}`);

  if (remainingGroupIds.length === 0) {
    await supaUpdate('tasks', task.id, { status: 'done' });
    console.log('✅ All groups already posted. Task completed.');
    await browser.close();
    process.exit(0);
  }

  const batchGroupIds = remainingGroupIds.slice(0, BATCH_SIZE);
  console.log(`📦 Processing batch of ${batchGroupIds.length} groups`);

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

  const postPage = await context.newPage();
  let batchFailures = 0;

  for (let i = 0; i < batchGroupIds.length; i++) {
    const groupId = batchGroupIds[i];
    const group = groupMap.get(groupId);
    if (!group) {
      console.log(`⚠️  Group ${groupId} not found, skipping`);
      await supaInsert('history', {
        id: crypto.randomUUID(),
        task_id: task.id,
        group_id: groupId,
        group_name: 'unknown',
        status: 'failed',
        media_count: localMediaPaths.length,
      });
      batchFailures++;
      continue;
    }

    console.log(`[${doneGroupIds.size + i + 1}/${groupIds.length}] Posting to: ${group.name}`);
    const result = await postToGroup(postPage, group.url, task.text_content, localMediaPaths);

    await supaInsert('history', {
      id: crypto.randomUUID(),
      task_id: task.id,
      group_id: groupId,
      group_name: group.name,
      status: result.success ? 'done' : 'failed',
      media_count: localMediaPaths.length,
    });

    if (result.success) {
      console.log(`  ✅ ${group.name}`);
    } else {
      console.log(`  ❌ ${group.name}: ${result.error}`);
      batchFailures++;
    }

    if (i < batchGroupIds.length - 1) {
      console.log(`  ⏳ Waiting ${DELAY_MIN_MS/1000}-${DELAY_MAX_MS/1000} seconds...`);
      await randomDelay();
    }
  }

  await postPage.close();

  const totalDone = doneGroupIds.size + (batchGroupIds.length - batchFailures);
  const totalRemaining = groupIds.length - totalDone;
  console.log(`📊 Progress: ${totalDone}/${groupIds.length} done, ${totalRemaining} remaining`);

  if (totalRemaining <= 0) {
    await supaUpdate('tasks', task.id, { status: 'done', locked_by: 'none' });
    console.log('✅ Task completed! All groups posted.');
  } else {
    await supaUpdate('tasks', task.id, { status: 'pending', locked_by: 'none' });
    console.log(`🔄 Batch done. ${totalRemaining} groups left for next run.`);
  }

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
