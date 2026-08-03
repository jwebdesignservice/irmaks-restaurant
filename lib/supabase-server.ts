import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase client bound to the staff member's session cookie.
 *
 * This is the ONLY client the admin uses. It carries the authenticated role, so
 * every read and write goes through the RLS policies from migration 0001 —
 * the service role key never touches the admin surface.
 */
export function sessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  const cookieStore = cookies()

  return createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        // Server Components cannot set cookies. The middleware refreshes the
        // session instead, so swallowing this is correct rather than lossy.
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          /* called from a Server Component — middleware handles refresh */
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch {
          /* as above */
        }
      },
    },
  })
}

/** True when Supabase Auth is not configured, so admin cannot work at all. */
export function authConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

/**
 * The signed-in staff user, or null.
 *
 * Uses getUser(), which validates the token against Supabase, rather than
 * getSession(), which trusts whatever is in the cookie.
 */
export async function currentUser() {
  const db = sessionClient()
  if (!db) return null
  const { data, error } = await db.auth.getUser()
  if (error) return null
  return data.user ?? null
}
