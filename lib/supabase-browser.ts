'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser client, used only for the login form's signInWithPassword call so the
 * session cookie gets written. Every actual data read and write happens on the
 * server. Uses the anon key, which is safe to ship — RLS is what protects the
 * data, and there are no anon policies.
 */
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
