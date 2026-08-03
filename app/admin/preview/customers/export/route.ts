import { previewCustomerRows } from '@/lib/preview-store'
import { toCsv } from '@/lib/csv'
import { todayInLondon } from '@/lib/time'

export const dynamic = 'force-dynamic'

/**
 * CSV export for the preview, so the Export button actually downloads a file and
 * the format can be checked in Excel before handover.
 *
 * Same toCsv() as the real export — identical escaping, BOM and headers — but
 * fed from the in-memory sample data. Development only.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not found', { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const optedInOnly = searchParams.get('opted_in') === '1'

  let rows = previewCustomerRows()
  if (optedInOnly) rows = rows.filter((c) => c.marketing_opt_in)

  const csv = toCsv(
    [
      'Email',
      'Name',
      'Phone',
      'Total bookings',
      'Last visit',
      'Marketing opt-in',
      'Opt-in given at',
    ],
    rows.map((c) => [
      c.email,
      c.name,
      c.phone,
      c.total_bookings,
      c.last_visit ?? '',
      c.marketing_opt_in ? 'Yes' : 'No',
      c.opt_in_at ?? '',
    ])
  )

  const suffix = optedInOnly ? '-marketing-opt-in' : ''
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="irmak-customers-SAMPLE${suffix}-${todayInLondon()}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
