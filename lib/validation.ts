// Server-side validation. The client payload is never trusted: every one of
// these runs again in the route handler regardless of what the form did.

import { isOccasion, type Occasion } from './occasions'

/**
 * Normalise a UK number to E.164 where we can be confident about it.
 *
 * Numbers arrive as `07...`, `+447...`, `0044...`, with spaces, brackets and
 * dashes. Normalising on write is what makes the admin phone search work — an
 * unnormalised store means searching "07123" misses "+44 7123".
 *
 * Anything we cannot confidently interpret is returned stripped but otherwise
 * intact rather than mangled, so staff still have something to dial.
 */
export function normalisePhone(raw: string): string {
  const stripped = raw.replace(/[\s()\-.]/g, '')

  if (/^\+44\d{9,10}$/.test(stripped)) return stripped
  if (/^0044\d{9,10}$/.test(stripped)) return `+44${stripped.slice(4)}`
  if (/^44\d{9,10}$/.test(stripped)) return `+44${stripped.slice(2)}`
  if (/^0\d{9,10}$/.test(stripped)) return `+44${stripped.slice(1)}`
  if (/^\+\d{7,15}$/.test(stripped)) return stripped // already international, non-UK

  return stripped
}

/** Loose enough to accept real numbers, tight enough to catch typos. */
export function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 9 && digits.length <= 15
}

export function isValidEmail(raw: string): boolean {
  const value = raw.trim()
  if (value.length > 254) return false
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value)
}

export function isValidDate(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false
  const [y, m, d] = raw.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function isValidTime(raw: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw)
}

export interface BookingPayload {
  booking_date: string
  booking_time: string
  party_size: number
  first_name: string
  last_name: string
  email: string
  phone: string
  notes: string | null
  occasion: Occasion | null
  marketing_opt_in: boolean
}

export type ValidationResult =
  | { ok: true; value: BookingPayload }
  | { ok: false; field: string; message: string }

const MAX_NAME = 80
const MAX_NOTES = 1000

/**
 * Validates and normalises an incoming booking. Bounds here are absolute
 * limits, not policy: `max_party_size_online` is enforced separately so staff
 * entering a phone booking can legitimately exceed it.
 */
export function validateBooking(body: unknown, maxPartySize: number): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, field: 'body', message: 'Invalid request.' }
  }
  const b = body as Record<string, unknown>

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

  const first_name = str(b.first_name)
  const last_name = str(b.last_name)
  const email = str(b.email).toLowerCase()
  const phone = str(b.phone)
  const booking_date = str(b.booking_date)
  const booking_time = str(b.booking_time)
  const notesRaw = str(b.notes)
  const party_size = Number(b.party_size)

  if (!first_name || first_name.length > MAX_NAME) {
    return { ok: false, field: 'first_name', message: 'Please enter your first name.' }
  }
  if (!last_name || last_name.length > MAX_NAME) {
    return { ok: false, field: 'last_name', message: 'Please enter your last name.' }
  }
  if (!isValidEmail(email)) {
    return { ok: false, field: 'email', message: 'Please enter a valid email address.' }
  }
  if (!isValidPhone(phone)) {
    return { ok: false, field: 'phone', message: 'Please enter a valid phone number.' }
  }
  if (!isValidDate(booking_date)) {
    return { ok: false, field: 'booking_date', message: 'Please choose a date.' }
  }
  if (!isValidTime(booking_time)) {
    return { ok: false, field: 'booking_time', message: 'Please choose a time.' }
  }
  if (!Number.isInteger(party_size) || party_size < 1 || party_size > maxPartySize) {
    return {
      ok: false,
      field: 'party_size',
      message: `Please choose a party size between 1 and ${maxPartySize}.`,
    }
  }
  if (notesRaw.length > MAX_NOTES) {
    return { ok: false, field: 'notes', message: 'Please keep notes under 1000 characters.' }
  }

  // Optional. An unrecognised value is rejected rather than quietly dropped,
  // because the database has a matching check constraint and a silent mismatch
  // would surface as a confusing insert failure instead.
  const occasionRaw = str(b.occasion)
  if (occasionRaw !== '' && !isOccasion(occasionRaw)) {
    return { ok: false, field: 'occasion', message: 'Please choose a valid occasion.' }
  }
  const occasion: Occasion | null = occasionRaw === '' ? null : (occasionRaw as Occasion)

  return {
    ok: true,
    value: {
      booking_date,
      booking_time,
      party_size,
      first_name,
      last_name,
      email,
      phone: normalisePhone(phone),
      notes: notesRaw || null,
      occasion,
      marketing_opt_in: b.marketing_opt_in === true,
    },
  }
}
