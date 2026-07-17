import { v4 as uuid } from 'uuid';
import { getSupabase } from '../database.js';

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

export async function getAllHistory(limit = 100): Promise<HistoryEntry[]> {
  const { data, error } = await getSupabase()
    .from('history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getHistoryByTask(taskId: string): Promise<HistoryEntry[]> {
  const { data, error } = await getSupabase()
    .from('history')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function addHistory(
  taskId: string | null,
  groupId: string,
  groupName: string,
  status: string,
  textContent: string,
  mediaCount: number
): Promise<HistoryEntry> {
  const id = uuid();
  const { data, error } = await getSupabase().from('history').insert({
    id,
    task_id: taskId,
    group_id: groupId,
    group_name: groupName,
    status,
    text_content: textContent,
    media_count: mediaCount,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteHistoryOlderThan(days: number): Promise<void> {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const { error } = await getSupabase().from('history').delete().lt('created_at', cutoff);
  if (error) throw error;
}
