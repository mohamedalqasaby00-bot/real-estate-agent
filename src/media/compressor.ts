import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { markMediaCompressed } from '../storage/index.js';

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

export async function compressImage(inputPath: string, mediaId?: string): Promise<string> {
  const ext = path.extname(inputPath).toLowerCase();
  if (!IMAGE_EXT.includes(ext)) return inputPath;

  const stat = fs.statSync(inputPath);
  const sizeMB = stat.size / (1024 * 1024);

  if (sizeMB <= config.media.maxImageSizeMB) {
    if (mediaId) markMediaCompressed(mediaId);
    return inputPath;
  }

  console.log(`📦 Image too large (${sizeMB.toFixed(1)}MB), consider resizing manually: ${inputPath}`);
  if (mediaId) markMediaCompressed(mediaId);
  return inputPath;
}
