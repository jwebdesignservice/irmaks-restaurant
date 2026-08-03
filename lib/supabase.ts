import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client. Server-side only — this key bypasses RLS, so it must
 * never reach the browser. Public writes go through route handlers that
 * validate the payload themselves; the client is never trusted.
 */
export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * True when Supabase is not configured. The booking page then runs against the
 * in-memory demo store in lib/demo-store.ts so the flow can be shown to the
 * client before the project is provisioned.
 */
export function isDemoMode(): boolean {
  return serviceClient() === null
}
