import { customers } from '@/lib/admin-store'
import AdminNav from '@/components/AdminNav'
import CustomersView from '@/components/admin/CustomersView'
import { eraseCustomer } from '../actions'
import type { CustomerRow } from '@/lib/admin-store'

export const dynamic = 'force-dynamic'

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; opted_in?: string }
}) {
  let rows: CustomerRow[] = []
  let loadError: string | null = null
  try {
    rows = await customers()
  } catch {
    loadError = 'Could not load customers. Check the connection and try again.'
  }

  return (
    <>
      <AdminNav current="customers" />
      <CustomersView
        rows={rows}
        query={(searchParams.q ?? '').trim()}
        optedInOnly={searchParams.opted_in === '1'}
        onErase={eraseCustomer}
        loadError={loadError}
      />
    </>
  )
}
