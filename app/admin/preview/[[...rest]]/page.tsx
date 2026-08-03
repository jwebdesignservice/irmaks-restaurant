import { notFound } from 'next/navigation'
import { todayInLondon } from '@/lib/time'
import {
  previewBookingsForDate,
  previewCoversForDate,
  previewCustomerRows,
  previewFindBooking,
  previewGetBlackouts,
  previewGetPeriods,
  previewGetSettings,
} from '@/lib/preview-store'
import DayView from '@/components/admin/DayView'
import BookingDetailView from '@/components/admin/BookingDetailView'
import CustomersView from '@/components/admin/CustomersView'
import SettingsView from '@/components/admin/SettingsView'
import NewBookingView from '@/components/admin/NewBookingView'
import {
  previewAddBlackoutAction,
  previewAddBooking,
  previewChangeStatus,
  previewEditBooking,
  previewEraseCustomer,
  previewRemoveBlackoutAction,
  previewResetAction,
  previewSaveNote,
  previewSavePeriodAction,
  previewSaveSettingsAction,
} from '../actions'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Admin UI preview | Irmak',
  robots: { index: false, follow: false },
}

const BASE = '/admin/preview'

/**
 * Working preview of the admin panel, for reviewing and demonstrating it before
 * Supabase exists.
 *
 * It renders the same components the real screens use, wired to an in-memory
 * store, so every button genuinely works — status changes, edits, manual
 * bookings, erasure, settings, blackouts and the CSV export. Changes last until
 * the dev server restarts, and Reset puts the sample data back.
 *
 * Two things keep this safe:
 *   1. It 404s outside development, and so does every action.
 *   2. There is no database connection and no session. The store holds only
 *      invented sample data.
 *
 * It does not weaken the auth guard on the real admin routes.
 */
export default function AdminPreviewPage({
  params,
  searchParams,
}: {
  params: { rest?: string[] }
  searchParams: { date?: string; q?: string; opted_in?: string; error?: string }
}) {
  if (process.env.NODE_ENV !== 'development') notFound()

  const today = todayInLondon()
  const date = searchParams.date ?? today
  const segments = params.rest ?? []
  const first = segments[0]

  const screen =
    first === 'booking'
      ? 'detail'
      : first === 'new'
        ? 'new'
        : first === 'customers'
          ? 'customers'
          : first === 'settings'
            ? 'settings'
            : first === 'empty'
              ? 'empty'
              : 'day'

  const bookings = previewBookingsForDate(date)
  // Defaults to the engagement booking, which exercises a guest note, an
  // occasion and a long message all at once.
  const detail =
    previewFindBooking(segments[1] ?? '') ??
    bookings.find((b) => b.occasion === 'engagement') ??
    bookings[0]

  return (
    <>
      <PreviewBanner screen={screen} error={searchParams.error} />

      {screen === 'day' && (
        <DayView date={date} today={today} bookings={bookings} basePath={BASE} />
      )}

      {screen === 'empty' && (
        // An empty date rather than a special case, so this is the real state.
        <DayView date="2027-01-04" today={today} bookings={[]} basePath={BASE} />
      )}

      {screen === 'detail' &&
        (detail ? (
          <BookingDetailView
            booking={detail}
            onChangeStatus={previewChangeStatus}
            onEdit={previewEditBooking}
            onSaveNote={previewSaveNote}
            basePath={BASE}
          />
        ) : (
          <p className="admin-container pt-8 text-white/60">
            That booking has been deleted.{' '}
            <a href={BASE} className="text-gold underline">
              Back to the day view
            </a>
          </p>
        ))}

      {screen === 'new' && (
        <NewBookingView
          date={date}
          bookedCovers={previewCoversForDate(date)}
          settings={previewGetSettings()}
          onSubmit={previewAddBooking}
          basePath={BASE}
        />
      )}

      {screen === 'customers' && (
        <CustomersView
          rows={previewCustomerRows()}
          query={(searchParams.q ?? '').trim()}
          optedInOnly={searchParams.opted_in === '1'}
          onErase={previewEraseCustomer}
          basePath={`${BASE}/customers`}
        />
      )}

      {screen === 'settings' && (
        <SettingsView
          settings={previewGetSettings()}
          periods={previewGetPeriods()}
          blackouts={previewGetBlackouts(today)}
          today={today}
          onSaveSettings={previewSaveSettingsAction}
          onSaveServicePeriod={previewSavePeriodAction}
          onAddBlackout={previewAddBlackoutAction}
          onRemoveBlackout={previewRemoveBlackoutAction}
        />
      )}
    </>
  )
}

function PreviewBanner({ screen, error }: { screen: string; error?: string }) {
  const screens = [
    { key: 'day', label: 'Day view', href: BASE },
    { key: 'detail', label: 'Booking detail', href: `${BASE}/booking` },
    { key: 'new', label: 'Add booking', href: `${BASE}/new` },
    { key: 'customers', label: 'Customers', href: `${BASE}/customers` },
    { key: 'settings', label: 'Settings', href: `${BASE}/settings` },
    { key: 'empty', label: 'Empty day', href: `${BASE}/empty` },
  ]

  return (
    <div className="sticky top-0 z-40 border-b border-gold/25 bg-navy-deep/95 backdrop-blur">
      <div className="admin-container py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.7rem] uppercase tracking-wider text-gold">
            UI preview · sample data · changes reset on restart
          </p>
          <form action={previewResetAction}>
            <button
              type="submit"
              className="shrink-0 rounded-cta border border-white/15 px-2.5 py-1 text-xs text-white/55 transition-colors hover:border-gold hover:text-gold"
            >
              Reset data
            </button>
          </form>
        </div>

        <nav className="mt-2 flex flex-wrap gap-1">
          {screens.map(({ key, label, href }) => {
            const active = screen === key
            return active ? (
              <span
                key={key}
                aria-current="page"
                className="rounded-cta bg-gold px-3 py-1.5 text-sm font-medium text-navy"
              >
                {label}
              </span>
            ) : (
              <a
                key={key}
                href={href}
                className="rounded-cta border border-white/15 px-3 py-1.5 text-sm text-white/70 transition-colors hover:border-gold hover:text-gold"
              >
                {label}
              </a>
            )
          })}
        </nav>

        {error && (
          <p
            role="alert"
            className="mt-2 rounded-cta border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-white"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
