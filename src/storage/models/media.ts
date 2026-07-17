import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { queryAll, queryOne, runSql } from '../database.js';

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

export function getAllMedia(): MediaEntry[] {
  return queryAll<MediaEntry>('SELECT * FROM media ORDER BY created_at DESC');
}

export function getMedia(id: string): MediaEntry | undefined {
  return queryOne<MediaEntry>('SELECT * FROM media WHERE id = ?', [id]);
}

export function addMedia(
  originalName: string,
  fileName: string,
  filePath: string,
  mimeType: string,
  fileSize: number,
  width?: number | null,
  height?: number | null
): MediaEntry {
  const id = uuid();
  runSql(
    'INSERT INTO media (id, original_name, file_name, file_path, mime_type, file_size, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, originalName, fileName, filePath, mimeType, fileSize, width ?? null, height ?? null]
  );
  return getMedia(id)!;
}

export function markMediaCompressed(id: string): void {
  runSql('UPDATE media SET compressed = 1 WHERE id = ?', [id]);
}

export function deleteMedia(id: string): void {
  const m = getMedia(id);
  if (m) {
    try { fs.unlinkSync(m.file_path); } catch { /* ignore */ }
    runSql('DELETE FROM media WHERE id = ?', [id]);
  }
}
