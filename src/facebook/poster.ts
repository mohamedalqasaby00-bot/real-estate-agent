import { Page } from 'playwright';
import { config } from '../config/index.js';
import { newPage } from '../browser/index.js';
import { ensureLoggedIn } from './login.js';
import { uploadMedia } from './media-uploader.js';
import { addHistory } from '../storage/index.js';

function randomDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * (config.facebook.maxDelayMs - config.facebook.minDelayMs + 1)) + config.facebook.minDelayMs;
  return new Promise(r => setTimeout(r, ms));
}

export interface PostResult {
  groupId: string;
  groupName: string;
  success: boolean;
  error?: string;
}

export async function postToGroup(
  groupUrl: string,
  text: string,
  mediaPaths: string[],
  taskId: string | null
): Promise<PostResult> {
  const page = await newPage();
  try {
    await ensureLoggedIn(page);

    await page.goto(groupUrl, { waitUntil: 'networkidle', timeout: 60000 });
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
      await uploadMedia(page, mediaPaths);
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

    await addHistory(taskId, groupUrl, groupName, 'done', text, mediaPaths.length);

    return { groupId: groupUrl, groupName, success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await addHistory(taskId, groupUrl, groupUrl, 'failed', text, mediaPaths.length);
    return { groupId: groupUrl, groupName: groupUrl, success: false, error: errorMsg };
  } finally {
    await page.close().catch(() => {});
  }
}

export async function postToGroups(
  groupUrls: string[],
  text: string,
  mediaPaths: string[],
  taskId: string | null,
  onProgress?: (result: PostResult, index: number, total: number) => void
): Promise<PostResult[]> {
  const results: PostResult[] = [];
  for (let i = 0; i < groupUrls.length; i++) {
    const result = await postToGroup(groupUrls[i], text, mediaPaths, taskId);
    results.push(result);
    if (onProgress) onProgress(result, i + 1, groupUrls.length);
    if (i < groupUrls.length - 1) await randomDelay();
  }
  return results;
}
