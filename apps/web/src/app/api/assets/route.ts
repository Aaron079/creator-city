import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import {
  PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE,
  isProjectCanvasSchemaMissing,
  projectJsonError,
} from '@/lib/projects/api-errors'
import { serializeAsset } from '@/lib/projects/canvas-mappers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId') ?? undefined

  try {
    const assets = await db.asset.findMany({
      where: {
        ownerId: user.id,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({ assets: assets.map(serializeAsset) })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return projectJsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    console.error('[assets] failed to list assets', error)
    return NextResponse.json({ message: '加载资产失败。' }, { status: 500 })
  }
}
