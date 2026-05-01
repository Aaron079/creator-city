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
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: { include: { profile: true } } },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { tokenHash } })
    return null
  }
  // Refresh lastUsedAt
  await db.session.update({ where: { tokenHash }, data: { lastUsedAt: new Date() } })
  return session
}

export async function deleteSession(token: string): Promise<void> {
  const tokenHash = hashToken(token)
  await db.session.deleteMany({ where: { tokenHash } })
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } })
}
