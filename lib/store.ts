// Data access for the booking flow. One place that knows whether we are
// talking to Supabase or the demo store.

import { serviceClient } from './supabase'
import {
  DEMO_BLACKOUTS,
  DEMO_SERVICE_PERIODS,
  DEMO_SETTINGS,
  demoBookings,
  demoInsertBooking,
} from './demo-store'
import type { BlackoutDate, Booking, ServicePeriod, Settings } from './types'
import type { LocalDate, LocalTime } from './time'
import { dayOfWeek, trimSeconds } from './time'
import type { BookingPayload } from './validation'

export async function getSettings(): Promise<Settings> {
  const db = serviceClient()
  if (!db) return DEMO_SETTINGS

  const { data, error } = await db.from('settings').select('*').limit(1).single()
  if (error || !data) throw new Error('Could not load settings')
  return data as Settings
}

export async function getServicePeriods(dayOfWeek: number): Promise<ServicePeriod[]> {
  const db = serviceClient()
  if (!db) return DEMO_SERVICE_PERIODS.filter((p) => p.day_of_week === dayOfWeek)

  const { data, error } = await db
    .from('service_periods')
    .select('*')
    .eq('day_of_week', dayOfWeek)
    .eq('active', true)
  if (error) throw new Error('Could not load service periods')
  return (data ?? []) as ServicePeriod[]
}

export async function getBlackouts(date: LocalDate): Promise<BlackoutDate[]> {
  const db = serviceClient()
  if (!db) return DEMO_BLACKOUTS.filter((b) => b.date === date)

  const { data, error } = await db.from('blackout_dates').select('*').eq('date', date)
  if (error) throw new Error('Could not load blackout dates')
  return (data ?? []) as BlackoutDate[]
}

/** Covers already booked per slot on a date, excluding cancellations. */
export async function getBookedCovers(date: LocalDate): Promise<Record<LocalTime, number>> {
  const db = serviceClient()

  const rows: Array<{ booking_time: string; party_size: number }> = db
    ? await (async () => {
        const { data, error } = await db
          .from('bookings')
          .select('booking_time, party_size')
          .eq('booking_date', date)
          .neq('status', 'cancelled')
        if (error) throw new Error('Could not load bookings')
        return data ?? []
      })()
    : demoBookings()
        .filter((b) => b.booking_date === date && b.status !== 'cancelled')
        .map((b) => ({ booking_time: b.booking_time, party_size: b.party_size }))

  const covers: Record<LocalTime, number> = {}
  for (const row of rows) {
    const slot = trimSeconds(row.booking_time)
    covers[slot] = (covers[slot] ?? 0) + row.party_size
  }
  return covers
}

/** Looks a booking up by its cancellation token. Public, so token-only. */
export async function bookingByToken(token: string): Promise<Booking | null> {
  const db = serviceClient()

  if (!db) {
    return demoBookings().find((b) => b.cancellation_token === token) ?? null
  }

  const { data, error } = await db
    .from('bookings')
    .select('*')
    .eq('cancellation_token', token)
    .maybeSingle()

  if (error) return null
  return (data as Booking) ?? null
}

/**
 * Cancels by token. Idempotent: cancelling an already-cancelled booking returns
 * the booking rather than an error, so a guest who clicks the emailed link twice
 * sees "already cancelled" instead of a dead end.
 */
export async function cancelByToken(
  token: string
): Promise<{ booking: Booking | null; alreadyCancelled: boolean }> {
  const db = serviceClient()

  if (!db) {
    const booking = demoBookings().find((b) => b.cancellation_token === token)
    if (!booking) return { booking: null, alreadyCancelled: false }
    if (booking.status === 'cancelled') return { booking, alreadyCancelled: true }
    booking.status = 'cancelled'
    return { booking, alreadyCancelled: false }
  }

  const existing = await bookingByToken(token)
  if (!existing) return { booking: null, alreadyCancelled: false }
  if (existing.status === 'cancelled') return { booking: existing, alreadyCancelled: true }

  const { data, error } = await db.rpc('cancel_booking', { p_token: token })
  if (error) return { booking: null, alreadyCancelled: false }
  return { booking: data as Booking, alreadyCancelled: false }
}

export type CreateBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; code: 'NO_SERVICE' | 'BLACKOUT' | 'FULL' | 'DUPLICATE' | 'ERROR' }

/**
 * Creates a booking. In Supabase mode this is the `create_booking` RPC, which
 * re-checks capacity inside an advisory lock — the RPC is the source of truth,
 * not the availability call the client made a moment earlier.
 */
export async function createBooking(
  payload: BookingPayload,
  opts: { source?: string; overrideCapacity?: boolean } = {}
): Promise<CreateBookingResult> {
  const db = serviceClient()

  if (!db) {
    // Demo mode: single Node process, so a plain re-check is equivalent enough
    // to show the behaviour. It is not a substitute for the RPC.
    const clash = demoBookings().some(
      (b) =>
        b.status !== 'cancelled' &&
        b.email === payload.email &&
        b.booking_date === payload.booking_date &&
        b.booking_time === payload.booking_time &&
        b.party_size === payload.party_size
    )
    if (clash) return { ok: false, code: 'DUPLICATE' }

    const covers = await getBookedCovers(payload.booking_date)
    const booked = covers[payload.booking_time] ?? 0
    const cap = Math.max(
      0,
      ...DEMO_SERVICE_PERIODS.filter(
        (p) => p.active && p.day_of_week === dayOfWeek(payload.booking_date)
      ).map((p) => p.max_covers_per_slot)
    )
    if (!opts.overrideCapacity && booked + payload.party_size > cap) {
      return { ok: false, code: 'FULL' }
    }

    return {
      ok: true,
      booking: demoInsertBooking({
        ...payload,
        source: opts.source ?? 'web',
      }),
    }
  }

  const { data, error } = await db.rpc('create_booking', {
    p_booking_date: payload.booking_date,
    p_booking_time: payload.booking_time,
    p_party_size: payload.party_size,
    p_first_name: payload.first_name,
    p_last_name: payload.last_name,
    p_email: payload.email,
    p_phone: payload.phone,
    p_notes: payload.notes,
    p_occasion: payload.occasion,
    p_marketing_opt_in: payload.marketing_opt_in,
    p_source: opts.source ?? 'web',
    p_override_capacity: opts.overrideCapacity ?? false,
  })

  if (error) {
    const message = error.message ?? ''
    if (message.includes('IRMAK_NO_SERVICE')) return { ok: false, code: 'NO_SERVICE' }
    if (message.includes('IRMAK_BLACKOUT')) return { ok: false, code: 'BLACKOUT' }
    if (message.includes('IRMAK_FULL')) return { ok: false, code: 'FULL' }
    if (message.includes('IRMAK_DUPLICATE')) return { ok: false, code: 'DUPLICATE' }
    // Never log the payload: it contains the guest's personal data.
    console.error('create_booking failed', { code: error.code })
    return { ok: false, code: 'ERROR' }
  }

  return { ok: true, booking: data as Booking }
}
