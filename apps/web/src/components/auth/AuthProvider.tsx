'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { useProfileStore } from '@/store/profile.store'
import { fetchCurrentUser } from '@/lib/auth/client'
import { clearUserScopedLocalState } from '@/lib/client-storage/clearUserLocalState'

const LAST_AUTH_USER_KEY = 'creator-city:last-auth-user-id'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, logout, isAuthenticated } = useAuthStore()
  const setCurrentUserId = useProfileStore((s) => s.setCurrentUserId)

  useEffect(() => {
    void (async () => {
      const res = await fetchCurrentUser()
      if (res.authenticated && res.user) {
        // Detect userId change: if a different user was previously active on this
        // browser (e.g. session expired without explicit logout, then a new user
        // logged in), wipe all user-scoped localStorage before hydrating the new user.
        try {
          const lastUserId = window.localStorage.getItem(LAST_AUTH_USER_KEY)
          if (lastUserId && lastUserId !== res.user.id) {
            clearUserScopedLocalState()
          }
          window.localStorage.setItem(LAST_AUTH_USER_KEY, res.user.id)
        } catch {
          // Private/incognito mode — non-fatal.
        }

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
