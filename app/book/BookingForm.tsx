'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { AvailabilityResponse } from '@/lib/types'
import { formatLongDate, toMinutes } from '@/lib/time'
import { OCCASIONS, occasionLabel, type Occasion } from '@/lib/occasions'
import Turnstile from '@/components/Turnstile'
import DateStrip from '@/components/DateStrip'

interface Props {
  maxPartySizeOnline: number
  minDate: string
  maxDate: string
  venuePhone: string
  venueName: string
  venueAddress: string
  turnstileSiteKey: string | null
}

interface Confirmation {
  booking_date: string
  booking_time: string
  party_size: number
  first_name: string
  cancellation_token: string
}

const DATE_STRIP_DAYS = 14
/** Sizes common enough to deserve a one-tap chip. Anything larger uses the select. */
const QUICK_SIZES = [1, 2, 3, 4, 5, 6, 7, 8]

export default function BookingForm({
  maxPartySizeOnline,
  minDate,
  maxDate,
  venuePhone,
  venueName,
  venueAddress,
  turnstileSiteKey,
}: Props) {
  const [partySize, setPartySize] = useState<number | null>(null)
  const [showLargeParty, setShowLargeParty] = useState(false)
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [occasion, setOccasion] = useState<Occasion | ''>('')
  const [optIn, setOptIn] = useState(false) // unticked by default, deliberately
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alternatives, setAlternatives] = useState<string[]>([])
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  const timeSectionRef = useRef<HTMLDivElement | null>(null)
  const detailsSectionRef = useRef<HTMLDivElement | null>(null)
  const errorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!partySize || !date) {
      setAvailability(null)
      return
    }

    let cancelled = false
    setLoadingSlots(true)
    setTime(null)

    fetch(`/api/availability?date=${date}&party_size=${partySize}`)
      .then((r) => r.json())
      .then((data: AvailabilityResponse) => {
        if (!cancelled) setAvailability(data)
      })
      .catch(() => {
        if (!cancelled) setAvailability({ date, slots: [], emptyReason: 'closed' })
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })

    return () => {
      cancelled = true
    }
  }, [partySize, date])

  const scrollTo = useCallback((el: HTMLElement | null) => {
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' })
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return // guests double-tap confirm on mobile
    if (!partySize || !date || !time) return

    setSubmitting(true)
    setError(null)
    setAlternatives([])

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_date: date,
          booking_time: time,
          party_size: partySize,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          notes,
          occasion: occasion || null,
          marketing_opt_in: optIn,
          company: honeypot,
          turnstile_token: turnstileToken,
        }),
      })

      const data = await response.json()

      if (response.ok && data.ok) {
        setConfirmation(
          data.duplicate
            ? {
                booking_date: date,
                booking_time: time,
                party_size: partySize,
                first_name: firstName,
                cancellation_token: '',
              }
            : data.booking
        )
        window.scrollTo({ top: 0, behavior: 'auto' })
        return
      }

      if (response.status === 409) {
        setError(data.error ?? 'That slot just filled up.')
        setAlternatives(data.alternatives ?? [])
        const refreshed = await fetch(
          `/api/availability?date=${date}&party_size=${partySize}`
        ).then((r) => r.json())
        setAvailability(refreshed)
        setTime(null)
        scrollTo(errorRef.current)
        return
      }

      setError(data.error ?? 'Something went wrong. Please try again or call us.')
      scrollTo(errorRef.current)
    } catch {
      setError(
        `We could not reach the booking system. Please try again, or call us on ${venuePhone}.`
      )
      scrollTo(errorRef.current)
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmation) {
    return (
      <Confirmed
        confirmation={confirmation}
        occasion={occasion || null}
        venueName={venueName}
        venueAddress={venueAddress}
        venuePhone={venuePhone}
        email={email}
      />
    )
  }

  const detailsReady = Boolean(partySize && date && time)

  return (
    <form onSubmit={handleSubmit} className="mt-8" noValidate>
      <div className="card divide-y divide-white/10">
        {/* 1. Party size */}
        <Step n={1} title="How many people?">
          <div className="flex flex-wrap gap-2">
            {QUICK_SIZES.filter((s) => s <= maxPartySizeOnline).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setPartySize(size)
                  setShowLargeParty(false)
                }}
                aria-pressed={partySize === size && !showLargeParty}
                className={chip(partySize === size && !showLargeParty, 'w-12')}
              >
                {size}
              </button>
            ))}

            {maxPartySizeOnline > QUICK_SIZES.length && (
              <button
                type="button"
                onClick={() => {
                  setShowLargeParty(true)
                  if (!partySize || partySize <= QUICK_SIZES.length) setPartySize(9)
                }}
                aria-pressed={showLargeParty}
                className={chip(showLargeParty, 'px-4')}
              >
                9 or more
              </button>
            )}
          </div>

          {showLargeParty && (
            <LargePartySelect
              value={partySize ?? 9}
              max={maxPartySizeOnline}
              onChange={setPartySize}
            />
          )}
        </Step>

        {/* 2. Date */}
        {partySize && (
          <Step n={2} title="Which day?">
            <DateStrip
              startDate={minDate}
              days={DATE_STRIP_DAYS}
              selected={date}
              onSelect={(d) => {
                setDate(d)
                setTimeout(() => scrollTo(timeSectionRef.current), 80)
              }}
            />

            <details className="group mt-4">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-gold">
                <span>Another date</span>
                <svg
                  viewBox="0 0 16 16"
                  className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </summary>
              <input
                type="date"
                min={minDate}
                max={maxDate}
                value={date ?? ''}
                onChange={(e) => setDate(e.target.value || null)}
                aria-label="Choose a specific date"
                className="field-input mt-3 [color-scheme:dark]"
              />
            </details>
          </Step>
        )}

        {/* 3. Time — unavailable slots are absent, not greyed out. */}
        {partySize && date && (
          <Step n={3} title="What time?" innerRef={timeSectionRef}>
            {loadingSlots && <p className="text-sm text-white/50">Checking availability…</p>}

            {!loadingSlots && availability && availability.slots.length > 0 && (
              <SlotGroups
                slots={availability.slots}
                selected={time}
                onSelect={(slot) => {
                  setTime(slot)
                  setAlternatives([])
                  setTimeout(() => scrollTo(detailsSectionRef.current), 80)
                }}
              />
            )}

            {!loadingSlots && availability && availability.slots.length === 0 && (
              <EmptySlots
                reason={availability.emptyReason}
                callUs={availability.callUs}
                date={date}
                phone={venuePhone}
                onPickAnotherDay={() => {
                  setDate(null)
                  setTime(null)
                }}
              />
            )}
          </Step>
        )}

        {/* 4. Details */}
        {detailsReady && (
          <Step n={4} title="Your details" innerRef={detailsSectionRef}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="First name"
                  value={firstName}
                  onChange={setFirstName}
                  autoComplete="given-name"
                  required
                />
                <Field
                  label="Last name"
                  value={lastName}
                  onChange={setLastName}
                  autoComplete="family-name"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Email"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  hint="Where we send your confirmation."
                  required
                />
                <Field
                  label="Phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={setPhone}
                  autoComplete="tel"
                  hint="Only if we need to reach you."
                  required
                />
              </div>

              <OccasionField value={occasion} onChange={setOccasion} />

              <NotesField value={notes} onChange={setNotes} />

              {/* Honeypot. Hidden from sight and from assistive tech; a real
                  guest never fills it in. */}
              <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="company">Company</label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

            </div>
          </Step>
        )}

        {/* 5. Confirm */}
        {detailsReady && (
          <Step n={5} title="Check and book">
            <div className="space-y-5">
              <dl className="space-y-2.5 text-[0.95rem]">
                <SummaryRow label="When">
                  {formatLongDate(date!)} at {time}
                </SummaryRow>
                <SummaryRow label="Party">
                  {partySize} {partySize === 1 ? 'person' : 'people'}
                </SummaryRow>
                {occasion && (
                  <SummaryRow label="Occasion">{occasionLabel(occasion)}</SummaryRow>
                )}
                <SummaryRow label="Where">{venueAddress}</SummaryRow>
              </dl>

              {error && (
                <div
                  ref={errorRef}
                  role="alert"
                  className="rounded-cta border border-red-300/30 bg-red-500/10 p-4"
                >
                  <p className="text-[0.95rem] text-white">{error}</p>
                  {alternatives.length > 0 && (
                    <>
                      <p className="mt-3 text-sm text-white/60">Nearest times still free:</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {alternatives.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              setTime(slot)
                              setError(null)
                              setAlternatives([])
                            }}
                            className={chip(false, 'px-4')}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <MarketingToggle checked={optIn} onChange={setOptIn} venueName={venueName} />

              {turnstileSiteKey && (
                <Turnstile siteKey={turnstileSiteKey} onVerify={setTurnstileToken} />
              )}

              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? 'Booking your table…' : 'Book table'}
              </button>

              <p className="text-center text-sm leading-relaxed text-white/45">
                Your confirmation email has a cancellation link, or call us on{' '}
                <a href={telHref(venuePhone)} className="text-gold underline underline-offset-2">
                  {venuePhone}
                </a>
                .
              </p>
            </div>
          </Step>
        )}
      </div>
    </form>
  )
}

