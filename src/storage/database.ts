import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

let db: SqlJsDatabase | null = null;
let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

export async function initDb(): Promise<void> {
  if (db) return;
  SQL = await initSqlJs();
  const dir = path.dirname(config.db.path);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(config.db.path)) {
    const buffer = fs.readFileSync(config.db.path);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON');
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function saveDb(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.db.path, buffer);
}

export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

export function runSql(sql: string, params?: unknown[]): void {
  if (params && params.length) {
    getDb().run(sql, params);
  } else {
    getDb().run(sql);
  }
  saveDb();
}

export function queryAll<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
  const stmt = getDb().prepare(sql);
  if (params) stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined {
  const results = queryAll<T>(sql, params);
  return results.length > 0 ? results[0] : undefined;
}
