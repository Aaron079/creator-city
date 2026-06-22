import { NextRequest, NextResponse } from 'next/server'
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { db } from '@/lib/db'
import {
  getWebAuthnRpId,
  setWebAuthnCookie,
  WEBAUTHN_AUTH_CHALLENGE_COOKIE,
  WEBAUTHN_AUTH_USER_COOKIE,
} from '@/lib/auth/webauthn'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json() as { email?: string }
  const email = body.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ message: '请输入邮箱后再使用 Passkey 登录。' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      status: true,
      webauthnCredentials: {
        select: { credentialId: true, transports: true },
      },
    },
  })

  if (!user || user.status !== 'ACTIVE' || user.webauthnCredentials.length === 0) {
    return NextResponse.json({
      message: '这个账号还没有绑定可用的 Passkey，请先使用密码登录后到账号设置中绑定。',
      errorCode: 'PASSKEY_NOT_AVAILABLE',
    }, { status: 404 })
  }

  const options = await generateAuthenticationOptions({
    rpID: getWebAuthnRpId(req),
    timeout: 60_000,
    userVerification: 'required',
    allowCredentials: user.webauthnCredentials.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports as AuthenticatorTransportFuture[],
    })),
  })

  setWebAuthnCookie(WEBAUTHN_AUTH_CHALLENGE_COOKIE, options.challenge)
  setWebAuthnCookie(WEBAUTHN_AUTH_USER_COOKIE, user.id)
  return NextResponse.json(options)
}
