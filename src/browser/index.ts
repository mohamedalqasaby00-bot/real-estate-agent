import { chromium, BrowserContext, Page } from 'playwright';
import { getChromeLaunchOptions } from './profile.js';

let context: BrowserContext | null = null;

export async function launchBrowser(): Promise<BrowserContext> {
  if (context) return context;

  const opts = getChromeLaunchOptions();

  context = await chromium.launchPersistentContext(opts.userDataDir, {
    headless: false,
    args: opts.args,
    viewport: { width: 1366, height: 768 },
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    permissions: ['geolocation'],
  });

  return context;
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    try { await context.close(); } catch { /* ignore */ }
    context = null;
  }
}

export async function newPage(): Promise<Page> {
  const ctx = await launchBrowser();
  const page = await ctx.newPage();
  await page.setDefaultTimeout(30000);
  return page;
}
