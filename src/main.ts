import { initDb, closeDb, saveDb } from './storage/index.js';
import { ensureMediaDir } from './media/index.js';
import { startMCPServer } from './ai/index.js';
import { startDashboard } from './dashboard/server.js';
import { startQueue } from './scheduler/index.js';

async function main() {
  console.log('🤖 Real Estate Agent v1.0.0');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  initDb();
  ensureMediaDir();

  const args = process.argv.slice(2);

  if (args.includes('--mcp')) {
    await startMCPServer();
    return;
  }

  if (args.includes('--dashboard') || args.includes('-d')) {
    startDashboard();
    return;
  }

  startQueue();
  startDashboard();

  console.log('\n📊 Dashboard: http://localhost:3456');
  console.log('🤖 MCP mode: use --mcp flag for stdio server');
  console.log('📝 Send natural language commands via dashboard or MCP tools');
}

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

main().catch(err => {
  console.error('Fatal error:', err);
  closeDb();
  process.exit(1);
});
