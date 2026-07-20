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

async function screenshotDebug(page: any, label: string) {
  try {
    const dir = '/tmp/debug';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${label}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`  📸 Screenshot saved: ${file}`);
  } catch (e: any) {
    console.log(`  ⚠️ Screenshot failed: ${e.message}`);
  }
}

async function findGroupPostComposer(page: any): Promise<{ found: boolean; selector?: string; el?: any }> {
  const COMPOSER_EXACT_LABELS = [
    'Write something...',
    'اكتب ماذا يدور في خاطرك...',
    'اكتب Something...',
    'Create a public post...',
    'اكتب منشوراً عاماً...',
  ];

  for (const label of COMPOSER_EXACT_LABELS) {
    const el = page.locator(`[role="button"][aria-label="${label}"]`).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      const box = await el.boundingBox().catch(() => null);
      if (box && box.y < 500) {
        console.log(`  ✅ Post composer found via exact aria-label: "${label}"`);
        return { found: true, selector: `aria-label="${label}"`, el };
      }
    }
  }

  const postComposerParent = page.locator('div[role="button"]').filter({
    has: page.locator('[data-lexical-editor="true"]')
  }).first();
  if (await postComposerParent.isVisible({ timeout: 2000 }).catch(() => false)) {
    const box = await postComposerParent.boundingBox().catch(() => null);
    if (box && box.y < 500) {
      console.log('  ✅ Post composer found via lexical-editor parent');
      return { found: true, selector: 'div[role="button"]:has([data-lexical-editor])', el: postComposerParent };
    }
  }

  const altLabels = [
    /^Write something/i,
    /^اكتب/i,
    /^Create a (public )?post/i,
    /^اكتب منشور/i,
  ];
  for (const pattern of altLabels) {
    const allSpans = await page.locator('div[role="button"] span, span[role="button"]').all();
    for (const span of allSpans) {
      const txt = (await span.innerText().catch(() => '')).trim();
      if (!pattern.test(txt)) continue;
      if (!await span.isVisible().catch(() => false)) continue;
      const box = await span.boundingBox().catch(() => null);
      if (!box || box.y > 500) continue;

      const isInPost = await span.evaluate((node: any) => {
        let cur: HTMLElement | null = node;
        while (cur) {
          if (cur.getAttribute('aria-label') === 'Write a comment...' ||
              cur.getAttribute('aria-label') === 'اكتب تعليقاً...' ||
              cur.getAttribute('role') === 'article') {
            return true;
          }
          cur = cur.parentElement;
        }
        return false;
      }).catch(() => false);

      if (!isInPost) {
        console.log(`  ✅ Post composer found via text pattern: "${txt}"`);
        return { found: true, selector: `text="${txt}"`, el: span };
      }
    }
  }

  return { found: false };
}

