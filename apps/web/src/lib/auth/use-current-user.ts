'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AuthUserPublic } from '@/lib/auth/client'

export type CurrentUserStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unknown'

type CurrentUserState = {
  status: CurrentUserStatus
  user: AuthUserPublic | null
  error: string | null
}

type AuthMeResponse = {
  authenticated?: boolean
  user?: AuthUserPublic | null
}

export function useCurrentUser() {
  const [state, setState] = useState<CurrentUserState>({
    status: 'loading',
    user: null,
    error: null,
  })

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }))
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 5_000)
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        setState({ status: 'unauthenticated', user: null, error: `AUTH_ME_${res.status}` })
        return
      }
      const data = await res.json() as AuthMeResponse
      if (data.authenticated === true && data.user) {
        setState({ status: 'authenticated', user: data.user, error: null })
        return
      }
      setState({ status: 'unauthenticated', user: null, error: null })
    } catch (error) {
      setState({
        status: 'unknown',
        user: null,
        error: error instanceof Error ? error.message : 'Failed to load current user',
      })
    } finally {
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { ...state, refresh }
}
