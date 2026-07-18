import { Page } from 'playwright';
import { config } from '../config/index.js';
import { newPage } from '../browser/index.js';

export async function ensureLoggedIn(page?: Page): Promise<Page> {
  const p = page || await newPage();
  await p.goto(config.facebook.baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
  const url = p.url();
  if (url.includes('login') || url.includes('checkpoint')) {
    if (process.env.CLOUD_MODE === 'true') {
      throw new Error('Facebook session expired. Re-run export-cookies locally and upload to Supabase.');
    }
    console.log('⚠️  يرجى تسجيل الدخول إلى فيسبوك في المتصفح المفتوح...');
    await p.waitForURL('https://www.facebook.com/', { timeout: 120000 });
    console.log('✅ تم تسجيل الدخول بنجاح');
  }
  return p;
}
