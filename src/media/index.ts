import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { config } from '../config/index.js';
import { addMedia, getAllMedia, getMedia, deleteMedia } from '../storage/index.js';
import { compressImage } from './compressor.js';

export { compressImage } from './compressor.js';

export function ensureMediaDir(): void {
  if (!fs.existsSync(config.media.dir)) {
    fs.mkdirSync(config.media.dir, { recursive: true });
  }
}

export async function importMedia(sourcePath: string): Promise<{ id: string; filePath: string }> {
  ensureMediaDir();
  const ext = path.extname(sourcePath);
  const fileName = `${uuid()}${ext}`;
  const destPath = path.join(config.media.dir, fileName);

  fs.copyFileSync(sourcePath, destPath);

  const stat = fs.statSync(destPath);
  const entry = addMedia(
    path.basename(sourcePath),
    fileName,
    destPath,
    ext,
    stat.size
  );

  return { id: entry.id, filePath: destPath };
}

export { getAllMedia as listMedia, getMedia, deleteMedia };
