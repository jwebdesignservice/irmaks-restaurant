import type { LocalDate, LocalTime } from './time'

export type BookingStatus = 'confirmed' | 'arrived' | 'no_show' | 'cancelled'

export interface ServicePeriod {
  id: string
  day_of_week: number
  name: string
  start_time: string
  end_time: string
  slot_interval_minutes: number
  max_covers_per_slot: number
  active: boolean
}

export interface BlackoutDate {
  id: string
  date: LocalDate
  start_time: string | null
  end_time: string | null
  reason: string
}

export interface Booking {
  id: string
  created_at: string
  booking_date: LocalDate
  booking_time: string
  party_size: number
  first_name: string
  last_name: string
  email: string
  phone: string
  notes: string | null
  /** Staff-only. Never shown to the guest and never included in any email. */
  internal_notes: string | null
  occasion: string | null
  status: BookingStatus
  marketing_opt_in: boolean
  opt_in_at: string | null
  cancellation_token: string
  source: string
}

export interface Settings {
  max_party_size_online: number
  min_lead_time_minutes: number
  max_advance_days: number
  venue_email: string
  venue_name: string
  venue_address: string
  venue_phone: string
}

/** What `/api/availability` returns. */
export interface AvailabilityResponse {
  date: LocalDate
  /** Bookable slots only. Unavailable slots are absent, never greyed out. */
  slots: LocalTime[]
  /**
   * Set when the party is too large to book online. The UI shows the call-us
   * message with this number instead of an empty slot list.
   */
  callUs?: { reason: 'party_too_large'; maxOnline: number; phone: string }
  /** Present when there are no slots, so the UI can give direction. */
  emptyReason?: 'closed' | 'blackout' | 'fully_booked' | 'too_soon' | 'past'
}
