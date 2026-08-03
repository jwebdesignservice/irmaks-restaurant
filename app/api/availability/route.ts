import { NextResponse } from 'next/server'
import { computeAvailability } from '@/lib/availability'
import { getBlackouts, getBookedCovers, getServicePeriods, getSettings } from '@/lib/store'
import { dayOfWeek } from '@/lib/time'
import { isValidDate } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? ''
  const partySize = Number(searchParams.get('party_size'))

  if (!isValidDate(date)) {
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
  }
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 100) {
    return NextResponse.json({ error: 'Invalid party size.' }, { status: 400 })
  }

  try {
    const settings = await getSettings()

    // Large parties short-circuit: no need to touch the booking tables.
    if (partySize > settings.max_party_size_online) {
      return NextResponse.json({
        date,
        slots: [],
        callUs: {
          reason: 'party_too_large',
          maxOnline: settings.max_party_size_online,
          phone: settings.venue_phone,
        },
      })
    }

    const [servicePeriods, blackouts, bookedCovers] = await Promise.all([
      getServicePeriods(dayOfWeek(date)),
      getBlackouts(date),
      getBookedCovers(date),
    ])

    const result = computeAvailability({
      date,
      partySize,
      servicePeriods,
      blackouts,
      bookedCovers,
      settings,
    })

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not load availability. Please try again.' },
      { status: 500 }
    )
  }
}
