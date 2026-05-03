import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { setSessionCookie } from '@/lib/auth/cookies'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string; password?: string }
    const { email: rawEmail, password } = body

    if (!rawEmail || !password) {
      return NextResponse.json({ message: '邮箱和密码不能为空。' }, { status: 400 })
    }

    const email = rawEmail.trim().toLowerCase()
    const user = await db.user.findUnique({
      where: { email },
      include: { profile: true },
    })

    // Constant-time-safe: always run verifyPassword even if user not found
    const dummyHash = '$2a$12$DUMMY_HASH_TO_PREVENT_TIMING_ATTACK_XXXXXXXXXXXXXXXXXX'
    const passwordOk = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, dummyHash).then(() => false)

    if (!user || !passwordOk) {
      return NextResponse.json({ message: '邮箱或密码错误。' }, { status: 401 })
    }

    if (user.status === 'BANNED') {
      return NextResponse.json({ message: '账号已被封禁，请联系支持。' }, { status: 403 })
    }
    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ message: '账号状态异常，请联系支持。' }, { status: 403 })
    }

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    const ua = req.headers.get('user-agent') ?? undefined
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
    const token = await createSession(user.id, ua, ip)
    setSessionCookie(token)

    const safeUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      username: user.username ?? null,
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

    return NextResponse.json({ user: safeUser })
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN'
    const meta = (err as { meta?: unknown })?.meta
    console.error('[login] error code:', code, 'meta:', JSON.stringify(meta))
    console.error('[login] full error:', err)

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
    return NextResponse.json({ message: '登录失败，请稍后重试。', errorCode: code }, { status: 500 })
  }
}
