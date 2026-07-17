import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export function getChromeLaunchOptions() {
  const userDataDir = config.chrome.userDataDir;
  const profile = config.chrome.profile;

  if (!fs.existsSync(userDataDir)) {
    throw new Error(`Chrome user data dir not found: ${userDataDir}. Set CHROME_USER_DATA_DIR in .env`);
  }

  return {
    userDataDir,
    profile,
    args: [
      `--profile-directory=${profile}`,
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  };
}
