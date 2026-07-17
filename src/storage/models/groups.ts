import { v4 as uuid } from 'uuid';
import { getSupabase } from '../database.js';

export interface Group {
  id: string;
  name: string;
  url: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export async function getAllGroups(): Promise<Group[]> {
  const { data, error } = await getSupabase().from('groups').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function getGroup(id: string): Promise<Group | undefined> {
  const { data, error } = await getSupabase().from('groups').select('*').eq('id', id).single();
  if (error) return undefined;
  return data;
}

export async function addGroup(name: string, url: string, category = ''): Promise<Group> {
  const id = uuid();
  const { error } = await getSupabase().from('groups').insert({ id, name, url, category });
  if (error) throw error;
  return getGroup(id) as Promise<Group>;
}

export async function deleteGroup(id: string): Promise<void> {
  const { error } = await getSupabase().from('groups').delete().eq('id', id);
  if (error) throw error;
}

export async function updateGroup(id: string, data: Partial<Group>): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) update.name = data.name;
  if (data.url !== undefined) update.url = data.url;
  if (data.category !== undefined) update.category = data.category;
  const { error } = await getSupabase().from('groups').update(update).eq('id', id);
  if (error) throw error;
}

export async function getGroupCategories(): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from('groups')
    .select('category')
    .neq('category', '')
    .order('category');
  if (error) throw error;
  const cats = [...new Set((data || []).map((r: { category: string }) => r.category))];
  return cats;
}
