// Sample data for the dev-only admin UI preview at /admin/preview.
//
// Shaped like a real busy Sunday from the brief — 21 bookings, 93 covers — so
// the screens are reviewed at the density staff will actually see, not with
// three tidy rows.
//
// Every name, email and phone here is invented. Numbers use Ofcom's 07700 900xxx
// drama range, which is reserved and never allocated to a real person.

import type { BlackoutDate, Booking, BookingStatus, ServicePeriod, Settings } from './types'
import type { CustomerRow } from './admin-store'

export const PREVIEW_SETTINGS: Settings = {
  max_party_size_online: 50,
  min_lead_time_minutes: 120,
  max_advance_days: 90,
  venue_email: 'info@irmak-restaurant.com',
  venue_name: 'Irmak',
  venue_address: 'Unit 7, Queens Link Leisure Park, 18 Esplanade, Aberdeen AB24 5NS',
  venue_phone: '01224 023161',
}

interface Seed {
  time: string
  party: number
  first: string
  last: string
  status?: BookingStatus
  notes?: string
  internal?: string
  occasion?: string
  phone?: boolean
}

const SEEDS: Seed[] = [
  { time: '12:00', party: 2, first: 'Eileen', last: 'Fraser', status: 'arrived' },
  { time: '12:15', party: 4, first: 'Callum', last: 'Ross', status: 'arrived' },
  { time: '12:30', party: 3, first: 'Aisha', last: 'Rahman', status: 'arrived', notes: 'Nut allergy — severe. Please check the mezze.' },
  { time: '12:45', party: 2, first: 'Tom', last: 'Beattie', status: 'arrived' },
  { time: '13:00', party: 6, first: 'Yasmin', last: 'Khan', status: 'arrived', occasion: 'birthday', notes: 'Birthday for my mum, she is 70. A candle would be lovely.' },
  { time: '13:15', party: 2, first: 'Graham', last: 'Duthie', status: 'no_show' },
  { time: '13:30', party: 5, first: 'Nicola', last: 'Bain', status: 'arrived', phone: true },
  { time: '13:45', party: 4, first: 'Deniz', last: 'Aydın', status: 'arrived', internal: 'Regular. Always asks for the window table.' },
  { time: '14:00', party: 2, first: 'Marek', last: 'Nowak', status: 'cancelled' },
  { time: '14:15', party: 3, first: 'Fiona', last: 'Sutherland', status: 'arrived' },
  { time: '17:00', party: 4, first: 'Hamish', last: 'Grant' },
  { time: '17:30', party: 2, first: 'Lucy', last: 'Milne', occasion: 'anniversary', notes: 'Our first anniversary. Somewhere quiet if possible.' },
  { time: '18:00', party: 8, first: 'Osman', last: 'Yılmaz', phone: true, occasion: 'celebration', internal: 'Called twice to confirm. Bringing their own cake.' },
  { time: '18:15', party: 2, first: 'Rachel', last: 'Cowie' },
  { time: '18:30', party: 6, first: 'Andrew', last: 'Innes', notes: 'One wheelchair user — step-free access needed.' },
  { time: '18:45', party: 4, first: 'Priya', last: 'Sharma' },
  { time: '19:00', party: 12, first: 'Stuart', last: 'McLeod', phone: true, occasion: 'business', internal: 'Over capacity, approved by manager. Two tables joined.' },
  { time: '19:15', party: 2, first: 'Chloe', last: 'Anderson' },
  { time: '19:30', party: 5, first: 'Mehmet', last: 'Öztürk', occasion: 'engagement', notes: 'Proposing after the main course. Please do not mention it.' },
  { time: '20:00', party: 3, first: 'Jenny', last: 'Watt' },
  { time: '20:30', party: 4, first: 'Douglas', last: 'Reid', notes: 'Coeliac — one gluten free main.' },
]

/** Deterministic ids so links between preview screens keep working. */
function previewId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

