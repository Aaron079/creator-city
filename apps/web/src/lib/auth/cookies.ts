import { cookies } from 'next/headers'

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'creator_city_session'
const SESSION_DAYS = parseInt(process.env.AUTH_SESSION_DAYS ?? '30', 10)
const IS_PROD = process.env.NODE_ENV === 'production'

export function setSessionCookie(token: string): void {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export function clearSessionCookie(): void {
  cookies().set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export function getSessionToken(): string | undefined {
  return cookies().get(COOKIE_NAME)?.value
}
