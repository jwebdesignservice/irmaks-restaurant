// Fixed-window rate limit, in memory.
//
// Per-instance rather than global: a Vercel deployment may run several lambda
// instances, so the effective limit is per instance. That is fine for the
// volumes here — this is a speed bump against a script hammering the endpoint,
// and Turnstile plus the honeypot are the real bot defences.

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()
const WINDOW_MS = 60_000
const MAX_REQUESTS = 8

export function rateLimit(key: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
  const existing = windows.get(key)

  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfter: 0 }
  }

  existing.count += 1
  if (existing.count > MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) }
  }
  return { allowed: true, retryAfter: 0 }
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

/** Drops expired windows so the map cannot grow without bound. */
export function pruneRateLimits(now = Date.now()): void {
  for (const [key, window] of windows) {
    if (now >= window.resetAt) windows.delete(key)
  }
}
