import { NextRequest, NextResponse } from 'next/server'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  clearWebAuthnCookie,
  getWebAuthnCookie,
  getWebAuthnOrigin,
  getWebAuthnRpId,
  toStoredTransports,
  WEBAUTHN_REGISTER_CHALLENGE_COOKIE,
} from '@/lib/auth/webauthn'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ message: '请先登录后再绑定设备 Passkey。' }, { status: 401 })
  }

  const expectedChallenge = getWebAuthnCookie(WEBAUTHN_REGISTER_CHALLENGE_COOKIE)
  if (!expectedChallenge) {
    return NextResponse.json({ message: 'Passkey 绑定已超时，请重新开始。' }, { status: 400 })
  }

  const body = await req.json() as {
    response?: RegistrationResponseJSON
    name?: string
  }
  if (!body.response) {
    return NextResponse.json({ message: '缺少 Passkey 绑定响应。' }, { status: 400 })
  }

  const verification = await verifyRegistrationResponse({
    response: body.response,
    expectedChallenge,
    expectedOrigin: getWebAuthnOrigin(req),
    expectedRPID: getWebAuthnRpId(req),
    requireUserVerification: true,
  })

  if (!verification.verified) {
    return NextResponse.json({ message: 'Passkey 绑定验证失败。' }, { status: 400 })
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
  const displayName = body.name?.trim().slice(0, 80) || 'This device'

  const existing = await db.webAuthnCredential.findUnique({
    where: { credentialId: credential.id },
    select: { id: true, userId: true },
  })
  if (existing && existing.userId !== user.id) {
    return NextResponse.json({ message: '这个 Passkey 已绑定到其他账号。' }, { status: 409 })
  }

  const credentialData = {
    publicKey: Buffer.from(credential.publicKey),
    counter: BigInt(credential.counter),
    transports: toStoredTransports(credential.transports ?? body.response.response.transports),
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    name: displayName,
  }

  const saved = existing
    ? await db.webAuthnCredential.update({
      where: { id: existing.id },
      data: credentialData,
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
        deviceType: true,
        backedUp: true,
      },
    })
    : await db.webAuthnCredential.create({
      data: {
      userId: user.id,
      credentialId: credential.id,
      ...credentialData,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
        deviceType: true,
        backedUp: true,
      },
    })

  clearWebAuthnCookie(WEBAUTHN_REGISTER_CHALLENGE_COOKIE)
  return NextResponse.json({ success: true, credential: saved })
}