/* -------------------------------------------------------------------------- */

function telHref(phone: string) {
  return `tel:${phone.replace(/\s/g, '')}`
}

/** One section of the form. The number stays quiet — it orders, it doesn't shout. */
function Step({
  n,
  title,
  children,
  innerRef,
}: {
  n: number
  title: string
  children: React.ReactNode
  innerRef?: React.RefObject<HTMLDivElement>
}) {
  return (
    <div ref={innerRef} className="p-5 sm:p-7">
      <h2 className="mb-4 flex items-baseline gap-2.5 font-sans text-base font-medium text-white">
        <span className="text-sm tabular-nums text-gold/70">{n}</span>
        {title}
      </h2>
      {children}
    </div>
  )
}

function chip(selected: boolean, extra = '') {
  return [
    'inline-flex min-h-[2.75rem] items-center justify-center rounded-cta border text-[0.95rem]',
    'px-3 py-2 font-sans transition-colors',
    selected
      ? 'border-gold bg-gold font-medium text-navy'
      : 'border-white/15 bg-white/[0.04] text-white hover:border-white/35 hover:bg-white/[0.08]',
    extra,
  ].join(' ')
}

function LargePartySelect({
  value,
  max,
  onChange,
}: {
  value: number
  max: number
  onChange: (n: number) => void
}) {
  const id = useId()
  return (
    <div className="mt-4 max-w-[16rem]">
      <label htmlFor={id} className="field-label">
        Exact number in your party
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="field-select"
      >
        {Array.from({ length: max - 8 }, (_, i) => i + 9).map((n) => (
          <option key={n} value={n}>
            {n} people
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * 37 slots in one flat grid is a wall of numbers. Splitting at 17:00 gives two
 * scannable groups without inventing service periods the restaurant does not
 * actually run.
 */
function SlotGroups({
  slots,
  selected,
  onSelect,
}: {
  slots: string[]
  selected: string | null
  onSelect: (slot: string) => void
}) {
  const groups = [
    { label: 'Lunch', slots: slots.filter((s) => toMinutes(s) < 17 * 60) },
    { label: 'Evening', slots: slots.filter((s) => toMinutes(s) >= 17 * 60) },
  ].filter((g) => g.slots.length > 0)

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          {groups.length > 1 && (
            <h3 className="mb-2.5 font-sans text-xs uppercase tracking-wider text-white/40">
              {group.label}
            </h3>
          )}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {group.slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onSelect(slot)}
                aria-pressed={selected === slot}
                className={chip(selected === slot)}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  autoComplete,
  hint,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  inputMode?: 'email' | 'tel' | 'text'
  autoComplete?: string
  hint?: string
  required?: boolean
}) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span className="ml-0.5 text-gold/80">*</span>}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? hintId : undefined}
        className="field-input"
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-white/40">
          {hint}
        </p>
      )}
    </div>
  )
}

