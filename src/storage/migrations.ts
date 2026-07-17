import { runSql, queryAll } from './database.js';

export function runMigrations(): void {
  runSql(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      category TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  runSql(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'post',
      status TEXT NOT NULL DEFAULT 'pending',
      group_ids TEXT NOT NULL DEFAULT '[]',
      text_content TEXT DEFAULT '',
      media_paths TEXT DEFAULT '[]',
      scheduled_at TEXT,
      executed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      retries INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      error TEXT
    )
  `);
  runSql(`
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      group_id TEXT,
      group_name TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'done',
      text_content TEXT DEFAULT '',
      media_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  runSql(`
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      width INTEGER,
      height INTEGER,
      compressed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  runSql(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}
