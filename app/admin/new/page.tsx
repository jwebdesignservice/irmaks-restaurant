import { adminSettings, coversForDate } from '@/lib/admin-store'
import { todayInLondon } from '@/lib/time'
import { isValidDate } from '@/lib/validation'
import AdminNav from '@/components/AdminNav'
import NewBookingView from '@/components/admin/NewBookingView'
import { createManualBooking } from '../actions'

export const dynamic = 'force-dynamic'

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  const today = todayInLondon()
  const date = searchParams.date && isValidDate(searchParams.date) ? searchParams.date : today

  const [settings, covers] = await Promise.all([adminSettings(), coversForDate(date)])
  const bookedCovers = Object.values(covers).reduce((a, b) => a + b, 0)

  return (
    <>
      <AdminNav current="day" />
      <NewBookingView
        date={date}
        bookedCovers={bookedCovers}
        settings={settings}
        onSubmit={createManualBooking}
      />
    </>
  )
}
