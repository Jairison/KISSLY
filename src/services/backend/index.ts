import { isSupabaseConfigured } from '@/lib/supabase';

import { localBackend } from './local';
import { supabaseBackend } from './supabase';
import type { Backend } from './types';

/** Supabase quando o .env está preenchido; senão, o modo de demonstração local. */
export const backend: Backend = isSupabaseConfigured ? supabaseBackend : localBackend;

export * from './types';

export const PASSWORD_MIN = 8;

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
