import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

async function exportCookies() {
  console.log('🔄 Opening fresh browser for new Facebook account...');

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
  });

  const page = await context.newPage();
  await page.goto('https://www.facebook.com', { waitUntil: 'networkidle', timeout: 60000 });

  console.log('📋 سجل دخول بالاكونت الجديد في المتصفح...');

  console.log('⏳ مستني تسجل الدخول... (حد أقصى 5 دقايق)');
  try {
    await page.waitForURL('https://www.facebook.com/?', { timeout: 300000 });
  } catch {
    const currentUrl = page.url();
    if (!currentUrl.includes('login') && !currentUrl.includes('checkpoint')) {
      console.log('✅ يبدو إنك سجلت دخول!');
    } else {
      console.log('⚠️ Timeout - but saving whatever session exists...');
    }
  }

  console.log('✅ جاري حفظ الكوكيز...');

  const storageState = await context.storageState();

  const cookiesPath = path.join(config.media.dir, '..', 'facebook-cookies.json');
  const dir = path.dirname(cookiesPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cookiesPath, JSON.stringify(storageState, null, 2));

  console.log(`✅ تم حفظ الكوكيز في ${cookiesPath}`);
  console.log(`   عدد الكوكيز: ${storageState.cookies.length}`);

  await browser.close();
  process.exit(0);
}

exportCookies().catch(err => {
  console.error('❌ فشل:', err.message);
  process.exit(1);
});
