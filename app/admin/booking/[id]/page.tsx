import { notFound } from 'next/navigation'
import { bookingById } from '@/lib/admin-store'
import AdminNav from '@/components/AdminNav'
import BookingDetailView from '@/components/admin/BookingDetailView'
import { changeStatus, editBooking, saveInternalNote } from '../../actions'

export const dynamic = 'force-dynamic'

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const booking = await bookingById(params.id)
  if (!booking) notFound()

  return (
    <>
      <AdminNav current="day" />
      <BookingDetailView
        booking={booking}
        onChangeStatus={changeStatus}
        onEdit={editBooking}
        onSaveNote={saveInternalNote}
      />
    </>
  )
}
