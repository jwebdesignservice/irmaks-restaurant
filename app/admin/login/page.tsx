import { authConfigured } from '@/lib/supabase-server'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Staff login | Irmak' }

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string }
}) {
  const configured = authConfigured()

  return (
    <main className="mx-auto flex min-h-screen w-[90%] max-w-sm flex-col justify-center py-12">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/imrak-logo.png" alt="Irmak" className="mx-auto mb-8 h-16 w-auto" />

      <h1 className="text-center font-serif text-2xl text-gold">Staff login</h1>
      <p className="mt-2 text-center text-sm text-white/55">Bookings and customers for Irmak.</p>

      {configured ? (
        <LoginForm next={searchParams.next} />
      ) : (
        <div className="card mt-8 p-5">
          <h2 className="font-sans text-base font-medium text-white">Not connected yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            Supabase is not configured on this deployment, so there is nothing to log in to. Set{' '}
            <code className="text-gold">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="text-gold">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then reload.
          </p>
        </div>
      )}

      <a
        href="/"
        className="mt-8 text-center text-sm text-white/45 transition-colors hover:text-gold"
      >
        Back to the website
      </a>
    </main>
  )
}
