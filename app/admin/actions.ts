'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  addBlackout,
  adminSettings,
  deleteCustomer,
  removeBlackout,
  setBookingStatus,
  updateBooking,
  updateServicePeriod,
  updateSettings,
} from '@/lib/admin-store'
import { sessionClient } from '@/lib/supabase-server'
import { isValidDate, isValidTime, validateBooking } from '@/lib/validation'
import type { BookingStatus } from '@/lib/types'

/**
 * Every action here runs through the staff session client, so RLS is the
 * backstop: an unauthenticated request cannot write even if it reaches these.
 * They still validate their own input — a form post is not evidence of anything.
 */

const STATUSES: BookingStatus[] = ['confirmed', 'arrived', 'no_show', 'cancelled']

export async function signOut() {
  const db = sessionClient()
  if (db) await db.auth.signOut()
  redirect('/admin/login')
}

export async function changeStatus(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')

  if (!id || !STATUSES.includes(status as BookingStatus)) {
    throw new Error('Invalid status change')
  }

  await setBookingStatus(id, status as BookingStatus)
  revalidatePath('/admin')
  revalidatePath(`/admin/booking/${id}`)
}

export async function editBooking(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const partySize = Number(formData.get('party_size'))
  const time = String(formData.get('booking_time') ?? '')

  if (!id) throw new Error('Missing booking')
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 500) {
    throw new Error('Party size looks wrong')
  }
  if (!isValidTime(time)) throw new Error('Time looks wrong')

  // Staff edits deliberately skip the cover cap: a manager moving a table
  // around mid-service is making a decision the system should not second-guess.
  await updateBooking(id, { party_size: partySize, booking_time: time })
  revalidatePath('/admin')
  revalidatePath(`/admin/booking/${id}`)
}

export async function saveInternalNote(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const note = String(formData.get('internal_notes') ?? '').trim()

  if (!id) throw new Error('Missing booking')
  if (note.length > 2000) throw new Error('Note is too long')

  await updateBooking(id, { internal_notes: note || null })
  revalidatePath(`/admin/booking/${id}`)
}

export async function createManualBooking(formData: FormData) {
  const settings = await adminSettings()

  // Manual entry bypasses max_party_size_online and min_lead_time_minutes: a
  // phone booking for 30 people tomorrow lunchtime is entirely normal.
  const payload = {
    booking_date: String(formData.get('booking_date') ?? ''),
    booking_time: String(formData.get('booking_time') ?? ''),
    party_size: Number(formData.get('party_size')),
    first_name: String(formData.get('first_name') ?? ''),
    last_name: String(formData.get('last_name') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    notes: String(formData.get('notes') ?? ''),
    occasion: String(formData.get('occasion') ?? ''),
    marketing_opt_in: formData.get('marketing_opt_in') === 'on',
  }

  const validated = validateBooking(payload, 500)
  if (!validated.ok) throw new Error(validated.message)

  const db = sessionClient()
  if (!db) throw new Error('Supabase is not configured')

  const override = formData.get('override_capacity') === 'on'

  const { data, error } = await db.rpc('create_booking', {
    p_booking_date: validated.value.booking_date,
    p_booking_time: validated.value.booking_time,
    p_party_size: validated.value.party_size,
    p_first_name: validated.value.first_name,
    p_last_name: validated.value.last_name,
    p_email: validated.value.email,
    p_phone: validated.value.phone,
    p_notes: validated.value.notes,
    p_occasion: validated.value.occasion,
    p_marketing_opt_in: validated.value.marketing_opt_in,
    p_source: 'phone',
    p_override_capacity: override,
  })

  if (error) {
    const message = error.message ?? ''
    if (message.includes('IRMAK_FULL')) {
      throw new Error(
        'That slot is at capacity. Tick "Allow over capacity" to book it anyway.'
      )
    }
    if (message.includes('IRMAK_NO_SERVICE')) {
      throw new Error(
        'The restaurant is not serving at that time. Tick "Allow over capacity" to book it anyway.'
      )
    }
    if (message.includes('IRMAK_BLACKOUT')) {
      throw new Error('That date is blacked out. Tick "Allow over capacity" to book it anyway.')
    }
    if (message.includes('IRMAK_DUPLICATE')) {
      throw new Error('That guest already has a booking at that time.')
    }
    throw new Error('Could not save the booking')
  }

  revalidatePath('/admin')
  redirect(`/admin/booking/${(data as { id: string }).id}`)
}

export async function eraseCustomer(formData: FormData) {
  const email = String(formData.get('email') ?? '')
  if (!email) throw new Error('Missing email')

  await deleteCustomer(email)
  revalidatePath('/admin/customers')
  revalidatePath('/admin')
}

export async function addBlackoutAction(formData: FormData) {
  const date = String(formData.get('date') ?? '')
  const wholeDay = formData.get('whole_day') === 'on'
  const start = String(formData.get('start_time') ?? '')
  const end = String(formData.get('end_time') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()

  if (!isValidDate(date)) throw new Error('Choose a valid date')
  if (!reason) throw new Error('Give a reason so staff know why')

  if (wholeDay) {
    await addBlackout({ date, start_time: null, end_time: null, reason })
  } else {
    if (!isValidTime(start) || !isValidTime(end)) throw new Error('Choose valid times')
    if (end < start) throw new Error('The end time is before the start time')
    await addBlackout({ date, start_time: start, end_time: end, reason })
  }

  revalidatePath('/admin/settings')
  revalidatePath('/admin')
}

export async function removeBlackoutAction(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) throw new Error('Missing blackout date')
  await removeBlackout(id)
  revalidatePath('/admin/settings')
  revalidatePath('/admin')
}

export async function saveSettings(formData: FormData) {
  const num = (key: string) => Number(formData.get(key))
  const str = (key: string) => String(formData.get(key) ?? '').trim()

  const maxParty = num('max_party_size_online')
  const leadTime = num('min_lead_time_minutes')
  const advance = num('max_advance_days')

  if (!Number.isInteger(maxParty) || maxParty < 1 || maxParty > 500) {
    throw new Error('Maximum party size looks wrong')
  }
  if (!Number.isInteger(leadTime) || leadTime < 0 || leadTime > 10080) {
    throw new Error('Lead time looks wrong')
  }
  if (!Number.isInteger(advance) || advance < 1 || advance > 730) {
    throw new Error('Booking window looks wrong')
  }

  const venueName = str('venue_name')
  const venueEmail = str('venue_email')
  const venueAddress = str('venue_address')
  const venuePhone = str('venue_phone')

  if (!venueName || !venueEmail || !venueAddress || !venuePhone) {
    throw new Error('Venue details cannot be blank')
  }

  await updateSettings({
    max_party_size_online: maxParty,
    min_lead_time_minutes: leadTime,
    max_advance_days: advance,
    venue_name: venueName,
    venue_email: venueEmail,
    venue_address: venueAddress,
    venue_phone: venuePhone,
  })

  revalidatePath('/admin/settings')
}

export async function saveServicePeriod(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const cap = Number(formData.get('max_covers_per_slot'))
  const interval = Number(formData.get('slot_interval_minutes'))
  const active = formData.get('active') === 'on'

  if (!id) throw new Error('Missing service period')
  if (!Number.isInteger(cap) || cap < 0 || cap > 1000) throw new Error('Cover cap looks wrong')
  if (!Number.isInteger(interval) || interval < 5 || interval > 240) {
    throw new Error('Slot interval looks wrong')
  }

  await updateServicePeriod(id, {
    max_covers_per_slot: cap,
    slot_interval_minutes: interval,
    active,
  })

  revalidatePath('/admin/settings')
}
