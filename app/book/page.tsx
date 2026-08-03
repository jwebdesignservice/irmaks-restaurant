import { getSettings } from '@/lib/store'
import { todayInLondon, addDays } from '@/lib/time'
import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
import BookingForm from './BookingForm'

export const dynamic = 'force-dynamic'

export default async function BookPage() {
  const settings = await getSettings()
  const today = todayInLondon()

  return (
    <>
      <SiteHeader phone={settings.venue_phone} />

      <main className="mx-auto w-[90%] max-w-2xl pb-8 pt-8 md:pt-14">
        <h1 className="text-4xl leading-tight text-gold md:text-5xl">Book a Table</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-white/70">
          Choose your party size, date and time. We&apos;ll email your confirmation straight
          away.
        </p>

        <BookingForm
          maxPartySizeOnline={settings.max_party_size_online}
          minDate={today}
          maxDate={addDays(today, settings.max_advance_days)}
          venuePhone={settings.venue_phone}
          venueName={settings.venue_name}
          venueAddress={settings.venue_address}
          turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
        />
      </main>

      <SiteFooter
        venueName={settings.venue_name}
        address={settings.venue_address}
        phone={settings.venue_phone}
      />
    </>
  )
}
