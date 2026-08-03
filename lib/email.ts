// Transactional email via Resend.
//
// Plain, legible HTML with inline styles and no templating framework. Email
// clients strip <style> blocks and ignore most modern CSS, so inline attributes
// on tables is the only thing that renders consistently across Gmail, Outlook
// and iCloud.
//
// Nothing here ever throws into the booking path. A guest whose confirmation
// email failed still has a booking, and still has the confirmation on screen —
// losing the table because Resend had a bad minute would be far worse.

import { Resend } from 'resend'
import { formatLongDate, trimSeconds } from './time'
import { occasionLabel } from './occasions'
import type { Booking, Settings } from './types'

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.BOOKING_FROM_EMAIL)
}

function fromAddress(settings: Settings): string {
  const address = process.env.BOOKING_FROM_EMAIL
  if (!address) return ''
  return `${settings.venue_name} <${address}>`
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const NAVY = '#2b3f58'
const GOLD = '#fed363'

function shell(heading: string, bodyRows: string, footer: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#202020;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:${NAVY};padding:24px;">
            <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;color:${GOLD};">${heading}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.55;">
              ${bodyRows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 24px;font-size:13px;line-height:1.6;color:#666666;">
            ${footer}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#666666;width:110px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;color:#202020;vertical-align:top;">${value}</td>
  </tr>`
}

/** Guest confirmation, with the self-service cancellation link. */
export async function sendGuestConfirmation(
  booking: Booking,
  settings: Settings
): Promise<void> {
  const resend = client()
  if (!resend || !emailConfigured()) return

  const cancelUrl = `${siteUrl()}/booking/${booking.cancellation_token}`
  const when = `${formatLongDate(booking.booking_date)} at ${trimSeconds(booking.booking_time)}`

  const rows = [
    detailRow('When', `<strong>${escapeHtml(when)}</strong>`),
    detailRow(
      'Party',
      `${booking.party_size} ${booking.party_size === 1 ? 'person' : 'people'}`
    ),
    booking.occasion
      ? detailRow('Occasion', escapeHtml(occasionLabel(booking.occasion) ?? ''))
      : '',
    detailRow('Where', escapeHtml(settings.venue_address).replace(/,\s*/g, ',<br>')),
    detailRow(
      'Phone',
      `<a href="tel:${escapeHtml(settings.venue_phone.replace(/\s/g, ''))}" style="color:${NAVY};">${escapeHtml(settings.venue_phone)}</a>`
    ),
  ].join('')

  const footer = `
    <p style="margin:0 0 12px;">
      Need to cancel? <a href="${cancelUrl}" style="color:${NAVY};font-weight:bold;">Cancel this booking</a>.
      If your plans have only changed slightly, give us a ring on
      ${escapeHtml(settings.venue_phone)} and we will sort it out.
    </p>
    <p style="margin:0;">${escapeHtml(settings.venue_name)}, ${escapeHtml(settings.venue_address)}</p>`

  const html = shell(
    'Table booked',
    `<tr><td colspan="2" style="padding:0 0 16px;">Thanks ${escapeHtml(booking.first_name)} — we look forward to seeing you.</td></tr>${rows}`,
    footer
  )

  const text = [
    `Table booked at ${settings.venue_name}`,
    '',
    `Thanks ${booking.first_name} - we look forward to seeing you.`,
    '',
    `When: ${when}`,
    `Party: ${booking.party_size}`,
    booking.occasion ? `Occasion: ${occasionLabel(booking.occasion)}` : '',
    `Where: ${settings.venue_address}`,
    `Phone: ${settings.venue_phone}`,
    '',
    `Need to cancel? ${cancelUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

  await resend.emails.send({
    from: fromAddress(settings),
    to: booking.email,
    subject: `Your table at ${settings.venue_name} — ${when}`,
    html,
    text,
  })
}

/** Venue notification, on every new booking. */
export async function sendVenueNotification(
  booking: Booking,
  settings: Settings
): Promise<void> {
  const resend = client()
  if (!resend || !emailConfigured()) return

  const when = `${formatLongDate(booking.booking_date)} at ${trimSeconds(booking.booking_time)}`

  const rows = [
    detailRow('When', `<strong>${escapeHtml(when)}</strong>`),
    detailRow('Party', String(booking.party_size)),
    detailRow('Name', escapeHtml(`${booking.first_name} ${booking.last_name}`)),
    detailRow(
      'Phone',
      `<a href="tel:${escapeHtml(booking.phone.replace(/\s/g, ''))}" style="color:${NAVY};">${escapeHtml(booking.phone)}</a>`
    ),
    detailRow('Email', escapeHtml(booking.email)),
    booking.occasion
      ? detailRow('Occasion', escapeHtml(occasionLabel(booking.occasion) ?? ''))
      : '',
    detailRow('Source', booking.source === 'phone' ? 'Added by staff' : 'Website'),
    booking.notes
      ? detailRow(
          'Notes',
          `<strong style="color:#8a5a00;">${escapeHtml(booking.notes).replace(/\n/g, '<br>')}</strong>`
        )
      : '',
  ].join('')

  const html = shell(
    'New booking',
    rows,
    `<p style="margin:0;">Open the day view: <a href="${siteUrl()}/admin?date=${booking.booking_date}" style="color:${NAVY};">${siteUrl()}/admin</a></p>`
  )

  const notesLine = booking.notes ? `\nNOTES: ${booking.notes}` : ''

  await resend.emails.send({
    from: fromAddress(settings),
    to: settings.venue_email,
    subject: `New booking — ${booking.party_size} on ${when}`,
    html,
    text: `New booking\n\nWhen: ${when}\nParty: ${booking.party_size}\nName: ${booking.first_name} ${booking.last_name}\nPhone: ${booking.phone}\nEmail: ${booking.email}${booking.occasion ? `\nOccasion: ${occasionLabel(booking.occasion)}` : ''}${notesLine}`,
  })
}

/** Guest cancellation confirmation. */
export async function sendCancellationConfirmation(
  booking: Booking,
  settings: Settings
): Promise<void> {
  const resend = client()
  if (!resend || !emailConfigured()) return

  const when = `${formatLongDate(booking.booking_date)} at ${trimSeconds(booking.booking_time)}`

  const html = shell(
    'Booking cancelled',
    `<tr><td colspan="2" style="padding:0 0 16px;">Your table on <strong>${escapeHtml(when)}</strong> has been cancelled. Nothing further to do.</td></tr>`,
    `<p style="margin:0;">We hope to see you another time. To book again, visit
      <a href="${siteUrl()}/book" style="color:${NAVY};">${escapeHtml(settings.venue_name)}</a>
      or call ${escapeHtml(settings.venue_phone)}.</p>`
  )

  await resend.emails.send({
    from: fromAddress(settings),
    to: booking.email,
    subject: `Cancelled — your table on ${when}`,
    html,
    text: `Your table at ${settings.venue_name} on ${when} has been cancelled.\n\nTo book again: ${siteUrl()}/book or call ${settings.venue_phone}`,
  })
}

/**
 * Fire-and-forget wrapper. Logs only the failure kind, never the payload — that
 * would put the guest's personal data in the logs.
 */
export async function sendQuietly(task: Promise<void>, label: string): Promise<void> {
  try {
    await task
  } catch (error) {
    console.error(`email failed: ${label}`, error instanceof Error ? error.message : 'unknown')
  }
}
