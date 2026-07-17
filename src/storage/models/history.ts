import { v4 as uuid } from 'uuid';
import { queryAll, runSql } from '../database.js';

export interface HistoryEntry {
  id: string;
  task_id: string | null;
  group_id: string;
  group_name: string;
  status: string;
  text_content: string;
  media_count: number;
  created_at: string;
}

export function getAllHistory(limit = 100): HistoryEntry[] {
  return queryAll<HistoryEntry>('SELECT * FROM history ORDER BY created_at DESC LIMIT ?', [limit]);
}

export function getHistoryByTask(taskId: string): HistoryEntry[] {
  return queryAll<HistoryEntry>('SELECT * FROM history WHERE task_id = ? ORDER BY created_at', [taskId]);
}

export function addHistory(
  taskId: string | null,
  groupId: string,
  groupName: string,
  status: string,
  textContent: string,
  mediaCount: number
): HistoryEntry {
  const id = uuid();
  runSql(
    'INSERT INTO history (id, task_id, group_id, group_name, status, text_content, media_count) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, taskId, groupId, groupName, status, textContent, mediaCount]
  );
  return queryAll<HistoryEntry>('SELECT * FROM history WHERE id = ?', [id])[0];
}

export function deleteHistoryOlderThan(days: number): void {
  runSql("DELETE FROM history WHERE created_at < datetime('now', ?)", [`-${days} days`]);
}
