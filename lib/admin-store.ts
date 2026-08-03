// Admin data access. Everything here goes through the staff member's session
// client, so RLS applies to every query — the service role key is never used on
// the admin surface.

import { sessionClient } from './supabase-server'
import type { Booking, BlackoutDate, BookingStatus, ServicePeriod, Settings } from './types'
import type { LocalDate } from './time'

export interface CustomerRow {
  email: string
  name: string
  phone: string
  total_bookings: number
  last_visit: string | null
  marketing_opt_in: boolean
  opt_in_at: string | null
}

function db() {
  const client = sessionClient()
  if (!client) throw new Error('Supabase is not configured')
  return client
}

/** Every booking on a date, earliest first. Cancelled ones included so staff can see them. */
export async function bookingsForDate(date: LocalDate): Promise<Booking[]> {
  const { data, error } = await db()
    .from('bookings')
    .select('*')
    .eq('booking_date', date)
    .order('booking_time', { ascending: true })

  if (error) throw new Error('Could not load bookings')
  return (data ?? []) as Booking[]
}

export async function bookingById(id: string): Promise<Booking | null> {
  const { data, error } = await db().from('bookings').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error('Could not load booking')
  return (data as Booking) ?? null
}

export async function setBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const { error } = await db().from('bookings').update({ status }).eq('id', id)
  if (error) throw new Error('Could not update the booking status')
}

export async function updateBooking(
  id: string,
  fields: Partial<Pick<Booking, 'party_size' | 'booking_time' | 'internal_notes'>>
): Promise<void> {
  const { error } = await db().from('bookings').update(fields).eq('id', id)
  if (error) throw new Error('Could not save the booking')
}

/** Covers already booked per slot on a date, for the capacity warning on manual entry. */
export async function coversForDate(date: LocalDate): Promise<Record<string, number>> {
  const { data, error } = await db()
    .from('bookings')
    .select('booking_time, party_size')
    .eq('booking_date', date)
    .neq('status', 'cancelled')

  if (error) throw new Error('Could not load covers')

  const covers: Record<string, number> = {}
  for (const row of data ?? []) {
    const slot = String(row.booking_time).slice(0, 5)
    covers[slot] = (covers[slot] ?? 0) + Number(row.party_size)
  }
  return covers
}

export async function adminSettings(): Promise<Settings> {
  const { data, error } = await db().from('settings').select('*').limit(1).single()
  if (error || !data) throw new Error('Could not load settings')
  return data as Settings
}

export async function updateSettings(fields: Partial<Settings>): Promise<void> {
  const { error } = await db().from('settings').update(fields).eq('id', true)
  if (error) throw new Error('Could not save settings')
}

export async function allServicePeriods(): Promise<ServicePeriod[]> {
  const { data, error } = await db()
    .from('service_periods')
    .select('*')
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) throw new Error('Could not load service periods')
  return (data ?? []) as ServicePeriod[]
}

export async function updateServicePeriod(
  id: string,
  fields: Partial<Pick<ServicePeriod, 'max_covers_per_slot' | 'slot_interval_minutes' | 'active'>>
): Promise<void> {
  const { error } = await db().from('service_periods').update(fields).eq('id', id)
  if (error) throw new Error('Could not save the service period')
}

export async function upcomingBlackouts(fromDate: LocalDate): Promise<BlackoutDate[]> {
  const { data, error } = await db()
    .from('blackout_dates')
    .select('*')
    .gte('date', fromDate)
    .order('date', { ascending: true })

  if (error) throw new Error('Could not load blackout dates')
  return (data ?? []) as BlackoutDate[]
}

export async function addBlackout(input: {
  date: LocalDate
  start_time: string | null
  end_time: string | null
  reason: string
}): Promise<void> {
  const { error } = await db().from('blackout_dates').insert(input)
  if (error) throw new Error('Could not add the blackout date')
}

export async function removeBlackout(id: string): Promise<void> {
  const { error } = await db().from('blackout_dates').delete().eq('id', id)
  if (error) throw new Error('Could not remove the blackout date')
}

/** The derived customers view. No separate table, no sync. */
export async function customers(): Promise<CustomerRow[]> {
  const { data, error } = await db()
    .from('customers')
    .select('*')
    .order('total_bookings', { ascending: false })

  if (error) throw new Error('Could not load customers')
  return (data ?? []) as CustomerRow[]
}

/** UK GDPR erasure. Removes every booking for the address. */
export async function deleteCustomer(email: string): Promise<number> {
  const { data, error } = await db().rpc('delete_customer', { p_email: email })
  if (error) throw new Error('Could not delete that customer')
  return Number(data ?? 0)
}
