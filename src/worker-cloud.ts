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
  const MAX_ATTEMPTS = 3;
  const COMMENT_KEYWORDS = ['Write a comment', 'Comment', 'Reply', 'تعليق', 'رد', 'اكتب تعليق'];

  try {
    console.log('  🌐 Opening group');
    await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

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

    // Close any open dialogs first
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
    let isCommentDialog = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      console.log(`  🔍 Attempt ${attempt + 1}/${MAX_ATTEMPTS}: Looking for group post composer`);

      // Only search for the "Create Post" button near the top of the group page
      const composerSelectors = [
        'div[role="button"][aria-label*="Write something"]',
        'div[role="button"][aria-label*="Create a public post"]',
        'div[role="button"][aria-label*="اكتب"]',
        'div[role="button"][aria-label*="منشور"]',
        'div[role="button"][aria-label*="Create"]',
        'span[role="button"][aria-label*="Write something"]',
        'span[role="button"][aria-label*="Create a public post"]',
        'span[role="button"][aria-label*="اكتب"]',
        'span[role="button"][aria-label*="منشور"]',
        'span[role="button"][aria-label*="Create"]',
      ];

      let composerClicked = false;
      for (const sel of composerSelectors) {
        const els = await page.locator(sel).all();
        for (const el of els) {
          if (!await el.isVisible().catch(() => false)) continue;
          const box = await el.boundingBox().catch(() => null);
          if (!box || box.y > 600) continue;

          console.log(`  ✅ Group composer found: ${sel}`);
          await el.click();
          await page.waitForTimeout(3000);

          const dialogCheck = await page.locator('[role="dialog"]').last().isVisible({ timeout: 3000 }).catch(() => false);
          if (dialogCheck) {
            dialogOpened = true;
            composerClicked = true;
            break;
          }
        }
        if (composerClicked) break;
      }

      if (!dialogOpened) {
        // Fallback: try text-based selectors for the composer area
        const fallbackEls = await page.locator('span').filter({ hasText: /^(Write something|اكتبSomething|Create a post|اكتب منشور)/ }).all();
        for (const el of fallbackEls) {
          if (!await el.isVisible().catch(() => false)) continue;
          const box = await el.boundingBox().catch(() => null);
          if (!box || box.y > 600) continue;

          console.log('  ✅ Group composer found via text fallback');
          await el.click();
          await page.waitForTimeout(3000);
          dialogOpened = await page.locator('[role="dialog"]').last().isVisible({ timeout: 3000 }).catch(() => false);
          if (dialogOpened) break;
        }
      }

      if (!dialogOpened) {
        console.log(`  ⚠️ Attempt ${attempt + 1}: No composer found`);
        continue;
      }

      // Check if this is a comment dialog
      const dialog = page.locator('[role="dialog"]').last();
      const dialogText = await dialog.innerText().catch(() => '');
      console.log(`  📝 Post dialog opened: ${dialogText.slice(0, 150)}`);

      isCommentDialog = COMMENT_KEYWORDS.some(kw => dialogText.toLowerCase().includes(kw.toLowerCase()));

      if (isCommentDialog) {
        console.log('  🚫 Comment dialog detected — closing and retrying');
        const closeBtn = dialog.locator('[aria-label="Close"]').first();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click().catch(() => {});
          await page.waitForTimeout(1000);
        } else {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
        }
        dialogOpened = false;
        isCommentDialog = false;
        continue;
      }

      break;
    }

    if (!dialogOpened || isCommentDialog) {
      throw new Error('Could not open Create Post dialog after 3 attempts');
    }

    const dialog = page.locator('[role="dialog"]').last();

    // Verify the dialog has a Post button (not Comment/Reply)
    const dialogBtns = dialog.locator('[role="button"]');
    const btnCount = await dialogBtns.count();
    let hasPostButton = false;
    for (let i = 0; i < btnCount; i++) {
      const btnText = (await dialogBtns.nth(i).innerText().catch(() => '')).trim();
      if (btnText === 'Post' || btnText === 'نشر' || btnText === 'Share' || btnText === 'مشاركة') {
        hasPostButton = true;
        break;
      }
    }

    if (!hasPostButton) {
      throw new Error('Dialog does not have a Post button — likely a comment dialog');
    }

    // Find the text editor inside dialog
    let editor: any = null;
    const editorSelectors = [
      '[contenteditable="true"]',
      '[data-lexical-editor="true"]',
      '[contenteditable="true"][role="textbox"]',
    ];

    for (const sel of editorSelectors) {
      const el = dialog.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        editor = el;
        break;
      }
    }

    if (!editor) {
      throw new Error('Could not find text editor in dialog');
    }

    console.log('  ✍️ Typing post');
    await editor.click();
    await page.waitForTimeout(500);
    await page.keyboard.type(text, { delay: 20 });
    await page.waitForTimeout(1500);

    // Upload media if any
    if (mediaPaths.length) {
      for (const mediaPath of mediaPaths) {
        const fileInput = dialog.locator('input[type="file"]').first();
        if (await fileInput.count()) {
          await fileInput.setInputFiles(mediaPath);
        } else {
          const globalFileInput = page.locator('input[type="file"]').first();
          if (await globalFileInput.count()) {
            await globalFileInput.setInputFiles(mediaPath);
          }
        }
        await page.waitForTimeout(5000);
      }
    }

    // Find the Post button inside the dialog
    let postBtn: any = null;
    for (let i = 0; i < btnCount; i++) {
      const btnText = (await dialogBtns.nth(i).innerText().catch(() => '')).trim();
      if (btnText === 'Post' || btnText === 'نشر' || btnText === 'Share' || btnText === 'مشاركة') {
        const disabled = await dialogBtns.nth(i).getAttribute('aria-disabled').catch(() => null);
        if (disabled !== 'true') {
          postBtn = dialogBtns.nth(i);
          break;
        }
      }
    }

    if (!postBtn) {
      // Wait up to 10 seconds for the Post button to become enabled
      console.log('  ⏳ Waiting for Post button to become enabled...');
      for (let w = 0; w < 10; w++) {
        await page.waitForTimeout(1000);
        const refreshedBtns = dialog.locator('[role="button"]');
        const rc = await refreshedBtns.count();
        for (let i = 0; i < rc; i++) {
          const btnText = (await refreshedBtns.nth(i).innerText().catch(() => '')).trim();
          if (btnText === 'Post' || btnText === 'نشر' || btnText === 'Share' || btnText === 'مشاركة') {
            const disabled = await refreshedBtns.nth(i).getAttribute('aria-disabled').catch(() => null);
            if (disabled !== 'true') {
              postBtn = refreshedBtns.nth(i);
              break;
            }
          }
        }
        if (postBtn) break;
      }
    }

    if (!postBtn) {
      throw new Error('Could not find enabled Post button in dialog');
    }

    console.log('  🖱️ Clicking Post');
    await postBtn.click();
    await page.waitForTimeout(3000);

    // Wait until dialog disappears
    console.log('  ⏳ Waiting for dialog to close...');
    for (let w = 0; w < 10; w++) {
      const stillOpen = await dialog.isVisible({ timeout: 2000 }).catch(() => false);
      if (!stillOpen) break;
      await page.waitForTimeout(1000);
    }

    const dialogStillOpen = await dialog.isVisible({ timeout: 2000 }).catch(() => false);
    if (dialogStillOpen) {
      const editorAfter = await dialog.locator('[contenteditable="true"]').first().innerText().catch(() => '');
      if (editorAfter.includes(text.slice(0, 15))) {
        throw new Error('Post did not publish - dialog still open with text');
      }
    }

    console.log('  ✅ Post published');
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
