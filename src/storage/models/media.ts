import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { getSupabase } from '../database.js';

export interface MediaEntry {
  id: string;
  original_name: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  compressed: number;
  created_at: string;
}

export async function getAllMedia(): Promise<MediaEntry[]> {
  const { data, error } = await getSupabase().from('media').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMedia(id: string): Promise<MediaEntry | undefined> {
  const { data, error } = await getSupabase().from('media').select('*').eq('id', id).single();
  if (error) return undefined;
  return data;
}

export async function addMedia(
  originalName: string,
  fileName: string,
  filePath: string,
  mimeType: string,
  fileSize: number,
  width?: number | null,
  height?: number | null
): Promise<MediaEntry> {
  const id = uuid();
  const { error } = await getSupabase().from('media').insert({
    id,
    original_name: originalName,
    file_name: fileName,
    file_path: filePath,
    mime_type: mimeType,
    file_size: fileSize,
    width: width ?? null,
    height: height ?? null,
  });
  if (error) throw error;
  return getMedia(id) as Promise<MediaEntry>;
}

export async function markMediaCompressed(id: string): Promise<void> {
  const { error } = await getSupabase().from('media').update({ compressed: 1 }).eq('id', id);
  if (error) throw error;
}

export async function deleteMedia(id: string): Promise<void> {
  const m = await getMedia(id);
  if (m) {
    try { fs.unlinkSync(m.file_path); } catch { /* ignore */ }
    const { error } = await getSupabase().from('media').delete().eq('id', id);
    if (error) throw error;
  }
}
