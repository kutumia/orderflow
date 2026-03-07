/**
 * Supabase client factory for server-side use (bypasses RLS).
 * Used by packages so they do not depend on app path aliases.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  const url = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = typeof process !== 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  cachedAdmin = createClient(url, key);
  return cachedAdmin;
}
