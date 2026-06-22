'use client'

import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import type { AuthUserPublic } from '@/lib/auth/client'

export interface PasskeyCapability {
  webauthn: boolean
  platformAuthenticator: boolean
}

export async function getPasskeyCapability(): Promise<PasskeyCapability> {
  const webauthn = browserSupportsWebAuthn()
  const platformAuthenticator = webauthn
    ? await platformAuthenticatorIsAvailable().catch(() => false)
    : false
  return { webauthn, platformAuthenticator }
}

export async function registerPasskey(name?: string) {
  const optionsRes = await fetch('/api/auth/passkey/register/options', {
    method: 'POST',
    credentials: 'include',
  })
  const options = await optionsRes.json() as PublicKeyCredentialCreationOptionsJSON & { message?: string }
  if (!optionsRes.ok) {
    throw new Error(options.message ?? '无法开始 Passkey 绑定。')
  }

  const response = await startRegistration({ optionsJSON: options })
  const verifyRes = await fetch('/api/auth/passkey/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ response, name }),
  })
  const data = await verifyRes.json() as {
    success?: boolean
    message?: string
    credential?: {
      id: string
      name: string | null
      createdAt: string
      lastUsedAt: string | null
      deviceType: string | null
      backedUp: boolean
    }
  }
  if (!verifyRes.ok || !data.success || !data.credential) {
    throw new Error(data.message ?? 'Passkey 绑定失败。')
  }
  return data.credential
}

export async function loginWithPasskey(email: string): Promise<AuthUserPublic> {
  const optionsRes = await fetch('/api/auth/passkey/authenticate/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  })
  const options = await optionsRes.json() as PublicKeyCredentialRequestOptionsJSON & { message?: string }
  if (!optionsRes.ok) {
    throw new Error(options.message ?? '无法开始 Passkey 登录。')
  }

  const response = await startAuthentication({ optionsJSON: options })
  const verifyRes = await fetch('/api/auth/passkey/authenticate/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ response }),
  })
  const data = await verifyRes.json() as { user?: AuthUserPublic; message?: string }
  if (!verifyRes.ok || !data.user) {
    throw new Error(data.message ?? 'Passkey 登录失败。')
  }
  return data.user
}
