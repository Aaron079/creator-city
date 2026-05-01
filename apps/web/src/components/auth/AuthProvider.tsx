'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { useProfileStore } from '@/store/profile.store'
import { fetchCurrentUser } from '@/lib/auth/client'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, logout, isAuthenticated } = useAuthStore()
  const setCurrentUserId = useProfileStore((s) => s.setCurrentUserId)

  useEffect(() => {
    void (async () => {
      const res = await fetchCurrentUser()
      if (res.authenticated && res.user) {
        setAuth(null, {
          id: res.user.id,
          username: res.user.username ?? '',
          displayName: res.user.displayName,
          email: res.user.email,
          avatarUrl: res.user.avatarUrl ?? undefined,
          role: res.user.role,
          reputation: 0,
          level: 1,
          credits: 0,
        })
        setCurrentUserId(res.user.id)
      } else if (isAuthenticated) {
        // Cookie expired/invalid — clear stale local state
        logout()
      }
    })()
    // Run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}
