import dotenv from 'dotenv';
dotenv.config();

import { startQueue } from './scheduler/queue.js';
import { initDb } from './storage/index.js';

async function main() {
  console.log('🔄 Starting worker...');
  await initDb();
  startQueue();
  console.log('✅ Worker running. Polling for tasks every 60s...');
  console.log(`   Worker ID: ${process.env.RAILWAY_DEPLOYMENT_ID || 'local'}`);
}

main().catch(err => {
  console.error('❌ Worker failed:', err);
  process.exit(1);
});
