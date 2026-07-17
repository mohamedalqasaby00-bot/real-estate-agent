import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

export const config = {
  chrome: {
    userDataDir: process.env.CHROME_USER_DATA_DIR || path.join(ROOT, 'chrome-data'),
    profile: process.env.CHROME_PROFILE || 'Default',
  },
  db: {
    path: process.env.DB_PATH || path.join(ROOT, 'data', 'agent.db'),
  },
  media: {
    dir: process.env.MEDIA_DIR || path.join(ROOT, 'data', 'media'),
    maxImageSizeMB: 10,
    compressQuality: 80,
  },
  dashboard: {
    port: parseInt(process.env.DASHBOARD_PORT || '3456', 10),
  },
  facebook: {
    baseUrl: 'https://www.facebook.com',
    minDelayMs: 30000,
    maxDelayMs: 90000,
    maxRetries: 3,
  },
  scheduler: {
    pollIntervalMs: 60000,
  },
};
