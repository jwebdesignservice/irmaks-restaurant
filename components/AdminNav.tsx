import { signOut } from '@/app/admin/actions'

/**
 * Admin top bar. Deliberately plain and thumb-reachable — staff use this
 * standing up, one-handed, mid-service.
 */
export default function AdminNav({ current }: { current: 'day' | 'customers' | 'settings' }) {
  const tab = (key: typeof current, href: string, label: string) =>
    key === current ? (
      <span
        key={key}
        aria-current="page"
        className="rounded-cta bg-white/10 px-3 py-2 text-sm font-medium text-gold"
      >
        {label}
      </span>
    ) : (
      <a
        key={key}
        href={href}
        className="rounded-cta px-3 py-2 text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white"
      >
        {label}
      </a>
    )

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-deep/95 backdrop-blur">
      <div className="admin-container flex items-center justify-between gap-2 py-2.5">
        <nav className="flex items-center gap-1">
          {tab('day', '/admin', 'Bookings')}
          {tab('customers', '/admin/customers', 'Customers')}
          {tab('settings', '/admin/settings', 'Settings')}
        </nav>

        <form action={signOut}>
          <button
            type="submit"
            className="rounded-cta px-2.5 py-2 text-sm text-white/45 transition-colors hover:text-gold"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  )
}
