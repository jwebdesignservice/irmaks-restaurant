// Mutable in-memory store behind the dev-only admin preview.
//
// This makes every button in the preview actually work — status changes, edits,
// manual bookings, erasure, settings, blackouts — so the panel can be reviewed
// and demonstrated properly before Supabase exists.
//
// It is process-local and resets when the dev server restarts. It is never
// reachable outside development: the preview route calls notFound() and the
// middleware bypass is gated on NODE_ENV.

import type { BlackoutDate, Booking, BookingStatus, ServicePeriod, Settings } from './types'
import type { CustomerRow } from './admin-store'
import {
  PREVIEW_SETTINGS,
  previewBlackouts,
  previewBookings,
  previewServicePeriods,
} from './preview-fixtures'
import { todayInLondon, trimSeconds } from './time'

interface PreviewState {
  bookings: Booking[]
  settings: Settings
  periods: ServicePeriod[]
  blackouts: BlackoutDate[]
}

// Hung off globalThis: Next.js gives each route bundle and each server action
// its own module instance, so a module-level object would mean a button wrote to
// one copy while the page read from another.
const KEY = Symbol.for('irmak.preview.state')
type GlobalWithState = typeof globalThis & { [KEY]?: PreviewState }

function state(): PreviewState {
  const g = globalThis as GlobalWithState
  if (!g[KEY]) {
    const today = todayInLondon()
    g[KEY] = {
      bookings: previewBookings(today),
      settings: { ...PREVIEW_SETTINGS },
      periods: previewServicePeriods(),
      blackouts: previewBlackouts(today),
    }
  }
  return g[KEY]!
}

