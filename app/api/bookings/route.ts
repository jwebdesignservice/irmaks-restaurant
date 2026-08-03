import { NextResponse } from 'next/server'
import { computeAvailability, nearestAlternatives } from '@/lib/availability'
import {
  createBooking,
  getBlackouts,
  getBookedCovers,
  getServicePeriods,
  getSettings,
} from '@/lib/store'
import { dayOfWeek, minutesUntil } from '@/lib/time'
import { validateBooking } from '@/lib/validation'
import { clientIp, pruneRateLimits, rateLimit } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/turnstile'
import { sendGuestConfirmation, sendQuietly, sendVenueNotification } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const ip = clientIp(request)
  pruneRateLimits()

  const limit = rateLimit(ip)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const raw = body as Record<string, unknown>

  // Honeypot: a real guest never fills this, it is hidden from view and from
  // assistive tech. Return a plausible-looking success so a bot learns nothing.
  if (typeof raw.company === 'string' && raw.company.trim() !== '') {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  const turnstileToken = typeof raw.turnstile_token === 'string' ? raw.turnstile_token : null
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return NextResponse.json(
      { error: 'We could not verify that request. Please reload the page and try again.' },
      { status: 400 }
    )
  }

  try {
    const settings = await getSettings()

    // Party size above the online limit is a phone booking, not an error.
    const requestedParty = Number(raw.party_size)
    if (Number.isInteger(requestedParty) && requestedParty > settings.max_party_size_online) {
      return NextResponse.json(
        {
          error: `For parties of more than ${settings.max_party_size_online}, please call us on ${settings.venue_phone} so we can look after you properly.`,
          callUs: { phone: settings.venue_phone },
        },
        { status: 400 }
      )
    }

    const validated = validateBooking(body, settings.max_party_size_online)
    if (!validated.ok) {
      return NextResponse.json(
        { error: validated.message, field: validated.field },
        { status: 400 }
      )
    }
    const payload = validated.value

    // Re-check the window server-side. The client sent these values; they are
    // not evidence of anything.
    const minutes = minutesUntil(payload.booking_date, payload.booking_time)
    if (minutes < settings.min_lead_time_minutes) {
      return NextResponse.json(
        { error: 'That time is too soon to book online. Please call us and we will help.' },
        { status: 400 }
      )
    }

    const result = await createBooking(payload, { source: 'web' })

    if (result.ok) {
      const booking = result.booking

      // Awaited so a serverless instance is not frozen mid-send, but wrapped so
      // a mail failure can never turn a successful booking into an error.
      await Promise.all([
        sendQuietly(sendGuestConfirmation(booking, settings), 'guest confirmation'),
        sendQuietly(sendVenueNotification(booking, settings), 'venue notification'),
      ])

      return NextResponse.json(
        {
          ok: true,
          booking: {
            booking_date: booking.booking_date,
            booking_time: booking.booking_time.slice(0, 5),
            party_size: booking.party_size,
            first_name: booking.first_name,
            cancellation_token: booking.cancellation_token,
          },
          venue: {
            name: settings.venue_name,
            address: settings.venue_address,
            phone: settings.venue_phone,
          },
        },
        { status: 201 }
      )
    }

    if (result.code === 'DUPLICATE') {
      // Almost always a double-tapped confirm. Treat it as success rather than
      // telling the guest something went wrong when it did not.
      return NextResponse.json(
        { ok: true, duplicate: true },
        { status: 200 }
      )
    }

    if (result.code === 'FULL' || result.code === 'NO_SERVICE' || result.code === 'BLACKOUT') {
      // The slot went while they were filling in the form. Give them somewhere
      // to go instead of a generic error.
      const [servicePeriods, blackouts, bookedCovers] = await Promise.all([
        getServicePeriods(dayOfWeek(payload.booking_date)),
        getBlackouts(payload.booking_date),
        getBookedCovers(payload.booking_date),
      ])
      const availability = computeAvailability({
        date: payload.booking_date,
        partySize: payload.party_size,
        servicePeriods,
        blackouts,
        bookedCovers,
        settings,
      })

      return NextResponse.json(
        {
          error:
            result.code === 'FULL'
              ? 'That slot just filled up.'
              : 'We are not taking bookings at that time.',
          alternatives: nearestAlternatives(availability.slots, payload.booking_time),
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Something went wrong saving your booking. Please try again or call us.' },
      { status: 500 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong saving your booking. Please try again or call us.' },
      { status: 500 }
    )
  }
}
