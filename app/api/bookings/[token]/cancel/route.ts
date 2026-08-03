import { NextResponse } from 'next/server'
import { cancelByToken, getSettings } from '@/lib/store'
import { sendCancellationConfirmation, sendQuietly } from '@/lib/email'
import { clientIp, pruneRateLimits, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Cancels a booking from the emailed link. The token is the only credential, so
 * this is deliberately narrow: it flips status and nothing else.
 *
 * Rate limited because the token is a bearer credential in a URL — without it,
 * the endpoint would let someone grind through guesses.
 */
export async function POST(_request: Request, { params }: { params: { token: string } }) {
  const ip = clientIp(_request)
  pruneRateLimits()

  const limit = rateLimit(`cancel:${ip}`)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  if (!UUID.test(params.token)) {
    return NextResponse.json({ error: 'That cancellation link is not valid.' }, { status: 400 })
  }

  try {
    const { booking, alreadyCancelled } = await cancelByToken(params.token)

    if (!booking) {
      return NextResponse.json({ error: 'We could not find that booking.' }, { status: 404 })
    }

    // Idempotent: a second click is a success, not an error.
    if (alreadyCancelled) {
      return NextResponse.json({ ok: true, alreadyCancelled: true })
    }

    const settings = await getSettings()
    await sendQuietly(
      sendCancellationConfirmation(booking, settings),
      'cancellation confirmation'
    )

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: 'We could not cancel that booking. Please call us.' },
      { status: 500 }
    )
  }
}
