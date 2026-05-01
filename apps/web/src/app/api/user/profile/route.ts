import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: '请先登录。' }, { status: 401 })

  const profile = await db.userProfile.findUnique({ where: { userId: user.id } })
  return NextResponse.json({ profile })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: '请先登录。' }, { status: 401 })

  const body = await req.json() as {
    displayName?: string
    username?: string
    bio?: string
    city?: string
    company?: string
    websiteUrl?: string
    avatarUrl?: string
  }

  const userUpdates: Record<string, string> = {}
  if (body.displayName && body.displayName.trim().length >= 2) {
    userUpdates['displayName'] = body.displayName.trim()
  }

  if (Object.keys(userUpdates).length > 0) {
    await db.user.update({ where: { id: user.id }, data: userUpdates })
  }

  // Check username uniqueness if changing
  if (body.username !== undefined) {
    const uname = body.username.trim() || null
    if (uname) {
      const conflict = await db.userProfile.findFirst({
        where: { username: uname, NOT: { userId: user.id } },
      })
      if (conflict) {
        return NextResponse.json({ message: '该用户名已被使用。' }, { status: 409 })
      }
    }
  }

  const profileData: Record<string, string | null> = {}
  if (body.username !== undefined) profileData['username'] = body.username.trim() || null
  if (body.bio !== undefined) profileData['bio'] = body.bio.trim() || null
  if (body.city !== undefined) profileData['city'] = body.city.trim() || null
  if (body.company !== undefined) profileData['company'] = body.company.trim() || null
  if (body.websiteUrl !== undefined) profileData['websiteUrl'] = body.websiteUrl.trim() || null
  if (body.avatarUrl !== undefined) profileData['avatarUrl'] = body.avatarUrl.trim() || null

  const profile = await db.userProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...profileData },
    update: profileData,
  })

  return NextResponse.json({ profile })
}
