import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Irmak admin',
  robots: { index: false, follow: false }, // never in search results
}

/**
 * Nested inside the root layout, so it must not emit its own html/body.
 *
 * The dark navy background distinguishes admin from the public site at a glance
 * — useful when staff have both open on a phone.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-navy-deep">{children}</div>
}
