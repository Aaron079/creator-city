import crypto from 'crypto'
import { db } from '@/lib/db'

const SESSION_DAYS = parseInt(process.env.AUTH_SESSION_DAYS ?? '30', 10)

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function createSession(
  userId: string,
  userAgent?: string,
  ip?: string,
): Promise<string> {
  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex') : undefined

  await db.session.create({
    data: { userId, tokenHash, expiresAt, userAgent, ipHash },
  })

  return token
}

export async function getSession(token: string) {
  const tokenHash = hashToken(token)
  let session
  try {
    session = await db.session.findUnique({
      where: { tokenHash },
      include: { user: { include: { profile: true } } },
    })
  } catch (err) {
    console.warn('[auth/session] db.session.findUnique failed — retrying (1/2)', err)
    await new Promise((resolve) => setTimeout(resolve, 50))
    try {
      session = await db.session.findUnique({
        where: { tokenHash },
        include: { user: { include: { profile: true } } },
      })
    } catch (err2) {
      console.warn('[auth/session] retry 1 failed — retrying (2/2)', err2)
      await new Promise((resolve) => setTimeout(resolve, 100))
      try {
        session = await db.session.findUnique({
          where: { tokenHash },
          include: { user: { include: { profile: true } } },
        })
      } catch (retryErr) {
        console.error('[auth/session] all retries failed — session DB unavailable', retryErr)
        throw Object.assign(new Error('Session DB temporarily unavailable'), { code: 'SESSION_DB_UNAVAILABLE', cause: retryErr })
      }
    }
  }
  if (!session) return null
  if (session.expiresAt < new Date()) {
    db.session.delete({ where: { tokenHash } }).catch((err) => {
      console.error('[auth/session] failed to delete expired session', err)
    })
    return null
  }
  // Sliding expiry: extend expiresAt from now so active users stay logged in.
  // Also refresh lastUsedAt. Both are best-effort — never block or throw.
  const newExpiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  db.session.update({ where: { tokenHash }, data: { lastUsedAt: new Date(), expiresAt: newExpiresAt } }).catch((err) => {
    console.error('[auth/session] failed to refresh session expiry', err)
  })
  return session
}

export async function deleteSession(token: string): Promise<void> {
  const tokenHash = hashToken(token)
  await db.session.deleteMany({ where: { tokenHash } })
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } })
}
