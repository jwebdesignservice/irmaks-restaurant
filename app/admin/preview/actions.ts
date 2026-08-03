'use server'

import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import {
  previewAddBlackout,
  previewCreateBooking,
  previewDeleteCustomer,
  previewRemoveBlackout,
  previewReset,
  previewSavePeriod,
  previewSaveSettings,
  previewSetStatus,
  previewUpdateBooking,
} from '@/lib/preview-store'
import { isValidDate, isValidTime, normalisePhone } from '@/lib/validation'
import { isOccasion } from '@/lib/occasions'
import type { BookingStatus } from '@/lib/types'

/**
 * Preview actions. These genuinely mutate the in-memory preview store, so every
 * button in the panel works and can be demonstrated.
 *
 * Each one refuses outside development. The store holds only invented sample
 * data and has no database connection, so there is nothing real to reach — but
 * the guard is cheap and this code should never run in production.
 */

const BASE = '/admin/preview'
const STATUSES: BookingStatus[] = ['confirmed', 'arrived', 'no_show', 'cancelled']

function devOnly() {
  if (process.env.NODE_ENV !== 'development') notFound()
}

function refresh() {
  revalidatePath(BASE, 'layout')
}

export async function previewChangeStatus(formData: FormData) {
  devOnly()
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (id && STATUSES.includes(status as BookingStatus)) {
    previewSetStatus(id, status as BookingStatus)
  }
  refresh()
}

export async function previewEditBooking(formData: FormData) {
  devOnly()
  const id = String(formData.get('id') ?? '')
  const partySize = Number(formData.get('party_size'))
  const time = String(formData.get('booking_time') ?? '')

  if (id && Number.isInteger(partySize) && partySize > 0 && isValidTime(time)) {
    previewUpdateBooking(id, { party_size: partySize, booking_time: time })
  }
  refresh()
}

export async function previewSaveNote(formData: FormData) {
  devOnly()
  const id = String(formData.get('id') ?? '')
  const note = String(formData.get('internal_notes') ?? '').trim()
  if (id) previewUpdateBooking(id, { internal_notes: note || null })
  refresh()
}

export async function previewAddBooking(formData: FormData) {
  devOnly()

  const date = String(formData.get('booking_date') ?? '')
  const time = String(formData.get('booking_time') ?? '')
  const partySize = Number(formData.get('party_size'))
  const firstName = String(formData.get('first_name') ?? '').trim()
  const lastName = String(formData.get('last_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const phone = String(formData.get('phone') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const occasion = String(formData.get('occasion') ?? '').trim()

  if (
    !isValidDate(date) ||
    !isValidTime(time) ||
    !Number.isInteger(partySize) ||
    partySize < 1 ||
    !firstName ||
    !lastName ||
    !email ||
    !phone
  ) {
    redirect(`${BASE}/new?date=${date}&error=${encodeURIComponent('Please fill in every field.')}`)
  }

  const result = previewCreateBooking({
    booking_date: date,
    booking_time: time,
    party_size: partySize,
    first_name: firstName,
    last_name: lastName,
    email,
    phone: normalisePhone(phone),
    notes: notes || null,
    occasion: isOccasion(occasion) ? occasion : null,
    marketing_opt_in: formData.get('marketing_opt_in') === 'on',
    override_capacity: formData.get('override_capacity') === 'on',
  })

  refresh()

  if (!result.ok) {
    redirect(`${BASE}/new?date=${date}&error=${encodeURIComponent(result.error)}`)
  }

  redirect(`${BASE}/booking/${result.id}?date=${date}`)
}

export async function previewEraseCustomer(formData: FormData) {
  devOnly()
  const email = String(formData.get('email') ?? '')
  if (email) previewDeleteCustomer(email)
  refresh()
}

export async function previewSaveSettingsAction(formData: FormData) {
  devOnly()
  const num = (key: string) => Number(formData.get(key))
  const str = (key: string) => String(formData.get(key) ?? '').trim()

  const fields: Record<string, unknown> = {}
  const maxParty = num('max_party_size_online')
  const leadTime = num('min_lead_time_minutes')
  const advance = num('max_advance_days')

  if (Number.isInteger(maxParty) && maxParty > 0) fields.max_party_size_online = maxParty
  if (Number.isInteger(leadTime) && leadTime >= 0) fields.min_lead_time_minutes = leadTime
  if (Number.isInteger(advance) && advance > 0) fields.max_advance_days = advance
  if (str('venue_name')) fields.venue_name = str('venue_name')
  if (str('venue_email')) fields.venue_email = str('venue_email')
  if (str('venue_address')) fields.venue_address = str('venue_address')
  if (str('venue_phone')) fields.venue_phone = str('venue_phone')

  previewSaveSettings(fields)
  refresh()
}

export async function previewSavePeriodAction(formData: FormData) {
  devOnly()
  const id = String(formData.get('id') ?? '')
  const cap = Number(formData.get('max_covers_per_slot'))
  const interval = Number(formData.get('slot_interval_minutes'))

  if (id) {
    previewSavePeriod(id, {
      max_covers_per_slot: Number.isInteger(cap) && cap >= 0 ? cap : undefined,
      slot_interval_minutes: Number.isInteger(interval) && interval >= 5 ? interval : undefined,
      active: formData.get('active') === 'on',
    })
  }
  refresh()
}

export async function previewAddBlackoutAction(formData: FormData) {
  devOnly()
  const date = String(formData.get('date') ?? '')
  const wholeDay = formData.get('whole_day') === 'on'
  const start = String(formData.get('start_time') ?? '')
  const end = String(formData.get('end_time') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()

  if (!isValidDate(date) || !reason) {
    redirect(
      `${BASE}/settings?error=${encodeURIComponent('Give both a date and a reason.')}`
    )
  }

  if (wholeDay) {
    previewAddBlackout({ date, start_time: null, end_time: null, reason })
  } else {
    if (!isValidTime(start) || !isValidTime(end) || end < start) {
      redirect(
        `${BASE}/settings?error=${encodeURIComponent('Choose a valid from and until time.')}`
      )
    }
    previewAddBlackout({ date, start_time: start, end_time: end, reason })
  }
  refresh()
  redirect(`${BASE}/settings`)
}

export async function previewRemoveBlackoutAction(formData: FormData) {
  devOnly()
  const id = String(formData.get('id') ?? '')
  if (id) previewRemoveBlackout(id)
  refresh()
}

export async function previewResetAction() {
  devOnly()
  previewReset()
  refresh()
  redirect(BASE)
}
