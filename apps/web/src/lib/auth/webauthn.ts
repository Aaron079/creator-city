import type {
  AuthenticatorTransportFuture,
  Base64URLString,
  WebAuthnCredential,
} from '@simplewebauthn/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

const IS_PROD = process.env.NODE_ENV === 'production'
const CHALLENGE_MAX_AGE_SECONDS = 5 * 60

export const WEBAUTHN_REGISTER_CHALLENGE_COOKIE = 'creator_city_webauthn_register_challenge'
export const WEBAUTHN_AUTH_CHALLENGE_COOKIE = 'creator_city_webauthn_auth_challenge'
export const WEBAUTHN_AUTH_USER_COOKIE = 'creator_city_webauthn_auth_user'

export function getWebAuthnRpName(): string {
  return process.env.WEBAUTHN_RP_NAME ?? 'Creator City'
}

export function getWebAuthnRpId(req: NextRequest): string {
  return process.env.WEBAUTHN_RP_ID ?? new URL(req.url).hostname
}

export function getWebAuthnOrigin(req: NextRequest): string {
  return process.env.WEBAUTHN_ORIGIN ?? new URL(req.url).origin
}

export function setWebAuthnCookie(name: string, value: string): void {
  cookies().set(name, value, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: CHALLENGE_MAX_AGE_SECONDS,
  })
}

export function getWebAuthnCookie(name: string): string | undefined {
  return cookies().get(name)?.value
}

export function clearWebAuthnCookie(name: string): void {
  cookies().set(name, '', {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export function toStoredTransports(
  transports: AuthenticatorTransportFuture[] | undefined,
): string[] {
  return transports ? Array.from(new Set(transports)) : []
}

export function toCredentialForVerification(credential: {
  credentialId: string
  publicKey: Uint8Array | Buffer
  counter: bigint | number
  transports: string[]
}): WebAuthnCredential {
  return {
    id: credential.credentialId as Base64URLString,
    publicKey: new Uint8Array(credential.publicKey),
    counter: Number(credential.counter),
    transports: credential.transports as AuthenticatorTransportFuture[],
  }
}
