import { v4 as uuid } from 'uuid';
import { getSupabase } from '../database.js';

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
  delay_seconds: number;
}

export async function getAllTasks(): Promise<Task[]> {
  const { data, error } = await getSupabase().from('tasks').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeTask);
}

export async function getPendingTasks(): Promise<Task[]> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from('tasks')
    .select('*')
    .eq('status', 'pending')
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
    .order('created_at');
  if (error) throw error;
  return (data || []).map(normalizeTask);
}

export async function getTask(id: string): Promise<Task | undefined> {
  const { data, error } = await getSupabase().from('tasks').select('*').eq('id', id).single();
  if (error) return undefined;
  return normalizeTask(data);
}

export async function createTask(
  type: string,
  groupIds: string[],
  textContent: string,
  mediaPaths: string[],
  scheduledAt?: string | null,
  maxRetries = 3,
  delaySeconds?: number
): Promise<Task> {
  const id = uuid();
  const { error } = await getSupabase().from('tasks').insert({
    id,
    type,
    group_ids: groupIds,
    text_content: textContent,
    media_paths: mediaPaths,
    scheduled_at: scheduledAt || null,
    max_retries: maxRetries,
    delay_seconds: delaySeconds ?? 240,
  });
  if (error) throw error;
  return getTask(id) as Promise<Task>;
}

export async function updateTaskStatus(id: string, status: TaskStatus, error?: string): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (status === 'running' || status === 'done') {
    update.executed_at = new Date().toISOString();
  }
  if (status === 'failed' && error) {
    update.error = error;
  }
  const { error: err } = await getSupabase().from('tasks').update(update).eq('id', id);
  if (err) throw err;
}

export async function incrementTaskRetry(id: string): Promise<void> {
  const { data } = await getSupabase().from('tasks').select('retries').eq('id', id).single();
  if (data) {
    await getSupabase().from('tasks').update({ retries: data.retries + 1 }).eq('id', id);
  }
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await getSupabase().from('tasks').delete().eq('id', id);
  if (error) throw error;
}

function normalizeTask(row: any): Task {
  return {
    ...row,
    group_ids: typeof row.group_ids === 'string' ? row.group_ids : JSON.stringify(row.group_ids || []),
    media_paths: typeof row.media_paths === 'string' ? row.media_paths : JSON.stringify(row.media_paths || []),
  };
}