/** Restores the seeded sample data, for the preview's Reset button. */
export function previewReset(): void {
  const g = globalThis as GlobalWithState
  delete g[KEY]
  state()
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export function previewBookingsForDate(date: string): Booking[] {
  return state()
    .bookings.filter((b) => b.booking_date === date)
    .sort((a, b) => a.booking_time.localeCompare(b.booking_time))
}

export function previewFindBooking(id: string): Booking | null {
  return state().bookings.find((b) => b.id === id) ?? null
}

export function previewGetSettings(): Settings {
  return state().settings
}

export function previewGetPeriods(): ServicePeriod[] {
  return state().periods
}

export function previewGetBlackouts(fromDate: string): BlackoutDate[] {
  return state()
    .blackouts.filter((b) => b.date >= fromDate)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function previewCoversForDate(date: string): number {
  return previewBookingsForDate(date)
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.party_size, 0)
}

/**
 * Customers derived from bookings, mirroring the `customers` SQL view rather
 * than keeping a second list in sync. Deleting a customer here therefore has to
 * remove their bookings, exactly as the real erasure RPC does.
 */
export function previewCustomerRows(): CustomerRow[] {
  const byEmail = new Map<string, Booking[]>()
  for (const booking of state().bookings) {
    const key = booking.email.toLowerCase()
    const list = byEmail.get(key)
    if (list) list.push(booking)
    else byEmail.set(key, [booking])
  }

  const rows: CustomerRow[] = []
  for (const [email, bookings] of byEmail) {
    const visits = bookings
      .filter((b) => b.status === 'arrived')
      .map((b) => b.booking_date)
      .sort()
    const optIns = bookings.filter((b) => b.marketing_opt_in && b.opt_in_at)

    rows.push({
      email,
      name: bookings
        .map((b) => `${b.first_name} ${b.last_name}`)
        .sort()
        .at(-1)!,
      phone: bookings
        .map((b) => b.phone)
        .sort()
        .at(-1)!,
      total_bookings: bookings.filter((b) => b.status !== 'cancelled').length,
      last_visit: visits.at(-1) ?? null,
      marketing_opt_in: bookings.some((b) => b.marketing_opt_in),
      opt_in_at: optIns.map((b) => b.opt_in_at!).sort().at(-1) ?? null,
    })
  }

  return rows.sort((a, b) => b.total_bookings - a.total_bookings)
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export function previewSetStatus(id: string, status: BookingStatus): void {
  const booking = previewFindBooking(id)
  if (booking) booking.status = status
}

export function previewUpdateBooking(
  id: string,
  fields: Partial<Pick<Booking, 'party_size' | 'booking_time' | 'internal_notes'>>
): void {
  const booking = previewFindBooking(id)
  if (!booking) return
  if (fields.party_size !== undefined) booking.party_size = fields.party_size
  if (fields.booking_time !== undefined) booking.booking_time = `${trimSeconds(fields.booking_time)}:00`
  if (fields.internal_notes !== undefined) booking.internal_notes = fields.internal_notes
}

export interface PreviewNewBooking {
  booking_date: string
  booking_time: string
  party_size: number
  first_name: string
  last_name: string
  email: string
  phone: string
  notes: string | null
  occasion: string | null
  marketing_opt_in: boolean
  override_capacity: boolean
}

export type PreviewCreateResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

/** Mirrors create_booking, including the capacity check and the override. */
export function previewCreateBooking(input: PreviewNewBooking): PreviewCreateResult {
  const s = state()
  const time = `${trimSeconds(input.booking_time)}:00`

  const duplicate = s.bookings.some(
    (b) =>
      b.status !== 'cancelled' &&
      b.email.toLowerCase() === input.email.toLowerCase() &&
      b.booking_date === input.booking_date &&
      b.booking_time === time &&
      b.party_size === input.party_size
  )
  if (duplicate) return { ok: false, error: 'That guest already has a booking at that time.' }

  if (!input.override_capacity) {
    const cap = Math.max(
      0,
      ...s.periods
        .filter((p) => p.active && p.day_of_week === dayOfWeekOf(input.booking_date))
        .map((p) => p.max_covers_per_slot)
    )
    const booked = s.bookings
      .filter(
        (b) =>
          b.booking_date === input.booking_date &&
          b.booking_time === time &&
          b.status !== 'cancelled'
      )
      .reduce((sum, b) => sum + b.party_size, 0)

    if (cap === 0) {
      return {
        ok: false,
        error:
          'The restaurant is not serving at that time. Tick "Allow over capacity" to book it anyway.',
      }
    }
    if (booked + input.party_size > cap) {
      return {
        ok: false,
        error: `That slot is at capacity (${booked} of ${cap} covers). Tick "Allow over capacity" to book it anyway.`,
      }
    }
    if (
      s.blackouts.some(
        (b) =>
          b.date === input.booking_date &&
          (b.start_time === null ||
            (trimSeconds(b.start_time) <= trimSeconds(time) &&
              trimSeconds(time) <= trimSeconds(b.end_time!)))
      )
    ) {
      return {
        ok: false,
        error: 'That date is blacked out. Tick "Allow over capacity" to book it anyway.',
      }
    }
  }

  const seq = s.bookings.length + 1
  const id = `00000000-0000-4000-8001-${String(seq).padStart(12, '0')}`
  const now = new Date().toISOString()

  s.bookings.push({
    id,
    created_at: now,
    booking_date: input.booking_date,
    booking_time: time,
    party_size: input.party_size,
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email.toLowerCase(),
    phone: input.phone,
    notes: input.notes,
    internal_notes: null,
    occasion: input.occasion,
    status: 'confirmed',
    marketing_opt_in: input.marketing_opt_in,
    opt_in_at: input.marketing_opt_in ? now : null,
    cancellation_token: `11111111-1111-4111-8001-${String(seq).padStart(12, '0')}`,
    source: 'phone',
  })

  return { ok: true, id }
}

export function previewDeleteCustomer(email: string): number {
  const s = state()
  const before = s.bookings.length
  s.bookings = s.bookings.filter((b) => b.email.toLowerCase() !== email.trim().toLowerCase())
  return before - s.bookings.length
}

export function previewSaveSettings(fields: Partial<Settings>): void {
  Object.assign(state().settings, fields)
}

export function previewSavePeriod(
  id: string,
  fields: Partial<Pick<ServicePeriod, 'max_covers_per_slot' | 'slot_interval_minutes' | 'active'>>
): void {
  const period = state().periods.find((p) => p.id === id)
  if (period) Object.assign(period, fields)
}

export function previewAddBlackout(input: {
  date: string
  start_time: string | null
  end_time: string | null
  reason: string
}): void {
  const s = state()
  s.blackouts.push({
    id: `00000000-0000-4000-a001-${String(s.blackouts.length + 1).padStart(12, '0')}`,
    date: input.date,
    start_time: input.start_time ? `${trimSeconds(input.start_time)}:00` : null,
    end_time: input.end_time ? `${trimSeconds(input.end_time)}:00` : null,
    reason: input.reason,
  })
}

export function previewRemoveBlackout(id: string): void {
  const s = state()
  s.blackouts = s.blackouts.filter((b) => b.id !== id)
}

function dayOfWeekOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}
