'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth.store'
import { apiClient } from '@/lib/api-client'

export default function RegisterPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await apiClient.post<{ accessToken: string; user: unknown }>(
        '/auth/register',
        form,
      )
      setAuth(data.accessToken, data.user as Parameters<typeof setAuth>[1])
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-city-bg px-4 py-12">
      <div className="w-full max-w-md space-y-8 animate-slide-up">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gradient">Join Creator City</h1>
          <p className="text-gray-400 mt-2">Build your creative empire</p>
        </div>

        <form onSubmit={handleSubmit} className="city-card space-y-4">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full bg-city-bg border border-city-border rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-city-accent transition-colors"
                placeholder="alice_creator"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                className="w-full bg-city-bg border border-city-border rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-city-accent transition-colors"
                placeholder="Alice Chen"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full bg-city-bg border border-city-border rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-city-accent transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full bg-city-bg border border-city-border rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-city-accent transition-colors"
              placeholder="Min. 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-city-accent hover:bg-city-accent-glow disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all duration-200 glow"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-city-accent hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
