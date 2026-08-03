'use client'

import { useState } from 'react'
import type { BookingStatus } from '@/lib/types'

interface Props {
  token: string
  initialStatus: BookingStatus
  firstName: string
  when: string
  partySize: number
  venueName: string
  venueAddress: string
  venuePhone: string
  isPast: boolean
}

export default function CancelForm({
  token,
  initialStatus,
  firstName,
  when,
  partySize,
  venueName,
  venueAddress,
  venuePhone,
  isPast,
}: Props) {
  const [status, setStatus] = useState<BookingStatus>(initialStatus)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const telHref = `tel:${venuePhone.replace(/\s/g, '')}`
  const cancelled = status === 'cancelled'

  async function handleCancel() {
    if (submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/bookings/${token}/cancel`, { method: 'POST' })
      const data = await response.json()

      if (response.ok && data.ok) {
        setStatus('cancelled')
        setConfirming(false)
        return
      }
      setError(data.error ?? 'We could not cancel that. Please call us and we will do it for you.')
    } catch {
      setError('We could not reach the booking system. Please call us and we will do it for you.')
    } finally {
      setSubmitting(false)
    }
  }

  if (cancelled) {
    return (
      <div className="card p-6">
        <h1 className="font-serif text-2xl text-gold">Booking cancelled</h1>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-white/70">
          Your table on <span className="text-white">{when}</span> has been cancelled. There is
          nothing else you need to do, and we have emailed you a confirmation.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a href="/book" className="btn-primary">
            Book another table
          </a>
          <a href="/" className="btn-secondary">
            Back to the site
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <h1 className="font-serif text-2xl text-gold">Your booking</h1>
      <p className="mt-2 text-[0.95rem] text-white/70">
        {firstName}, here are your details.
      </p>

      <dl className="mt-5 space-y-2.5 border-t border-white/10 pt-5 text-[0.95rem]">
        <Row label="When">{when}</Row>
        <Row label="Party">
          {partySize} {partySize === 1 ? 'person' : 'people'}
        </Row>
        <Row label="Where">
          {venueName}
          <br />
          <span className="text-white/60">{venueAddress}</span>
        </Row>
      </dl>

      {isPast ? (
        <p className="mt-6 rounded-cta border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-white/60">
          This booking has already passed, so there is nothing to cancel. If you would like to book
          again, we would be glad to see you.
        </p>
      ) : (
        <div className="mt-6 border-t border-white/10 pt-5">
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-cta border border-red-300/30 bg-red-500/10 p-3 text-sm text-white"
            >
              {error}{' '}
              <a href={telHref} className="text-gold underline underline-offset-2">
                {venuePhone}
              </a>
            </p>
          )}

          {!confirming ? (
            <>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="btn-secondary w-full border-red-300/40 hover:border-red-300 hover:text-red-200 sm:w-auto"
              >
                Cancel this booking
              </button>
              <p className="mt-3 text-sm leading-relaxed text-white/45">
                Only need to change the time or the number of people? Give us a ring on{' '}
                <a href={telHref} className="text-gold underline underline-offset-2">
                  {venuePhone}
                </a>{' '}
                and we will move it rather than cancelling.
              </p>
            </>
          ) : (
            <div className="rounded-cta border border-red-300/30 bg-red-500/10 p-4">
              <p className="text-[0.95rem] text-white">
                Cancel your table for {partySize} on {when}?
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? 'Cancelling…' : 'Yes, cancel it'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={submitting}
                  className="btn-secondary"
                >
                  Keep my booking
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-20 shrink-0 text-sm text-white/45">{label}</dt>
      <dd className="text-white">{children}</dd>
    </div>
  )
}