export function previewBookings(date: string): Booking[] {
  return SEEDS.map((seed, i) => ({
    id: previewId(i + 1),
    created_at: `${date}T09:${String(10 + i).padStart(2, '0')}:00.000Z`,
    booking_date: date,
    booking_time: `${seed.time}:00`,
    party_size: seed.party,
    first_name: seed.first,
    last_name: seed.last,
    email: `${seed.first.toLowerCase()}.${seed.last.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
    phone: `+4477009003${String(i).padStart(2, '0')}`,
    notes: seed.notes ?? null,
    internal_notes: seed.internal ?? null,
    occasion: seed.occasion ?? null,
    status: seed.status ?? 'confirmed',
    marketing_opt_in: i % 3 === 0,
    opt_in_at: i % 3 === 0 ? `${date}T09:00:00.000Z` : null,
    cancellation_token: `11111111-1111-4111-8111-${String(i + 1).padStart(12, '0')}`,
    source: seed.phone ? 'phone' : 'web',
  }))
}

export function previewBookingById(date: string, id: string): Booking | null {
  return previewBookings(date).find((b) => b.id === id) ?? null
}

export function previewServicePeriods(): ServicePeriod[] {
  return Array.from({ length: 7 }, (_, dow) => ({
    id: `00000000-0000-4000-9000-${String(dow).padStart(12, '0')}`,
    day_of_week: dow,
    name: 'All day',
    start_time: '12:00:00',
    end_time: '21:00:00',
    slot_interval_minutes: 15,
    max_covers_per_slot: 50,
    active: true,
  }))
}

export function previewBlackouts(date: string): BlackoutDate[] {
  const [y, m, d] = date.split('-').map(Number)
  const plus = (days: number) =>
    new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)

  return [
    {
      id: '00000000-0000-4000-a000-000000000001',
      date: plus(9),
      start_time: null,
      end_time: null,
      reason: 'Private hire — wedding party',
    },
    {
      id: '00000000-0000-4000-a000-000000000002',
      date: plus(23),
      start_time: '12:00:00',
      end_time: '16:00:00',
      reason: 'Staff training, lunch only',
    },
  ]
}

export function previewCustomers(): CustomerRow[] {
  return [
    { email: 'deniz.aydın@example.com', name: 'Deniz Aydın', phone: '+447700900307', total_bookings: 14, last_visit: '2026-07-26', marketing_opt_in: true, opt_in_at: '2025-11-02T18:20:00.000Z' },
    { email: 'osman.ylmaz@example.com', name: 'Osman Yılmaz', phone: '+447700900312', total_bookings: 9, last_visit: '2026-07-12', marketing_opt_in: true, opt_in_at: '2026-01-18T19:05:00.000Z' },
    { email: 'eileen.fraser@example.com', name: 'Eileen Fraser', phone: '+447700900300', total_bookings: 7, last_visit: '2026-07-26', marketing_opt_in: false, opt_in_at: null },
    { email: 'aisha.rahman@example.com', name: 'Aisha Rahman', phone: '+447700900302', total_bookings: 5, last_visit: '2026-07-26', marketing_opt_in: true, opt_in_at: '2026-03-09T13:40:00.000Z' },
    { email: 'stuart.mcleod@example.com', name: 'Stuart McLeod', phone: '+447700900316', total_bookings: 4, last_visit: '2026-06-30', marketing_opt_in: false, opt_in_at: null },
    { email: 'lucy.milne@example.com', name: 'Lucy Milne', phone: '+447700900311', total_bookings: 3, last_visit: '2026-05-14', marketing_opt_in: true, opt_in_at: '2026-05-14T20:10:00.000Z' },
    { email: 'andrew.innes@example.com', name: 'Andrew Innes', phone: '+447700900314', total_bookings: 2, last_visit: '2026-04-02', marketing_opt_in: false, opt_in_at: null },
    { email: 'priya.sharma@example.com', name: 'Priya Sharma', phone: '+447700900315', total_bookings: 1, last_visit: null, marketing_opt_in: true, opt_in_at: '2026-07-20T11:00:00.000Z' },
  ]
}
