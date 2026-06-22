import { NextRequest, NextResponse } from 'next/server'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { db } from '@/lib/db'
import { createSession } from '@/lib/auth/session'
import { setSessionCookie } from '@/lib/auth/cookies'
import {
  clearWebAuthnCookie,
  getWebAuthnCookie,
  getWebAuthnOrigin,
  getWebAuthnRpId,
  toCredentialForVerification,
  WEBAUTHN_AUTH_CHALLENGE_COOKIE,
  WEBAUTHN_AUTH_USER_COOKIE,
} from '@/lib/auth/webauthn'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const expectedChallenge = getWebAuthnCookie(WEBAUTHN_AUTH_CHALLENGE_COOKIE)
  const expectedUserId = getWebAuthnCookie(WEBAUTHN_AUTH_USER_COOKIE)
  if (!expectedChallenge || !expectedUserId) {
    return NextResponse.json({ message: 'Passkey 登录已超时，请重新开始。' }, { status: 400 })
  }

  const body = await req.json() as { response?: AuthenticationResponseJSON }
  if (!body.response) {
    return NextResponse.json({ message: '缺少 Passkey 登录响应。' }, { status: 400 })
  }

  const credential = await db.webAuthnCredential.findUnique({
    where: { credentialId: body.response.id },
    include: { user: { include: { profile: true } } },
  })

  if (!credential || credential.userId !== expectedUserId) {
    return NextResponse.json({ message: 'Passkey 与当前账号不匹配。' }, { status: 401 })
  }

  if (credential.user.status === 'BANNED') {
    return NextResponse.json({ message: '账号已被封禁，请联系支持。' }, { status: 403 })
  }
  if (credential.user.status !== 'ACTIVE') {
    return NextResponse.json({ message: '账号状态异常，请联系支持。' }, { status: 403 })
  }

  const verification = await verifyAuthenticationResponse({
    response: body.response,
    expectedChallenge,
    expectedOrigin: getWebAuthnOrigin(req),
    expectedRPID: getWebAuthnRpId(req),
    credential: toCredentialForVerification(credential),
    requireUserVerification: true,
  })

  if (!verification.verified) {
    return NextResponse.json({ message: 'Passkey 登录验证失败。' }, { status: 401 })
  }

  const now = new Date()
  await db.$transaction([
    db.webAuthnCredential.update({
      where: { id: credential.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: now,
        deviceType: verification.authenticationInfo.credentialDeviceType,
        backedUp: verification.authenticationInfo.credentialBackedUp,
      },
    }),
    db.user.update({
      where: { id: credential.userId },
      data: { lastLoginAt: now },
    }),
  ])

  const ua = req.headers.get('user-agent') ?? undefined
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
  const token = await createSession(credential.userId, ua, ip)
  setSessionCookie(token)
  clearWebAuthnCookie(WEBAUTHN_AUTH_CHALLENGE_COOKIE)
  clearWebAuthnCookie(WEBAUTHN_AUTH_USER_COOKIE)

  const safeUser = {
    id: credential.user.id,
    email: credential.user.email,
    displayName: credential.user.displayName,
    username: credential.user.username ?? null,
    role: credential.user.role,
    avatarUrl: credential.user.profile?.avatarUrl ?? null,
    profile: credential.user.profile
      ? {
          username: credential.user.profile.username ?? null,
          bio: credential.user.profile.bio ?? null,
          city: credential.user.profile.city ?? null,
          company: credential.user.profile.company ?? null,
          websiteUrl: credential.user.profile.websiteUrl ?? null,
        }
      : null,
  }

  return NextResponse.json({ user: safeUser })
}
