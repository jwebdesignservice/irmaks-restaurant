import { bookingByToken, getSettings } from '@/lib/store'
import { formatLongDate, minutesUntil, trimSeconds } from '@/lib/time'
import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
import CancelForm from './CancelForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Your booking | Irmak',
  robots: { index: false, follow: false }, // contains a guest's booking
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function BookingTokenPage({ params }: { params: { token: string } }) {
  const settings = await getSettings()

  // Reject anything that is not token-shaped before touching the database.
  const booking = UUID.test(params.token) ? await bookingByToken(params.token) : null

  return (
    <>
      <SiteHeader phone={settings.venue_phone} />

      <main className="mx-auto w-[90%] max-w-lg pb-8 pt-8 md:pt-14">
        {!booking ? (
          <div className="card p-6">
            <h1 className="font-serif text-2xl text-gold">We could not find that booking</h1>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-white/70">
              The link may be incomplete, or the booking may already have been removed. Give us a
              ring and we will sort it out.
            </p>
            <a
              href={`tel:${settings.venue_phone.replace(/\s/g, '')}`}
              className="btn-primary mt-5 w-full sm:w-auto"
            >
              Call {settings.venue_phone}
            </a>
          </div>
        ) : (
          <CancelForm
            token={params.token}
            initialStatus={booking.status}
            firstName={booking.first_name}
            when={`${formatLongDate(booking.booking_date)} at ${trimSeconds(booking.booking_time)}`}
            partySize={booking.party_size}
            venueName={settings.venue_name}
            venueAddress={settings.venue_address}
            venuePhone={settings.venue_phone}
            // Past bookings cannot be cancelled — there is nothing to release.
            isPast={minutesUntil(booking.booking_date, trimSeconds(booking.booking_time)) < 0}
          />
        )}
      </main>

      <SiteFooter
        venueName={settings.venue_name}
        address={settings.venue_address}
        phone={settings.venue_phone}
      />
    </>
  )
}
