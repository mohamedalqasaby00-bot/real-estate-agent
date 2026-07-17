import { v4 as uuid } from 'uuid';
import { queryAll, queryOne, runSql } from '../database.js';

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  type: string;
  status: TaskStatus;
  group_ids: string;
  text_content: string;
  media_paths: string;
  scheduled_at: string | null;
  executed_at: string | null;
  created_at: string;
  retries: number;
  max_retries: number;
  error: string | null;
}

export function getAllTasks(): Task[] {
  return queryAll<Task>('SELECT * FROM tasks ORDER BY created_at DESC');
}

export function getPendingTasks(): Task[] {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return queryAll<Task>(
    "SELECT * FROM tasks WHERE status = 'pending' AND (scheduled_at IS NULL OR scheduled_at <= ?) ORDER BY created_at",
    [now]
  );
}

export function getTask(id: string): Task | undefined {
  return queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
}

export function createTask(
  type: string,
  groupIds: string[],
  textContent: string,
  mediaPaths: string[],
  scheduledAt?: string | null,
  maxRetries = 3
): Task {
  const id = uuid();
  runSql(
    'INSERT INTO tasks (id, type, group_ids, text_content, media_paths, scheduled_at, max_retries) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, type, JSON.stringify(groupIds), textContent, JSON.stringify(mediaPaths), scheduledAt || null, maxRetries]
  );
  return getTask(id)!;
}

export function updateTaskStatus(id: string, status: TaskStatus, error?: string): void {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  if (status === 'running') {
    runSql('UPDATE tasks SET status = ?, executed_at = ? WHERE id = ?', [status, now, id]);
  } else if (status === 'done') {
    runSql('UPDATE tasks SET status = ?, executed_at = ? WHERE id = ?', [status, now, id]);
  } else if (status === 'failed' && error) {
    runSql('UPDATE tasks SET status = ?, error = ? WHERE id = ?', [status, error, id]);
  } else {
    runSql('UPDATE tasks SET status = ? WHERE id = ?', [status, id]);
  }
}

export function incrementTaskRetry(id: string): void {
  runSql('UPDATE tasks SET retries = retries + 1 WHERE id = ?', [id]);
}

export function deleteTask(id: string): void {
  runSql('DELETE FROM tasks WHERE id = ?', [id]);
}
