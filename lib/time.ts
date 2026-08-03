// Everything time-related is expressed in the restaurant's local time.
//
// Vercel runs in UTC. `new Date()` on the server is therefore an hour out from
// the restaurant for the ~7 months of the year that BST is in effect, which
// would let guests book a slot that has already passed. Every "is this slot too
// soon" comparison in this file goes through Europe/London explicitly.

export const RESTAURANT_TZ = 'Europe/London'

/** A calendar date in the restaurant's timezone, as `YYYY-MM-DD`. */
export type LocalDate = string
/** A wall-clock time in the restaurant's timezone, as `HH:MM`. */
export type LocalTime = string

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: RESTAURANT_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: RESTAURANT_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Today's date in the restaurant's timezone. */
export function todayInLondon(now: Date = new Date()): LocalDate {
  return dateFormatter.format(now) // en-CA gives YYYY-MM-DD
}

/** The current wall-clock time in the restaurant's timezone. */
export function nowTimeInLondon(now: Date = new Date()): LocalTime {
  // en-GB hour12:false can emit "24:05" at midnight; normalise it.
  return timeFormatter.format(now).replace(/^24:/, '00:')
}

/** Minutes since midnight, for `HH:MM` or `HH:MM:SS`. */
export function toMinutes(time: LocalTime): number {
  const [h, m] = time.split(':')
  return Number(h) * 60 + Number(m)
}

/** Minutes since midnight back to `HH:MM`. */
export function fromMinutes(minutes: number): LocalTime {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Trims a Postgres `time` value (`19:30:00`) to `HH:MM`. */
export function trimSeconds(time: string): LocalTime {
  return time.slice(0, 5)
}

/**
 * Whole days between two local dates. Uses UTC arithmetic on the date parts
 * only, which is safe precisely because there is no time component: a DST
 * transition cannot shift a calendar date relative to itself.
 */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const a = Date.UTC(fy, fm - 1, fd)
  const b = Date.UTC(ty, tm - 1, td)
  return Math.round((b - a) / 86_400_000)
}

/** Whether two local dates are the same calendar day. */
export function isSameLocalDate(a: LocalDate, b: LocalDate): boolean {
  return a === b
}

/** Day of week for a local date, 0 = Sunday, matching `service_periods`. */
export function dayOfWeek(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Adds days to a local date, returning a local date. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return next.toISOString().slice(0, 10)
}

/**
 * How many minutes from now until a slot, in restaurant local terms.
 * Negative means the slot is in the past.
 */
export function minutesUntil(
  date: LocalDate,
  time: LocalTime,
  now: Date = new Date()
): number {
  const dayDelta = daysBetween(todayInLondon(now), date)
  return dayDelta * 1440 + toMinutes(time) - toMinutes(nowTimeInLondon(now))
}

/** "Sunday 2 August" — for confirmations and the date picker. */
export function formatLongDate(date: LocalDate): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

/** "Sun 2 Aug" — the compact form used in the date strip. */
export function formatShortDate(date: LocalDate): { weekday: string; day: string; month: string } {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const part = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(dt)
  return {
    weekday: part({ weekday: 'short' }),
    day: part({ day: 'numeric' }),
    month: part({ month: 'short' }),
  }
}
