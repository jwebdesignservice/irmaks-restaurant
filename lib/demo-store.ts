// In-memory stand-in for Supabase, used only when the env vars are absent.
//
// This exists so the booking flow can be demonstrated to the client before the
// Supabase project is provisioned. It mirrors the seed migration exactly. It is
// process-local and resets on redeploy — delete this file once Supabase is
// wired up and the demo branches in lib/store.ts go with it.

import type { BlackoutDate, Booking, ServicePeriod, Settings } from './types'
import { randomUUID } from 'crypto'

export const DEMO_SERVICE_PERIODS: ServicePeriod[] = Array.from({ length: 7 }, (_, dow) => ({
  id: `demo-period-${dow}`,
  day_of_week: dow,
  name: 'All day',
  start_time: '12:00:00',
  end_time: '21:00:00',
  slot_interval_minutes: 15,
  max_covers_per_slot: 50,
  active: true,
}))

export const DEMO_SETTINGS: Settings = {
  max_party_size_online: 50,
  min_lead_time_minutes: 120,
  max_advance_days: 90,
  venue_email: 'info@irmak-restaurant.com',
  venue_name: 'Irmak',
  venue_address: 'Unit 7, Queens Link Leisure Park, 18 Esplanade, Aberdeen AB24 5NS',
  venue_phone: '01224 023161',
}

export const DEMO_BLACKOUTS: BlackoutDate[] = []

// Hung off globalThis rather than held in a module-level const: Next.js gives
// each route bundle its own module instance, so /api/bookings and
// /api/availability would otherwise write to and read from two different
// arrays, and booked covers would never affect availability.
const GLOBAL_KEY = Symbol.for('irmak.demo.bookings')
type GlobalWithBookings = typeof globalThis & { [GLOBAL_KEY]?: Booking[] }

export function demoBookings(): Booking[] {
  const g = globalThis as GlobalWithBookings
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = []
  return g[GLOBAL_KEY]!
}

export function demoInsertBooking(
  input: Omit<
    Booking,
    'id' | 'created_at' | 'cancellation_token' | 'status' | 'opt_in_at' | 'internal_notes'
  >
): Booking {
  const booking: Booking = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
    cancellation_token: randomUUID(),
    status: 'confirmed',
    occasion: input.occasion ?? null,
    internal_notes: null,
    opt_in_at: input.marketing_opt_in ? new Date().toISOString() : null,
  }
  demoBookings().push(booking)
  return booking
}
