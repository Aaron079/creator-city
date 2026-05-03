import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { setSessionCookie } from '@/lib/auth/cookies'
import { isAdminEmail } from '@/lib/auth/current-user'

function sanitizeUser(user: {
  id: string
  email: string
  displayName: string
  username: string | null
  role: string
  status: string
  profile: { avatarUrl: string | null; username: string | null; bio: string | null; city: string | null; company: string | null; websiteUrl: string | null } | null
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    role: user.role,
    avatarUrl: user.profile?.avatarUrl ?? null,
    profile: user.profile
      ? {
          username: user.profile.username ?? null,
          bio: user.profile.bio ?? null,
          city: user.profile.city ?? null,
          company: user.profile.company ?? null,
          websiteUrl: user.profile.websiteUrl ?? null,
        }
      : null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string; password?: string; displayName?: string }
    const { email: rawEmail, password, displayName } = body

    if (!rawEmail || !password || !displayName) {
      return NextResponse.json({ message: '邮箱、密码和显示名称不能为空。' }, { status: 400 })
    }

    const email = rawEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: '邮箱格式不正确。' }, { status: 400 })
    }

    const pwError = validatePasswordStrength(password)
    if (pwError) return NextResponse.json({ message: pwError }, { status: 400 })

    if (displayName.trim().length < 2) {
      return NextResponse.json({ message: '显示名称至少 2 个字符。' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ message: '该邮箱已注册。' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const role = isAdminEmail(email) ? ('ADMIN' as const) : ('CREATOR' as const)

    const user = await db.user.create({
      data: {
        email,
        displayName: displayName.trim(),
        passwordHash,
        role,
        profile: { create: {} },
      },
      include: { profile: true },
    })

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    const ua = req.headers.get('user-agent') ?? undefined
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
    const token = await createSession(user.id, ua, ip)
    setSessionCookie(token)

    return NextResponse.json({ user: sanitizeUser(user) }, { status: 201 })
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN'
    const meta = (err as { meta?: unknown })?.meta
    // Log full error server-side (visible in Vercel logs), never sent to client
    console.error('[register] error code:', code, 'meta:', JSON.stringify(meta))
    console.error('[register] full error:', err)

    // Map Prisma codes to safe client messages
    if (code === 'P1012') {
      return NextResponse.json({ message: '数据库配置缺失，请联系管理员。', errorCode: 'DB_CONFIG_MISSING' }, { status: 500 })
    }
    if (code === 'P1000') {
      return NextResponse.json({ message: '数据库认证失败，请联系管理员。', errorCode: 'DB_AUTH_FAILED' }, { status: 500 })
    }
    if (code === 'P1001' || code === 'P1002') {
      return NextResponse.json({ message: '无法连接数据库，请稍后重试。', errorCode: 'DB_UNREACHABLE' }, { status: 500 })
    }
    if (code === 'P2021' || code === 'P2022') {
      return NextResponse.json({ message: '数据库表结构未初始化，请联系管理员。', errorCode: 'DB_SCHEMA_MISSING' }, { status: 500 })
    }
    if (code === 'P2002') {
      return NextResponse.json({ message: '该邮箱已注册。', errorCode: 'EMAIL_EXISTS' }, { status: 409 })
    }
    return NextResponse.json({ message: '注册失败，请稍后重试。', errorCode: code }, { status: 500 })
  }
}
