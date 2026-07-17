import { v4 as uuid } from 'uuid';
import { queryAll, queryOne, runSql } from '../database.js';

export interface Group {
  id: string;
  name: string;
  url: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export function getAllGroups(): Group[] {
  return queryAll<Group>('SELECT * FROM groups ORDER BY name');
}

export function getGroup(id: string): Group | undefined {
  return queryOne<Group>('SELECT * FROM groups WHERE id = ?', [id]);
}

export function addGroup(name: string, url: string, category = ''): Group {
  const id = uuid();
  runSql('INSERT INTO groups (id, name, url, category) VALUES (?, ?, ?, ?)', [id, name, url, category]);
  return getGroup(id)!;
}

export function deleteGroup(id: string): void {
  runSql('DELETE FROM groups WHERE id = ?', [id]);
}

export function updateGroup(id: string, data: Partial<Group>): void {
  const keys = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at');
  if (!keys.length) return;
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => (data as Record<string, unknown>)[k]);
  runSql(`UPDATE groups SET ${setClause}, updated_at = datetime('now') WHERE id = ?`, [...values, id]);
}

export function getGroupCategories(): string[] {
  const rows = queryAll<{ category: string }>(
    "SELECT DISTINCT category FROM groups WHERE category != '' ORDER BY category"
  );
  return rows.map(r => r.category);
}
