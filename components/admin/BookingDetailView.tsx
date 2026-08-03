import { formatLongDate, trimSeconds } from '@/lib/time'
import { occasionLabel } from '@/lib/occasions'
import type { Booking, BookingStatus } from '@/lib/types'

type Action = (formData: FormData) => Promise<void>

interface Props {
  booking: Booking
  onChangeStatus: Action
  onEdit: Action
  onSaveNote: Action
  basePath?: string
}

export default function BookingDetailView({
  booking,
  onChangeStatus,
  onEdit,
  onSaveNote,
  basePath = '/admin',
}: Props) {
  return (
    <main className="admin-container pb-16 pt-4">
      <a
        href={`${basePath}?date=${booking.booking_date}`}
        className="inline-flex items-center gap-1.5 text-sm text-white/55 transition-colors hover:text-gold"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
          <path
            d="M10 3L5 8l5 5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {formatLongDate(booking.booking_date)}
      </a>

      <h1 className="mt-3 font-serif text-3xl text-gold">
        {booking.first_name} {booking.last_name}
      </h1>
      <p className="mt-1 text-white/70">
        {trimSeconds(booking.booking_time)} · {booking.party_size}{' '}
        {booking.party_size === 1 ? 'person' : 'people'}
        {booking.occasion && (
          <>
            {' · '}
            <span className="text-gold">{occasionLabel(booking.occasion)}</span>
          </>
        )}
      </p>

      {/* Contact — tap to call is the point of this whole screen mid-service. */}
      <div className="card mt-5 divide-y divide-white/10">
        <a
          href={`tel:${booking.phone.replace(/\s/g, '')}`}
          className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-white/5"
        >
          <span>
            <span className="block text-xs uppercase tracking-wider text-white/45">Phone</span>
            <span className="mt-0.5 block text-[0.95rem] text-white">{booking.phone}</span>
          </span>
          <span className="shrink-0 text-sm font-medium text-gold">Call</span>
        </a>

        <a
          href={`mailto:${booking.email}`}
          className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-white/5"
        >
          <span className="min-w-0">
            <span className="block text-xs uppercase tracking-wider text-white/45">Email</span>
            <span className="mt-0.5 block truncate text-[0.95rem] text-white">
              {booking.email}
            </span>
          </span>
          <span className="shrink-0 text-sm font-medium text-gold">Email</span>
        </a>
      </div>

      {/* Guest notes, read-only. Staff must not be able to overwrite what the
          guest actually told us. */}
      {booking.notes && (
        <section className="card mt-4 border-gold/25 bg-gold/[0.06] p-4">
          <h2 className="text-xs uppercase tracking-wider text-gold">From the guest</h2>
          <p className="mt-1.5 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-white">
            {booking.notes}
          </p>
        </section>
      )}

      <StatusControls booking={booking} onChangeStatus={onChangeStatus} />

      <section className="card mt-6 p-4">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-white/45">Change the booking</h2>
        <form action={onEdit} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={booking.id} />

          <div className="min-w-0 flex-1">
            <label htmlFor="party_size" className="field-label">
              Party size
            </label>
            <input
              id="party_size"
              name="party_size"
              type="number"
              min={1}
              max={500}
              defaultValue={booking.party_size}
              className="field-input"
            />
          </div>

          <div className="min-w-0 flex-1">
            <label htmlFor="booking_time" className="field-label">
              Time
            </label>
            <input
              id="booking_time"
              name="booking_time"
              type="time"
              step={900}
              defaultValue={trimSeconds(booking.booking_time)}
              className="field-input [color-scheme:dark]"
            />
          </div>

          <button type="submit" className="btn-secondary shrink-0">
            Save
          </button>
        </form>
        <p className="mt-2 text-xs text-white/35">
          Staff changes ignore the cover cap and the online party limit.
        </p>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="mb-2 text-xs uppercase tracking-wider text-white/45">
          Internal note — staff only
        </h2>
        <form action={onSaveNote} className="space-y-3">
          <input type="hidden" name="id" value={booking.id} />
          <textarea
            name="internal_notes"
            rows={3}
            maxLength={2000}
            defaultValue={booking.internal_notes ?? ''}
            placeholder="Anything the team should know. Never shown to the guest."
            className="field-input resize-y"
            aria-label="Internal note"
          />
          <button type="submit" className="btn-secondary">
            Save note
          </button>
        </form>
      </section>

      <dl className="mt-6 space-y-1.5 text-xs text-white/35">
        <div>
          Booked {booking.source === 'phone' ? 'by phone' : 'online'} on{' '}
          {new Date(booking.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
        </div>
        <div>
          Marketing emails: {booking.marketing_opt_in ? 'opted in' : 'not opted in'}
          {booking.marketing_opt_in && booking.opt_in_at && (
            <>
              {' on '}
              {new Date(booking.opt_in_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
            </>
          )}
        </div>
      </dl>
    </main>
  )
}

function StatusControls({
  booking,
  onChangeStatus,
}: {
  booking: Booking
  onChangeStatus: Action
}) {
  const options: Array<{ status: BookingStatus; label: string; active: string }> = [
    {
      status: 'arrived',
      label: 'Arrived',
      active: 'border-green-300/60 bg-green-400/20 text-green-100',
    },
    {
      status: 'no_show',
      label: 'No show',
      active: 'border-orange-300/60 bg-orange-400/20 text-orange-100',
    },
    {
      status: 'cancelled',
      label: 'Cancelled',
      active: 'border-red-300/60 bg-red-400/20 text-red-100',
    },
  ]

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs uppercase tracking-wider text-white/45">Status</h2>
      <div className="grid grid-cols-3 gap-2">
        {options.map(({ status, label, active }) => {
          const isCurrent = booking.status === status
          return (
            <form key={status} action={onChangeStatus}>
              <input type="hidden" name="id" value={booking.id} />
              {/* Tapping the current status again puts it back to confirmed, so
                  a mis-tap mid-service is one tap to undo. */}
              <input type="hidden" name="status" value={isCurrent ? 'confirmed' : status} />
              <button
                type="submit"
                aria-pressed={isCurrent}
                className={`w-full rounded-cta border py-3 text-sm transition-colors ${
                  isCurrent
                    ? active
                    : 'border-white/15 bg-white/[0.04] text-white/70 hover:border-white/35'
                }`}
              >
                {label}
              </button>
            </form>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-white/35">
        {booking.status === 'confirmed'
          ? 'Currently confirmed.'
          : 'Tap the highlighted status again to set it back to confirmed.'}
      </p>
    </section>
  )
}
