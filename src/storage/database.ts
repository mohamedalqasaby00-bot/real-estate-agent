import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase not initialized. Call initDb() first.');
  }
  return supabase;
}

export function initDb(): void {
  if (supabase) return;
  supabase = createClient(config.supabase.url, config.supabase.anonKey);
  console.log('✅ Connected to Supabase');
}

export function closeDb(): void {
  supabase = null;
}

export function saveDb(): void {
  // No-op: Supabase persists automatically
}
