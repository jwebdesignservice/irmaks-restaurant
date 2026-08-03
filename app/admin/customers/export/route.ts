import { customers } from '@/lib/admin-store'
import { currentUser } from '@/lib/supabase-server'
import { toCsv } from '@/lib/csv'
import { todayInLondon } from '@/lib/time'

export const dynamic = 'force-dynamic'

/**
 * Customer CSV export.
 *
 * The middleware already guards /admin/*, but this route hands out the entire
 * customer list, so it re-checks the session itself rather than relying on one
 * layer.
 */
export async function GET(request: Request) {
  const user = await currentUser()
  if (!user) return new Response('Unauthorised', { status: 401 })

  const { searchParams } = new URL(request.url)
  const optedInOnly = searchParams.get('opted_in') === '1'

  let rows = await customers()
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
  const filename = `irmak-customers${suffix}-${todayInLondon()}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
