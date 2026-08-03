import { OCCASIONS } from '@/lib/occasions'
import type { Settings } from '@/lib/types'

type Action = (formData: FormData) => Promise<void>

interface Props {
  date: string
  bookedCovers: number
  settings: Settings
  onSubmit: Action
  basePath?: string
}

/**
 * Manual entry for phone bookings. A large share of covers arrive this way, so
 * this is a first-class screen, not an afterthought.
 *
 * It bypasses max_party_size_online and min_lead_time_minutes outright, and can
 * exceed the cover cap behind an explicit tick — a manager overriding capacity
 * is a legitimate decision the system should record, not block.
 */
export default function NewBookingView({
  date,
  bookedCovers,
  settings,
  onSubmit,
  basePath = '/admin',
}: Props) {
  return (
    <main className="admin-container pb-16 pt-4">
      <a
        href={`${basePath}?date=${date}`}
        className="text-sm text-white/55 transition-colors hover:text-gold"
      >
        ← Back to bookings
      </a>

      <h1 className="mt-3 font-serif text-3xl text-gold">Add a booking</h1>
      <p className="mt-1 text-sm text-white/55">
        For bookings taken over the phone. {bookedCovers} cover
        {bookedCovers === 1 ? '' : 's'} already booked on this date.
      </p>

      <form action={onSubmit} className="card mt-5 divide-y divide-white/10">
        <fieldset className="p-4 sm:p-5">
          <legend className="mb-3 text-xs uppercase tracking-wider text-white/45">
            When and how many
          </legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="booking_date" className="field-label">
                Date
              </label>
              <input
                id="booking_date"
                name="booking_date"
                type="date"
                required
                defaultValue={date}
                className="field-input [color-scheme:dark]"
              />
            </div>
            <div>
              <label htmlFor="booking_time" className="field-label">
                Time
              </label>
              <input
                id="booking_time"
                name="booking_time"
                type="time"
                step={900}
                required
                defaultValue="19:00"
                className="field-input [color-scheme:dark]"
              />
            </div>
            <div>
              <label htmlFor="party_size" className="field-label">
                Party size
              </label>
              <input
                id="party_size"
                name="party_size"
                type="number"
                min={1}
                max={500}
                required
                defaultValue={2}
                className="field-input"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="p-4 sm:p-5">
          <legend className="mb-3 text-xs uppercase tracking-wider text-white/45">Guest</legend>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="first_name" className="field-label">
                  First name
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  required
                  className="field-input"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="field-label">
                  Last name
                </label>
                <input id="last_name" name="last_name" type="text" required className="field-input" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className="field-label">
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  required
                  className="field-input"
                />
              </div>
              <div>
                <label htmlFor="email" className="field-label">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  required
                  className="field-input"
                />
                <p className="mt-1.5 text-xs text-white/40">
                  Needed for the confirmation. Ask the guest for it.
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="occasion" className="field-label">
                Occasion
              </label>
              <select id="occasion" name="occasion" className="field-select" defaultValue="">
                <option value="">No special occasion</option>
                {OCCASIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="field-label">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={1000}
                placeholder="Allergies, access needs, anything the guest mentioned"
                className="field-input resize-y"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="marketing_opt_in"
                className="mt-0.5 h-5 w-5 shrink-0 accent-gold"
              />
              <span className="text-sm leading-relaxed text-white/70">
                Guest agreed to marketing emails
                <span className="mt-0.5 block text-xs text-white/40">
                  Only tick this if you actually asked and they said yes.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset className="p-4 sm:p-5">
          <legend className="mb-3 text-xs uppercase tracking-wider text-white/45">Capacity</legend>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="override_capacity"
              className="mt-0.5 h-5 w-5 shrink-0 accent-gold"
            />
            <span className="text-sm leading-relaxed text-white/70">
              Allow over capacity
              <span className="mt-0.5 block text-xs text-white/40">
                Books the slot even if it is full, outside service hours, or on a blacked-out date.
                Only you know whether the kitchen can take it.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="p-4 sm:p-5">
          <button type="submit" className="btn-primary w-full">
            Save booking
          </button>
          <p className="mt-2 text-center text-xs text-white/40">
            The online party limit ({settings.max_party_size_online}) and the{' '}
            {settings.min_lead_time_minutes}-minute notice period do not apply here.
          </p>
        </div>
      </form>
    </main>
  )
}
