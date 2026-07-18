import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { config } from '../config/index.js';

let context: BrowserContext | null = null;

function downloadUrl(url: string, headers?: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const reqHeaders: Record<string, string> = { ...headers };
    client.get(url, { headers: reqHeaders }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadUrl(res.headers.location!).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function loadCloudCookies(): Promise<string | null> {
  const cookiesUrl = process.env.COOKIES_URL;
  if (cookiesUrl) {
    console.log('☁️  Loading cookies from COOKIES_URL...');
    return downloadUrl(cookiesUrl);
  }

  const cookiesFile = process.env.COOKIES_FILE || path.join(config.media.dir, '..', 'facebook-cookies.json');
  if (fs.existsSync(cookiesFile)) {
    console.log(`🍪 Loading cookies from ${cookiesFile}...`);
    return fs.readFileSync(cookiesFile, 'utf-8');
  }

  if (config.supabase.url && config.supabase.anonKey) {
    console.log('☁️  Loading cookies from Supabase settings...');
    try {
      const url = `${config.supabase.url}/rest/v1/settings?key=eq.facebook_cookies&select=value`;
      const data = await downloadUrl(url, {
        'apikey': config.supabase.anonKey,
        'Authorization': `Bearer ${config.supabase.anonKey}`,
      });
      const rows = JSON.parse(data);
      if (rows.length > 0 && rows[0].value) {
        return rows[0].value;
      }
    } catch (err) {
      console.error('Failed to load cookies from Supabase:', err);
    }
  }

  return null;
}

export async function launchBrowser(): Promise<BrowserContext> {
  if (context) return context;

  const isCloud = process.env.CLOUD_MODE === 'true';

  if (isCloud) {
    const cookiesJson = await loadCloudCookies();
    if (!cookiesJson) {
      throw new Error('No Facebook cookies found. Run "npm run export-cookies" locally first, or set COOKIES_URL/COOKIES_FILE env var.');
    }

    const storageState = JSON.parse(cookiesJson);

    context = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    }).then(browser => browser.newContext({
      storageState,
      viewport: { width: 1366, height: 768 },
      locale: 'ar-EG',
      timezoneId: 'Africa/Cairo',
    }));

    console.log('✅ Browser launched with saved cookies');
  } else {
    const userDataDir = config.chrome.userDataDir;

    if (!fs.existsSync(userDataDir)) {
      throw new Error(`Chrome user data dir not found: ${userDataDir}`);
    }

    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--profile-directory=${config.chrome.profile}`,
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
      viewport: { width: 1366, height: 768 },
      locale: 'ar-EG',
      timezoneId: 'Africa/Cairo',
      permissions: ['geolocation'],
    });

    console.log('✅ Browser launched with Chrome profile');
  }

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
