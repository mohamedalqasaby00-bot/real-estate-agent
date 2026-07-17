import { Page } from 'playwright';
import path from 'path';
import { config } from '../config/index.js';

export async function uploadMedia(page: Page, filePaths: string[]): Promise<void> {
  if (!filePaths.length) return;

  const fileInput = page.locator('input[type="file"]');
  if (await fileInput.count() === 0) {
    const addPhotoBtn = page.locator('div[aria-label="إضافة صورة/فيديو"], div[aria-label*="صورة"], div[aria-label*="Photo"]').first();
    if (await addPhotoBtn.isVisible()) {
      await addPhotoBtn.click();
      await page.waitForTimeout(2000);
    }
  }

  const absolutePaths = filePaths.map(fp => path.resolve(config.media.dir, fp));
  const visibleInput = page.locator('input[type="file"]').first();
  if (await visibleInput.count() > 0) {
    await visibleInput.setInputFiles(absolutePaths);
    await page.waitForTimeout(3000);
  }
}
