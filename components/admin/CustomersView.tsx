import { normalisePhone } from '@/lib/validation'
import type { CustomerRow } from '@/lib/admin-store'

type Action = (formData: FormData) => Promise<void>

interface Props {
  rows: CustomerRow[]
  query: string
  optedInOnly: boolean
  onErase: Action
  loadError?: string | null
  basePath?: string
}

export default function CustomersView({
  rows,
  query,
  optedInOnly,
  onErase,
  loadError = null,
  basePath = '/admin/customers',
}: Props) {
  const filtered = filterCustomers(rows, query, optedInOnly)
  const optedInCount = rows.filter((c) => c.marketing_opt_in).length
  const exportHref = `${basePath}/export${optedInOnly ? '?opted_in=1' : ''}`

  return (
    <main className="admin-container pb-16 pt-4">
      <h1 className="font-serif text-2xl text-gold">Customers</h1>
      <p className="mt-1 text-sm text-white/55">
        {rows.length} {rows.length === 1 ? 'person' : 'people'} · {optedInCount} opted in to
        marketing
      </p>

      <form method="get" action={basePath} className="mt-4 space-y-3">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search name, email or phone"
          aria-label="Search customers"
          className="field-input"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              name="opted_in"
              value="1"
              defaultChecked={optedInOnly}
              className="h-4 w-4 accent-gold"
            />
            Marketing opt-in only
          </label>
          <button type="submit" className="btn-secondary px-4 py-2 text-sm">
            Apply
          </button>
          {(query || optedInOnly) && (
            <a href={basePath} className="text-sm text-white/45 hover:text-gold">
              Clear
            </a>
          )}
        </div>
      </form>

      {/* A plain link, not fetch: the browser handles the download natively. */}
      <a href={exportHref} download className="btn-primary mt-4 inline-flex w-full sm:w-auto">
        Export CSV{optedInOnly ? ' (opted in only)' : ''}
      </a>
      <p className="mt-2 text-xs text-white/40">
        Includes opt-in status and the date consent was given. Opens in Excel.
      </p>

      {loadError && (
        <p role="alert" className="mt-4 rounded-cta border border-red-300/30 bg-red-500/10 p-4">
          {loadError}
        </p>
      )}

      <div className="mt-5">
        {!loadError && filtered.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-white">
              {rows.length === 0
                ? 'No customers yet. They appear here once bookings come in.'
                : 'No one matches that search.'}
            </p>
            {rows.length > 0 && (
              <a href={basePath} className="btn-secondary mt-4 inline-flex px-4 py-2 text-sm">
                Clear search
              </a>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((customer) => (
              <li key={customer.email}>
                <CustomerCard customer={customer} onErase={onErase} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

/**
 * Search across name, email and phone.
 *
 * The phone comparison normalises both sides, so searching "07700 900123"
 * matches a stored "+447700900123" — the whole reason numbers are normalised on
 * write.
 */
export function filterCustomers(
  rows: CustomerRow[],
  query: string,
  optedInOnly: boolean
): CustomerRow[] {
  const out = optedInOnly ? rows.filter((c) => c.marketing_opt_in) : rows
  if (!query) return out

  const needle = query.toLowerCase()
  const phoneNeedle = normalisePhone(query)
  const digits = query.replace(/\D/g, '')

  return out.filter((c) => {
    if (c.name?.toLowerCase().includes(needle)) return true
    if (c.email?.toLowerCase().includes(needle)) return true
    if (!c.phone) return false
    const stored = normalisePhone(c.phone)
    if (digits.length >= 4 && stored.includes(digits)) return true
    return phoneNeedle.length >= 5 && stored.includes(phoneNeedle)
  })
}

function CustomerCard({ customer, onErase }: { customer: CustomerRow; onErase: Action }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-sans text-[0.95rem] text-white">
            {customer.name || '(no name)'}
          </div>
          <a
            href={`mailto:${customer.email}`}
            className="mt-0.5 block truncate text-sm text-white/55 hover:text-gold"
          >
            {customer.email}
          </a>
          {customer.phone && (
            <a
              href={`tel:${customer.phone.replace(/\s/g, '')}`}
              className="mt-0.5 block text-sm text-white/55 hover:text-gold"
            >
              {customer.phone}
            </a>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className="font-serif text-xl leading-none text-gold">{customer.total_bookings}</div>
          <div className="mt-1 text-[0.7rem] uppercase tracking-wider text-white/40">
            booking{customer.total_bookings === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        {customer.marketing_opt_in ? (
          <span className="rounded border border-gold/40 px-1.5 py-0.5 text-[0.7rem] text-gold">
            Marketing opt-in
          </span>
        ) : (
          <span className="rounded border border-white/15 px-1.5 py-0.5 text-[0.7rem] text-white/45">
            No marketing
          </span>
        )}

        {customer.last_visit && (
          <span className="text-xs text-white/40">Last visit {customer.last_visit}</span>
        )}

        {/* Erasure, so a GDPR request never needs the Supabase dashboard. */}
        <details className="ml-auto">
          <summary className="cursor-pointer list-none text-xs text-white/35 transition-colors hover:text-red-300">
            Delete
          </summary>
          <form
            action={onErase}
            className="mt-2 rounded-cta border border-red-300/30 bg-red-500/10 p-3"
          >
            <input type="hidden" name="email" value={customer.email} />
            <p className="text-xs leading-relaxed text-white/75">
              Permanently deletes this customer and all {customer.total_bookings} of their bookings,
              including past ones. This cannot be undone.
            </p>
            <button
              type="submit"
              className="mt-2 rounded-cta border border-red-300/50 px-3 py-1.5 text-xs text-red-100 transition-colors hover:bg-red-400/20"
            >
              Yes, delete permanently
            </button>
          </form>
        </details>
      </div>
    </div>
  )
}