async function postToGroup(page: any, groupUrl: string, text: string, mediaPaths: string[]): Promise<{ success: boolean; groupName: string; error?: string }> {
  const MAX_ATTEMPTS = 3;
  const REJECT_DIALOG_MARKERS = [
    'Write a comment',
    'اكتب تعليقاً',
    'اكتب تعليق',
    'Comment as',
    'Post as',
    'Edit post',
    'تحرير منشور',
    'تحرير',
    'Edit',
    'Update post',
    'تحديث',
  ];
  const POST_DIALOG_MARKERS = [
    'Post to',
    'Create post',
    'Create a post',
    'Public',
    'نشر في',
    'منشور',
    'الجمهور',
    'Create',
    'أنشاء منشور',
  ];

  try {
    console.log('  🌐 Opening group');
    await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
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

    const closeDialogs = async () => {
      for (const sel of ['div[role="dialog"] [aria-label="Close"]', 'div[role="dialog"] [aria-label="إغلاق"]']) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          await btn.click().catch(() => {});
          await page.waitForTimeout(500);
        }
      }
    };

    await closeDialogs();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    await screenshotDebug(page, `group-${groupName.replace(/[^a-zA-Z0-9]/g, '_')}-before-click`);

    let dialogOpened = false;
    let isCommentDialog = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      console.log(`\n  🔍 Attempt ${attempt + 1}/${MAX_ATTEMPTS}: Looking for group post composer`);

      const composer = await findGroupPostComposer(page);

      if (!composer.found) {
        console.log(`  ⚠️ Attempt ${attempt + 1}: No composer found — trying page analysis`);
        await screenshotDebug(page, `no-composer-attempt-${attempt + 1}`);

        const allBtns = await page.locator('[role="button"][aria-label]').all();
        console.log(`  📋 All aria-label buttons on page:`);
        for (let i = 0; i < Math.min(allBtns.length, 20); i++) {
          const lbl = await allBtns[i].getAttribute('aria-label').catch(() => '');
          const box = await allBtns[i].boundingBox().catch(() => null);
          console.log(`     [${i}] aria-label="${lbl}" y=${box?.y ?? 'null'}`);
        }
        continue;
      }

      await composer.el.click();
      await page.waitForTimeout(3000);

      await screenshotDebug(page, `after-click-attempt-${attempt + 1}`);

      const dialogCount = await page.locator('[role="dialog"]').count();
      console.log(`  📋 Dialogs on page: ${dialogCount}`);

      if (dialogCount === 0) {
        console.log(`  ❌ No dialog opened after clicking composer`);
        continue;
      }

      const dialog = page.locator('[role="dialog"]').last();
      const dialogText = await dialog.innerText().catch(() => '');
      console.log(`  📝 Dialog text preview: ${dialogText.slice(0, 200).replace(/\n/g, ' ')}`);

      const isRejected = REJECT_DIALOG_MARKERS.some(m => dialogText.includes(m));
      const isPost = POST_DIALOG_MARKERS.some(m => dialogText.includes(m));
      console.log(`  🔎 isRejected=${isRejected} isPost=${isPost}`);

      if (isRejected && !isPost) {
        console.log('  🚫 Comment/Edit dialog detected — closing');
        await closeDialogs();
        await page.waitForTimeout(1000);
        isCommentDialog = true;
        continue;
      }

      const postBtnInDialog = await (async () => {
        const btns = dialog.locator('[role="button"]');
        const count = await btns.count();
        for (let i = 0; i < count; i++) {
          const txt = (await btns.nth(i).innerText().catch(() => '')).trim();
          if (['Post', 'نشر', 'Share', 'مشاركة'].includes(txt)) {
            const disabled = await btns.nth(i).getAttribute('aria-disabled').catch(() => null);
            if (disabled !== 'true') return true;
          }
        }
        return false;
      })();

      if (!postBtnInDialog) {
        console.log('  🚫 No enabled "Post" button found in dialog — likely wrong dialog');
        await closeDialogs();
        await page.waitForTimeout(1000);
        continue;
      }

      dialogOpened = true;
      isCommentDialog = false;
      console.log(`  ✅ Create Post dialog confirmed (selector: ${composer.selector})`);
      break;
    }

    if (!dialogOpened || isCommentDialog) {
      throw new Error('Could not open Create Post dialog after 3 attempts');
    }

    const dialog = page.locator('[role="dialog"]').last();

    // Verify this is a Create Post dialog by checking header
    const h2Text = await dialog.locator('h2, h3, [role="heading"]').first().innerText().catch(() => '');
    console.log(`  📝 Dialog header: "${h2Text}"`);
    const createPostHeaders = ['Create post', 'Create a post', 'إنشاء منشور', 'Post to', 'نشر في'];
    const isCreateHeader = createPostHeaders.some(h => h2Text.includes(h));
    if (!isCreateHeader) {
      console.log('  ⚠️ Dialog header is not "Create post" — proceeding anyway');
    }

    await screenshotDebug(page, 'post-dialog-open');

    const editorSelectors = [
      'div[data-lexical-editor="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
    ];

    let editor: any = null;
    for (const sel of editorSelectors) {
      const el = dialog.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        const isInComment = await el.evaluate((node: any) => {
          let cur: HTMLElement | null = node;
          while (cur) {
            const lbl = cur.getAttribute('aria-label') || '';
            if (lbl.includes('comment') || lbl.includes('تعليق')) return true;
            cur = cur.parentElement;
          }
          return false;
        }).catch(() => false);

        if (isInComment) {
          console.log(`  ⚠️ Skipping editor in comment area: ${sel}`);
          continue;
        }

        editor = el;
        console.log(`  ✏️ Editor found: ${sel}`);
        break;
      }
    }

    if (!editor) {
      throw new Error('Could not find text editor in dialog');
    }

    console.log('  ✍️ Typing post');
    await editor.click();
    await page.waitForTimeout(500);

    await page.keyboard.type(text, { delay: 15 });
    await page.waitForTimeout(2000);

    await screenshotDebug(page, 'after-typing');

    if (mediaPaths.length) {
      console.log(`  📎 Uploading ${mediaPaths.length} media files`);
      for (const mediaPath of mediaPaths) {
        const fileInput = dialog.locator('input[type="file"]').first();
        if (await fileInput.count()) {
          await fileInput.setInputFiles(mediaPath);
        } else {
          await page.locator('input[type="file"]').first().setInputFiles(mediaPath).catch(() => {});
        }
        await page.waitForTimeout(5000);
      }
    }

    const findPostButton = async (container: any): Promise<any> => {
      const POST_LABELS = ['Post', 'نشر', 'Share', 'مشاركة'];
      const btns = container.locator('[role="button"]');
      const count = await btns.count();
      for (let i = 0; i < count; i++) {
        const btn = btns.nth(i);
        const txt = (await btn.innerText().catch(() => '')).trim();
        if (!POST_LABELS.includes(txt)) continue;
        const disabled = await btn.getAttribute('aria-disabled').catch(() => null);
        if (disabled === 'true') continue;
        return btn;
      }
      return null;
    };

    let postBtn = await findPostButton(dialog);

    if (!postBtn) {
      console.log('  ⏳ Post button not enabled yet — waiting up to 15s...');
      for (let w = 0; w < 15; w++) {
        await page.waitForTimeout(1000);
        postBtn = await findPostButton(dialog);
        if (postBtn) break;
      }
    }

    if (!postBtn) {
      await screenshotDebug(page, 'no-post-button');
      throw new Error('Could not find enabled Post button in dialog');
    }

    console.log('  🖱️ Clicking Post');
    await postBtn.click();
    await page.waitForTimeout(3000);

    console.log('  ⏳ Waiting for dialog to close...');
    let dialogGone = false;
    for (let w = 0; w < 15; w++) {
      const stillOpen = await dialog.isVisible({ timeout: 1500 }).catch(() => false);
      if (!stillOpen) {
        dialogGone = true;
        break;
      }
      await page.waitForTimeout(1000);
    }

    if (!dialogGone) {
      const editorAfter = await dialog.locator('[data-lexical-editor="true"], [contenteditable="true"]').first().innerText().catch(() => '');
      if (editorAfter.includes(text.slice(0, 15))) {
        await screenshotDebug(page, 'post-failed-dialog-still-open');
        throw new Error('Post did not publish - dialog still open with text');
      }
    }

    await screenshotDebug(page, 'post-published');
    console.log('  ✅ Post published');
    return { success: true, groupName };
  } catch (err: any) {
    console.log(`  ❌ Error: ${err.message}`);
    await screenshotDebug(page, 'error-state');
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
