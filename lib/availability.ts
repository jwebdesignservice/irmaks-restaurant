import type { BlackoutDate, ServicePeriod, Settings, AvailabilityResponse } from './types'
import {
  type LocalDate,
  type LocalTime,
  dayOfWeek,
  daysBetween,
  fromMinutes,
  minutesUntil,
  toMinutes,
  todayInLondon,
  trimSeconds,
} from './time'

export interface AvailabilityInput {
  date: LocalDate
  partySize: number
  servicePeriods: ServicePeriod[]
  blackouts: BlackoutDate[]
  /** Live covers per slot for this date: `{ '19:30': 8 }`. Excludes cancelled. */
  bookedCovers: Record<LocalTime, number>
  settings: Settings
  now?: Date
}

/**
 * Which slots a party of this size can actually book on this date.
 *
 * Pure and dependency-free so the capacity edge cases can be tested directly.
 * The rules run in the order the brief sets out, because the order determines
 * which empty-state message the guest sees.
 */
export function computeAvailability(input: AvailabilityInput): AvailabilityResponse {
  const {
    date,
    partySize,
    servicePeriods,
    blackouts,
    bookedCovers,
    settings,
    now = new Date(),
  } = input

  // 7. Large parties never see slots — they get the phone number. Checked first
  // so the message is the same whether or not the restaurant has space.
  if (partySize > settings.max_party_size_online) {
    return {
      date,
      slots: [],
      callUs: {
        reason: 'party_too_large',
        maxOnline: settings.max_party_size_online,
        phone: settings.venue_phone,
      },
    }
  }

  // 1. Past dates, and dates beyond the booking window.
  const offset = daysBetween(todayInLondon(now), date)
  if (offset < 0) return { date, slots: [], emptyReason: 'past' }
  if (offset > settings.max_advance_days) return { date, slots: [], emptyReason: 'closed' }

  // 2. Active service periods for this day of week.
  const dow = dayOfWeek(date)
  const periods = servicePeriods.filter((p) => p.active && p.day_of_week === dow)
  if (periods.length === 0) return { date, slots: [], emptyReason: 'closed' }

  // 3. Candidate slots. A slot appearing in two overlapping periods keeps the
  // more generous cap.
  const capBySlot = new Map<LocalTime, number>()
  for (const period of periods) {
    const start = toMinutes(trimSeconds(period.start_time))
    const end = toMinutes(trimSeconds(period.end_time))
    const step = period.slot_interval_minutes
    for (let m = start; m <= end; m += step) {
      const slot = fromMinutes(m)
      const existing = capBySlot.get(slot)
      capBySlot.set(
        slot,
        existing === undefined ? period.max_covers_per_slot : Math.max(existing, period.max_covers_per_slot)
      )
    }
  }

  // 4. Blackouts for this date. A null start/end pair blacks out the whole day.
  const todaysBlackouts = blackouts.filter((b) => b.date === date)
  if (todaysBlackouts.some((b) => b.start_time === null)) {
    return { date, slots: [], emptyReason: 'blackout' }
  }
  const blackoutRanges = todaysBlackouts.map((b) => ({
    from: toMinutes(trimSeconds(b.start_time!)),
    to: toMinutes(trimSeconds(b.end_time!)),
  }))

  let anyRemovedByBlackout = false
  let anyRemovedByLeadTime = false
  let anyRemovedByCapacity = false

  const slots: LocalTime[] = []
  for (const slot of Array.from(capBySlot.keys()).sort()) {
    const minutes = toMinutes(slot)

    if (blackoutRanges.some((r) => minutes >= r.from && minutes <= r.to)) {
      anyRemovedByBlackout = true
      continue
    }

    // 5. Lead time, compared in Europe/London — not against a UTC server clock.
    if (minutesUntil(date, slot, now) < settings.min_lead_time_minutes) {
      anyRemovedByLeadTime = true
      continue
    }

    // 6. Cover cap for this slot. This party has to fit in what is left.
    const booked = bookedCovers[slot] ?? 0
    const cap = capBySlot.get(slot)!
    if (booked + partySize > cap) {
      anyRemovedByCapacity = true
      continue
    }

    slots.push(slot)
  }

  if (slots.length > 0) return { date, slots }

  // Empty states give direction, so name the actual reason.
  const emptyReason = anyRemovedByCapacity
    ? 'fully_booked'
    : anyRemovedByLeadTime
      ? 'too_soon'
      : anyRemovedByBlackout
        ? 'blackout'
        : 'closed'

  return { date, slots: [], emptyReason }
}

/**
 * Nearest bookable alternatives to a slot that just filled, closest first.
 * Used for the 409 response so the guest gets somewhere to go rather than a
 * generic error.
 */
export function nearestAlternatives(
  slots: LocalTime[],
  target: LocalTime,
  count = 3
): LocalTime[] {
  const targetMinutes = toMinutes(target)
  return [...slots]
    .sort((a, b) => Math.abs(toMinutes(a) - targetMinutes) - Math.abs(toMinutes(b) - targetMinutes))
    .slice(0, count)
}