function OccasionField({
  value,
  onChange,
}: {
  value: Occasion | ''
  onChange: (v: Occasion | '') => void
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="field-label">
        Is this a special occasion?
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as Occasion | '')}
        className="field-select"
      >
        <option value="">No special occasion</option>
        {OCCASIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * Marketing consent, as a switch rather than a tick box.
 *
 * Still a real checkbox underneath with role="switch", so it stays keyboard
 * operable, announces its on/off state, and posts as a boolean. It must remain
 * off until the guest turns it on — under UK GDPR a pre-ticked control is not
 * consent, and `opt_in_at` is only stamped when this is true.
 */
function MarketingToggle({
  checked,
  onChange,
  venueName,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  venueName: string
}) {
  return (
    <div className="rounded-cta border border-white/10 bg-white/[0.04] p-4">
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="block font-sans text-[0.95rem] font-medium text-white">
            Receive restaurant emails
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-white/55">
            Sign me up to receive dining offers and news from {venueName} by email.
          </span>
        </span>

        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-white/20 transition-colors
                     peer-checked:bg-gold peer-focus-visible:outline peer-focus-visible:outline-2
                     peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold
                     peer-checked:[&>span]:translate-x-5"
        >
          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform" />
        </span>
      </label>

      <details className="group mt-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm text-gold underline underline-offset-2">
          Learn more
        </summary>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          We&apos;ll only email you about events, offers and news from {venueName}. We never pass
          your details to anyone else, and every email has an unsubscribe link. Leaving this off
          does not affect your booking — we&apos;ll still send your confirmation.
        </p>
      </details>
    </div>
  )
}

function NotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="field-label">
        Anything we should know?
      </label>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={1000}
        placeholder="Allergies, access needs, anything else"
        className="field-input resize-y"
      />
    </div>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-20 shrink-0 text-sm text-white/45">{label}</dt>
      <dd className="text-white">{children}</dd>
    </div>
  )
}

