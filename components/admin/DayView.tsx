import { addDays, formatLongDate, isSameLocalDate, trimSeconds } from '@/lib/time'
import { occasionLabel } from '@/lib/occasions'
import type { Booking } from '@/lib/types'

interface Props {
  date: string
  today: string
  bookings: Booking[]
  loadError?: string | null
  /** Prefix for links out of this view; the preview points them elsewhere. */
  basePath?: string
}

/**
 * The day view, presentational only. The page above it does the fetching, which
 * keeps this renderable from fixtures — see /admin/preview.
 */
export default function DayView({
  date,
  today,
  bookings,
  loadError = null,
  basePath = '/admin',
}: Props) {
  // Cancelled bookings do not count toward the day's numbers, but staff still
  // need to see them — a guest who cancelled may well turn up anyway.
  const live = bookings.filter((b) => b.status !== 'cancelled')
  const totalCovers = live.reduce((sum, b) => sum + b.party_size, 0)
  const isToday = isSameLocalDate(date, today)

  return (
    <>
      <main className="admin-container pb-24 pt-4">
        <div className="flex items-center gap-2">
          <DayArrow href={`${basePath}?date=${addDays(date, -1)}`} direction="prev" />
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate font-sans text-lg font-medium text-white">
              {isToday ? 'Today' : formatLongDate(date)}
            </h1>
            {!isToday && (
              <a href={basePath} className="text-xs text-gold underline underline-offset-2">
                Back to today
              </a>
            )}
          </div>
          <DayArrow href={`${basePath}?date=${addDays(date, 1)}`} direction="next" />
        </div>

        {/* Totals — the first thing staff look at */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Bookings" value={live.length} />
          <Stat label="Covers" value={totalCovers} />
        </div>

        <form method="get" action={basePath} className="mt-3 flex gap-2">
          <input
            type="date"
            name="date"
            defaultValue={date}
            aria-label="Jump to a date"
            className="field-input [color-scheme:dark]"
          />
          <button type="submit" className="btn-secondary shrink-0 px-4 py-2 text-sm">
            Go
          </button>
        </form>

        {loadError && (
          <p role="alert" className="mt-4 rounded-cta border border-red-300/30 bg-red-500/10 p-4">
            {loadError}
          </p>
        )}

        <div className="mt-4">
          {!loadError && bookings.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-white">No bookings yet for this date.</p>
              <a href={`${basePath}/new?date=${date}`} className="btn-primary mt-4 inline-flex">
                Add booking
              </a>
            </div>
          ) : (
            <ul className="space-y-2">
              {bookings.map((booking) => (
                <li key={booking.id}>
                  <BookingRow booking={booking} basePath={basePath} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* Always reachable, because a phone booking can come in at any moment. */}
      <a
        href={`${basePath}/new?date=${date}`}
        className="btn-primary fixed bottom-5 left-1/2 -translate-x-1/2 shadow-lg"
      >
        Add booking
      </a>
    </>
  )
}

function DayArrow({ href, direction }: { href: string; direction: 'prev' | 'next' }) {
  return (
    <a
      href={href}
      aria-label={direction === 'prev' ? 'Previous day' : 'Next day'}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-cta border border-white/15 text-white/70 transition-colors hover:border-gold hover:text-gold"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
        <path
          d={direction === 'prev' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'}
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-4 py-3 text-center">
      <div className="font-serif text-3xl leading-none text-gold">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-white/45">{label}</div>
    </div>
  )
}

function BookingRow({ booking, basePath }: { booking: Booking; basePath: string }) {
  const cancelled = booking.status === 'cancelled'

  return (
    <a
      href={`${basePath}/booking/${booking.id}`}
      className={`card flex items-center gap-3 p-3 transition-colors hover:border-white/25 ${
        cancelled ? 'opacity-45' : ''
      }`}
    >
      <div className="w-14 shrink-0 text-center">
        <div
          className={`font-sans text-lg font-medium tabular-nums ${cancelled ? 'text-white/60 line-through' : 'text-white'}`}
        >
          {trimSeconds(booking.booking_time)}
        </div>
      </div>

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-cta bg-white/10">
        <span className="font-sans text-base font-semibold tabular-nums text-gold">
          {booking.party_size}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate font-sans text-[0.95rem] text-white">
          {booking.first_name} {booking.last_name}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={booking.status} />
          {booking.occasion && (
            <Tag className="border-gold/30 text-gold/80">{occasionLabel(booking.occasion)}</Tag>
          )}
          {booking.source === 'phone' && <Tag>Phone</Tag>}
        </div>
      </div>

      {/* A visible marker when there is something to read before service. */}
      {(booking.notes || booking.internal_notes) && (
        <span
          title="Has notes"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold"
        >
          <span className="sr-only">Has notes</span>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M3 2.5A1.5 1.5 0 0 1 4.5 1h7A1.5 1.5 0 0 1 13 2.5v11a.5.5 0 0 1-.79.407L8 10.9l-4.21 3.007A.5.5 0 0 1 3 13.5v-11z" />
          </svg>
        </span>
      )}
    </a>
  )
}

export function StatusBadge({ status }: { status: Booking['status'] }) {
  const map: Record<Booking['status'], { label: string; className: string }> = {
    confirmed: { label: 'Confirmed', className: 'border-white/20 text-white/60' },
    arrived: { label: 'Arrived', className: 'border-green-300/40 text-green-200' },
    no_show: { label: 'No show', className: 'border-orange-300/40 text-orange-200' },
    cancelled: { label: 'Cancelled', className: 'border-red-300/40 text-red-200' },
  }
  const { label, className } = map[status]
  return <Tag className={className}>{label}</Tag>
}

function Tag({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[0.7rem] leading-none ${className || 'border-white/20 text-white/55'}`}
    >
      {children}
    </span>
  )
}
