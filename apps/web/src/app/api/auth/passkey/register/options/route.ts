import { NextRequest, NextResponse } from 'next/server'
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  getWebAuthnRpId,
  getWebAuthnRpName,
  setWebAuthnCookie,
  WEBAUTHN_REGISTER_CHALLENGE_COOKIE,
} from '@/lib/auth/webauthn'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ message: '请先登录后再绑定设备 Passkey。' }, { status: 401 })
  }

  const credentials = await db.webAuthnCredential.findMany({
    where: { userId: user.id },
    select: { credentialId: true, transports: true },
  })

  const options = await generateRegistrationOptions({
    rpName: getWebAuthnRpName(),
    rpID: getWebAuthnRpId(req),
    userID: Buffer.from(user.id),
    userName: user.email,
    userDisplayName: user.displayName,
    timeout: 60_000,
    attestationType: 'none',
    excludeCredentials: credentials.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
    preferredAuthenticatorType: 'localDevice',
  })

  setWebAuthnCookie(WEBAUTHN_REGISTER_CHALLENGE_COOKIE, options.challenge)
  return NextResponse.json(options)
}
