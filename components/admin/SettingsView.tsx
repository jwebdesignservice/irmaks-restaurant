import { formatLongDate, trimSeconds } from '@/lib/time'
import type { BlackoutDate, ServicePeriod, Settings } from '@/lib/types'

type Action = (formData: FormData) => Promise<void>

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Props {
  settings: Settings
  periods: ServicePeriod[]
  blackouts: BlackoutDate[]
  today: string
  onSaveSettings: Action
  onSaveServicePeriod: Action
  onAddBlackout: Action
  onRemoveBlackout: Action
}

export default function SettingsView({
  settings,
  periods,
  blackouts,
  today,
  onSaveSettings,
  onSaveServicePeriod,
  onAddBlackout,
  onRemoveBlackout,
}: Props) {
  return (
    <main className="admin-container space-y-6 pb-16 pt-4">
      <h1 className="font-serif text-2xl text-gold">Settings</h1>

      <Section
        title="Booking rules"
        description="These change what guests can do on the website straight away. No redeploy needed."
      >
        <form action={onSaveSettings} className="space-y-4">
          {/* Venue fields share this action, so carry them through unchanged. */}
          <input type="hidden" name="venue_name" value={settings.venue_name} />
          <input type="hidden" name="venue_email" value={settings.venue_email} />
          <input type="hidden" name="venue_address" value={settings.venue_address} />
          <input type="hidden" name="venue_phone" value={settings.venue_phone} />

          <Number
            id="max_party_size_online"
            label="Largest party that can book online"
            defaultValue={settings.max_party_size_online}
            min={1}
            max={500}
            hint="Anything larger is shown your phone number instead of times. Note that a party still has to fit inside the cover cap below, so raising this on its own is not enough."
          />

          <Number
            id="min_lead_time_minutes"
            label="Minimum notice, in minutes"
            defaultValue={settings.min_lead_time_minutes}
            min={0}
            max={10080}
            hint="120 means nobody can book a table less than two hours ahead. Does not apply to bookings you add yourself."
          />

          <Number
            id="max_advance_days"
            label="How far ahead guests can book, in days"
            defaultValue={settings.max_advance_days}
            min={1}
            max={730}
          />

          <button type="submit" className="btn-secondary">
            Save booking rules
          </button>
        </form>
      </Section>

      <Section
        title="Opening hours and capacity"
        description="The cover cap is per time slot, not per service. A cap of 50 at 15-minute slots means the kitchen could face 200 covers in an hour — set the cap and the interval together."
      >
        <div className="space-y-2">
          {periods.map((period) => (
            <form
              key={period.id}
              action={onSaveServicePeriod}
              className="rounded-cta border border-white/10 bg-white/[0.03] p-3"
            >
              <input type="hidden" name="id" value={period.id} />

              <div className="flex items-baseline justify-between gap-2">
                <span className="font-sans text-sm font-medium text-white">
                  {DAY_NAMES[period.day_of_week]}
                </span>
                <span className="text-xs text-white/40">
                  {trimSeconds(period.start_time)}–{trimSeconds(period.end_time)} · {period.name}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="min-w-[7rem] flex-1">
                  <label htmlFor={`cap-${period.id}`} className="mb-1 block text-xs text-white/50">
                    Covers per slot
                  </label>
                  <input
                    id={`cap-${period.id}`}
                    name="max_covers_per_slot"
                    type="number"
                    min={0}
                    max={1000}
                    defaultValue={period.max_covers_per_slot}
                    className="field-input py-2"
                  />
                </div>

                <div className="min-w-[7rem] flex-1">
                  <label
                    htmlFor={`interval-${period.id}`}
                    className="mb-1 block text-xs text-white/50"
                  >
                    Slot every (mins)
                  </label>
                  <input
                    id={`interval-${period.id}`}
                    name="slot_interval_minutes"
                    type="number"
                    min={5}
                    max={240}
                    defaultValue={period.slot_interval_minutes}
                    className="field-input py-2"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={period.active}
                    className="h-4 w-4 accent-gold"
                  />
                  Open
                </label>

                <button type="submit" className="btn-secondary shrink-0 px-4 py-2 text-sm">
                  Save
                </button>
              </div>
            </form>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-white/40">
          The end time is the last bookable slot, not closing time. To change opening hours
          themselves, ask whoever set the system up.
        </p>
      </Section>

      <Section
        title="Closures and private hire"
        description="Blocks online bookings for a whole day or part of one. You can still add bookings yourself on a blacked-out date."
      >
        <form action={onAddBlackout} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="blackout-date" className="field-label">
                Date
              </label>
              <input
                id="blackout-date"
                name="date"
                type="date"
                required
                min={today}
                className="field-input [color-scheme:dark]"
              />
            </div>
            <div>
              <label htmlFor="blackout-reason" className="field-label">
                Reason
              </label>
              <input
                id="blackout-reason"
                name="reason"
                type="text"
                required
                placeholder="Private hire, staff party, closure"
                className="field-input"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              name="whole_day"
              defaultChecked
              className="h-4 w-4 accent-gold"
            />
            Whole day
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="blackout-start" className="field-label">
                From (part-day only)
              </label>
              <input
                id="blackout-start"
                name="start_time"
                type="time"
                step={900}
                className="field-input [color-scheme:dark]"
              />
            </div>
            <div>
              <label htmlFor="blackout-end" className="field-label">
                Until (part-day only)
              </label>
              <input
                id="blackout-end"
                name="end_time"
                type="time"
                step={900}
                className="field-input [color-scheme:dark]"
              />
            </div>
          </div>

          <button type="submit" className="btn-secondary">
            Add closure
          </button>
        </form>

        <div className="mt-5 border-t border-white/10 pt-4">
          {blackouts.length === 0 ? (
            <p className="text-sm text-white/45">No closures coming up.</p>
          ) : (
            <ul className="space-y-2">
              {blackouts.map((blackout) => (
                <li
                  key={blackout.id}
                  className="flex items-center justify-between gap-3 rounded-cta border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-white">{formatLongDate(blackout.date)}</div>
                    <div className="mt-0.5 text-xs text-white/50">
                      {blackout.start_time
                        ? `${trimSeconds(blackout.start_time)}–${trimSeconds(blackout.end_time!)}`
                        : 'All day'}{' '}
                      · {blackout.reason}
                    </div>
                  </div>
                  <form action={onRemoveBlackout} className="shrink-0">
                    <input type="hidden" name="id" value={blackout.id} />
                    <button
                      type="submit"
                      className="rounded-cta px-3 py-2 text-xs text-white/45 transition-colors hover:text-red-300"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section
        title="Venue details"
        description="Used on the booking page and in every confirmation email."
      >
        <form action={onSaveSettings} className="space-y-4">
          <input
            type="hidden"
            name="max_party_size_online"
            value={settings.max_party_size_online}
          />
          <input
            type="hidden"
            name="min_lead_time_minutes"
            value={settings.min_lead_time_minutes}
          />
          <input type="hidden" name="max_advance_days" value={settings.max_advance_days} />

          <Text id="venue_name" label="Restaurant name" defaultValue={settings.venue_name} />
          <Text id="venue_phone" label="Phone" type="tel" defaultValue={settings.venue_phone} />
          <Text
            id="venue_email"
            label="Where booking notifications go"
            type="email"
            defaultValue={settings.venue_email}
          />

          <div>
            <label htmlFor="venue_address" className="field-label">
              Address
            </label>
            <textarea
              id="venue_address"
              name="venue_address"
              rows={2}
              required
              defaultValue={settings.venue_address}
              className="field-input resize-y"
            />
          </div>

          <button type="submit" className="btn-secondary">
            Save venue details
          </button>
        </form>
      </Section>
    </main>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="font-sans text-base font-medium text-white">{title}</h2>
      {description && <p className="mt-1 text-sm leading-relaxed text-white/50">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Number({
  id,
  label,
  defaultValue,
  min,
  max,
  hint,
}: {
  id: string
  label: string
  defaultValue: number
  min: number
  max: number
  hint?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="number"
        min={min}
        max={max}
        defaultValue={defaultValue}
        className="field-input"
      />
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-white/40">{hint}</p>}
    </div>
  )
}

function Text({
  id,
  label,
  defaultValue,
  type = 'text',
}: {
  id: string
  label: string
  defaultValue: string
  type?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        defaultValue={defaultValue}
        className="field-input"
      />
    </div>
  )
}
