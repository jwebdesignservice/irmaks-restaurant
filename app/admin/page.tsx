import { bookingsForDate } from '@/lib/admin-store'
import { todayInLondon } from '@/lib/time'
import { isValidDate } from '@/lib/validation'
import AdminNav from '@/components/AdminNav'
import DayView from '@/components/admin/DayView'
import type { Booking } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Thin wrapper: fetch, then hand off to the presentational DayView. */
export default async function AdminDayPage({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  const today = todayInLondon()
  const date = searchParams.date && isValidDate(searchParams.date) ? searchParams.date : today

  let bookings: Booking[] = []
  let loadError: string | null = null
  try {
    bookings = await bookingsForDate(date)
  } catch {
    loadError = 'Could not load bookings. Check the connection and try again.'
  }

  return (
    <>
      <AdminNav current="day" />
      <DayView date={date} today={today} bookings={bookings} loadError={loadError} />
    </>
  )
}
