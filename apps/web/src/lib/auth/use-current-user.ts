'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AuthUserPublic } from '@/lib/auth/client'

export type CurrentUserStatus = 'loading' | 'authenticated' | 'unauthenticated'

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
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store',
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
        status: 'unauthenticated',
        user: null,
        error: error instanceof Error ? error.message : 'Failed to load current user',
      })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { ...state, refresh }
}
