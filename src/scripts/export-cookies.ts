import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

async function exportCookies() {
  console.log('🔄 فتح متصفح جديد...');

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

  console.log('\n📋 المتصفح اتفتح قدامك — سجل دخول في فيسبوك');
  console.log('⏳ مستني تسجل دخول (أقصى 5 دقايق)...');

  let loggedIn = false;
  const startTime = Date.now();
  while (Date.now() - startTime < 300000) {
    const cookies = await context.cookies();
    const hasCUser = cookies.some(c => c.name === 'c_user' && c.value.length > 0);
    const hasXs = cookies.some(c => c.name === 'xs' && c.value.length > 0);
    if (hasCUser && hasXs) {
      loggedIn = true;
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!loggedIn) {
    console.error('❌ لم يتم تسجيل الدخول');
    await browser.close();
    process.exit(1);
  }

  console.log('✅ تم تسجيل الدخول');
  console.log('💾 جاري حفظ الكوكيز...');
  await page.waitForTimeout(2000);

  const storageState = await context.storageState();

  const cookiesPath = path.join(config.media.dir, '..', 'facebook-cookies.json');
  const dir = path.dirname(cookiesPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cookiesPath, JSON.stringify(storageState, null, 2));

  const hasCUser = storageState.cookies.some((c: any) => c.name === 'c_user');
  const hasXs = storageState.cookies.some((c: any) => c.name === 'xs');
  const hasFr = storageState.cookies.some((c: any) => c.name === 'fr');

  console.log(`\n✅ تم الحفظ في ${cookiesPath}`);
  console.log(`   عدد الكوكيز: ${storageState.cookies.length}`);
  console.log(`   c_user: ${hasCUser ? '✅' : '❌'} | xs: ${hasXs ? '✅' : '❌'} | fr: ${hasFr ? '✅' : '❌'}`);

  await browser.close();
  process.exit(0);
}

exportCookies().catch(err => {
  console.error('❌ فشل:', err.message);
  process.exit(1);
});
