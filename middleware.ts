import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes the staff session on every /admin request and turns anyone without
 * one away at the door.
 *
 * Note what happens when Supabase is not configured: /admin redirects to the
 * login page, which explains the situation. It does NOT fall through to an open
 * admin panel. A missing environment variable must never be the thing standing
 * between the public and the booking data.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const loginPath = '/admin/login'
  const isLogin = request.nextUrl.pathname === loginPath

  // The design preview at /admin/preview renders the admin components against
  // fixtures. It holds no real data and its form actions are no-ops, so it does
  // not need a session — but it is only reachable in development, and the page
  // itself calls notFound() outside development regardless of this check.
  if (
    process.env.NODE_ENV === 'development' &&
    request.nextUrl.pathname.startsWith('/admin/preview')
  ) {
    return response
  }

  if (!url || !key) {
    if (isLogin) return response
    return NextResponse.redirect(new URL(loginPath, request.url))
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options })
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options })
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })

  // Validates the token with Supabase rather than trusting the cookie, and
  // refreshes it if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isLogin) {
    const redirect = new URL(loginPath, request.url)
    // Send them where they were heading once they are in.
    redirect.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(redirect)
  }

  if (user && isLogin) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