function EmptySlots({
  reason,
  callUs,
  date,
  phone,
  onPickAnotherDay,
}: {
  reason: AvailabilityResponse['emptyReason']
  callUs: AvailabilityResponse['callUs']
  date: string
  phone: string
  onPickAnotherDay: () => void
}) {
  // Empty states give direction, not mood.
  if (callUs) {
    return (
      <div className="rounded-cta border border-gold/25 bg-gold/[0.07] p-5">
        <h3 className="font-sans text-base font-medium text-gold">
          Give us a ring for a party this size
        </h3>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-white/70">
          For groups of more than {callUs.maxOnline} we take the booking over the phone, so we can
          get everything right for you.
        </p>
        <a href={telHref(phone)} className="btn-primary mt-4 w-full sm:w-auto">
          Call {phone}
        </a>
      </div>
    )
  }

  const copy: Record<string, { title: string; body: string }> = {
    fully_booked: {
      title: 'Fully booked that day',
      body: `We have no tables left for a party that size on ${formatLongDate(date)}. Try another day, or call us — we sometimes have space that is not online.`,
    },
    too_soon: {
      title: 'Too close to service',
      body: 'The remaining times today are too soon to book online. Please call us and we will see what we can do.',
    },
    blackout: {
      title: 'Closed that day',
      body: `We are closed to bookings on ${formatLongDate(date)}. Please choose another day.`,
    },
    closed: {
      title: 'Not taking bookings',
      body: `We are not taking online bookings on ${formatLongDate(date)}. Please choose another day.`,
    },
    past: {
      title: 'That date has passed',
      body: 'Please choose a date from today onwards.',
    },
  }
  const { title, body } = copy[reason ?? 'closed'] ?? copy.closed

  return (
    <div className="rounded-cta border border-white/10 bg-white/[0.04] p-5">
      <h3 className="font-sans text-base font-medium text-white">{title}</h3>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-white/65">{body}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={onPickAnotherDay} className="btn-secondary">
          Pick another day
        </button>
        <a href={telHref(phone)} className="btn-secondary">
          Call {phone}
        </a>
      </div>
    </div>
  )
}

function Confirmed({
  confirmation,
  occasion,
  venueName,
  venueAddress,
  venuePhone,
  email,
}: {
  confirmation: Confirmation
  occasion: Occasion | null
  venueName: string
  venueAddress: string
  venuePhone: string
  email: string
}) {
  // People screenshot this screen, so everything they need is on it.
  return (
    <div className="mt-8">
      <div className="card p-6 sm:p-8">
        <h2 className="font-serif text-3xl text-gold">Table booked</h2>
        <p className="mt-2 text-[0.95rem] text-white/70">
          Thanks {confirmation.first_name} — we look forward to seeing you.
        </p>

        <dl className="mt-6 space-y-3 border-t border-white/10 pt-6">
          <SummaryRow label="When">
            {formatLongDate(confirmation.booking_date)} at {confirmation.booking_time}
          </SummaryRow>
          <SummaryRow label="Party">
            {confirmation.party_size} {confirmation.party_size === 1 ? 'person' : 'people'}
          </SummaryRow>
          {occasion && <SummaryRow label="Occasion">{occasionLabel(occasion)}</SummaryRow>}
          <SummaryRow label="Where">
            {venueName}
            <br />
            <span className="text-white/60">{venueAddress}</span>
          </SummaryRow>
          <SummaryRow label="Phone">
            <a href={telHref(venuePhone)} className="text-gold underline underline-offset-2">
              {venuePhone}
            </a>
          </SummaryRow>
        </dl>
      </div>

      <p className="mt-5 text-[0.95rem] leading-relaxed text-white/60">
        {email ? (
          <>
            A confirmation is on its way to <span className="text-white">{email}</span>.
          </>
        ) : (
          <>A confirmation is on its way to you.</>
        )}{' '}
        It has a link to cancel if your plans change.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a href="/" className="btn-secondary">
          Back to the site
        </a>
        <a href="/index.html#Menu" className="btn-secondary">
          Have a look at the menu
        </a>
      </div>
    </div>
  )
}
