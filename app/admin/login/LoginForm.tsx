'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { browserClient } from '@/lib/supabase-browser'

/**
 * Email and password only. There is no signup, no magic link and no password
 * reset here by design — staff accounts are created by hand in the Supabase
 * dashboard, so there is no self-service surface to attack.
 */
export default function LoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)

    const { error: signInError } = await browserClient().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (signInError) {
      // Deliberately vague: naming which half was wrong tells an attacker
      // whether an address is a real staff account.
      setError('That email and password combination did not work.')
      setSubmitting(false)
      return
    }

    // Full reload so the middleware picks up the fresh session cookie.
    const destination = next?.startsWith('/admin') ? next : '/admin'
    router.replace(destination)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="card mt-8 space-y-4 p-5">
      <div>
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-input"
        />
      </div>

      <div>
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-input"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-cta border border-red-300/30 bg-red-500/10 p-3 text-sm">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-center text-xs leading-relaxed text-white/40">
        Forgotten your password? Ask whoever set up the system to reset it for you.
      </p>
    </form>
  )
}
