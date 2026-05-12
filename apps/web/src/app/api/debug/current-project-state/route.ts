import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function assetIdFromMetadata(metadataJson: unknown) {
  const metadata = recordValue(metadataJson)
  const asset = recordValue(metadata.asset)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  const generationJob = recordValue(metadata.generationJob)
  const generationResult = recordValue(metadata.generationResult)
  const pluginResult = recordValue(metadata.pluginResult)
  return [
    metadata.assetId,
    asset.id,
    metadata.asset_id,
    metadata.mediaAssetId,
    metadata.resultAssetId,
    metadata.result_asset_id,
    metadata.media_asset_id,
    metadata.outputAssetId,
    generationJob.outputAssetId,
    generationResult.outputAssetId,
    pluginResult.outputAssetId,
    mediaPersistence.assetId,
    mediaPersistence.outputAssetId,
  ].find((value): value is string => typeof value === 'string' && Boolean(value.trim()))?.trim() ?? ''
}

function projectVisibilityWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [
      { ownerId: userId },
      { members: { some: { userId, isActive: true, leftAt: null } } },
    ],
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: '请先登录。',
    }, { status: 401 })
  }

  const requestedProjectId = request.nextUrl.searchParams.get('projectId')?.trim() || ''
  const visibleProjects = await db.project.findMany({
    where: projectVisibilityWhere(user.id),
    orderBy: [{ lastOpenedAt: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      ownerId: true,
      title: true,
      lastOpenedAt: true,
      updatedAt: true,
      members: {
        where: { userId: user.id, isActive: true, leftAt: null },
        select: { id: true, roleId: true, isActive: true, joinedAt: true },
        take: 1,
      },
    },
  })
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id))
  const currentProjectId = requestedProjectId && visibleProjectIds.has(requestedProjectId)
    ? requestedProjectId
    : visibleProjects[0]?.id ?? requestedProjectId

  const inaccessibleRequestedProject = Boolean(requestedProjectId && !visibleProjectIds.has(requestedProjectId))
  if (!currentProjectId || inaccessibleRequestedProject) {
    return NextResponse.json({
      success: true,
      currentUser: {
        id: user.id,
        email: user.email,
      },
      visibleProjects: {
        count: visibleProjects.length,
      },
      currentProjectId: currentProjectId || null,
      currentProject: null,
      canvasNodes: { count: 0, image: 0, video: 0 },
      assets: { forProject: 0, withCanvasNodeId: 0 },
      generationJobs: { forProject: 0 },
      orphanNodes: { count: 0 },
      orphanAssets: { count: 0 },
      whyCurrentProjectNotInDirectory: inaccessibleRequestedProject
        ? 'current_project_not_visible_for_user: no ownerId or active ProjectMember match for currentUser.id'
        : 'no_visible_projects_for_user',
    })
  }

  const currentProject = visibleProjects.find((project) => project.id === currentProjectId) ?? null
  if (!currentProject) {
    return NextResponse.json({
      success: true,
      currentUser: {
        id: user.id,
        email: user.email,
      },
      visibleProjects: {
        count: visibleProjects.length,
      },
      currentProjectId,
      currentProject: null,
      canvasNodes: { count: 0, image: 0, video: 0 },
      assets: { forProject: 0, withCanvasNodeId: 0 },
      generationJobs: { forProject: 0 },
      orphanNodes: { count: 0 },
      orphanAssets: { count: 0 },
      whyCurrentProjectNotInDirectory: 'current_project_not_visible_for_user',
    })
  }

  const workflows = await db.canvasWorkflow.findMany({
    where: { projectId: currentProjectId },
    select: { id: true },
  })
  const workflowIds = workflows.map((workflow) => workflow.id)
  const nodes = workflowIds.length
    ? await db.canvasNode.findMany({
        where: { workflowId: { in: workflowIds } },
        select: { nodeId: true, kind: true, metadataJson: true },
      })
    : []
  const mediaNodes = nodes.filter((node) => node.kind === 'image' || node.kind === 'video')
  const visibleAssetWhere: Prisma.AssetWhereInput = {
    projectId: currentProjectId,
    OR: [
      { ownerId: user.id },
      { project: projectVisibilityWhere(user.id) },
    ],
  }
  const assetNodeIds = new Set(
    (await db.asset.findMany({
      where: {
        ...visibleAssetWhere,
        nodeId: { not: null },
      },
      select: { nodeId: true },
    })).map((asset) => stringValue(asset.nodeId)),
  )
  const orphanNodes = mediaNodes.filter((node) => !assetIdFromMetadata(node.metadataJson) && !assetNodeIds.has(node.nodeId))

  const [assetsForProjectCount, assetsWithCanvasNodeIdCount, generationJobsForProjectCount, orphanAssetsCount] = await Promise.all([
    db.asset.count({ where: visibleAssetWhere }),
    db.asset.count({
      where: {
        ...visibleAssetWhere,
        nodeId: { not: null },
      },
    }),
    db.generationJob.count({
      where: {
        userId: user.id,
        projectId: currentProjectId,
      },
    }),
    db.asset.count({
      where: {
        ownerId: user.id,
        projectId: currentProjectId,
        nodeId: null,
      },
    }),
  ])

  const member = currentProject.members[0] ?? null
  const memberStatus = currentProject.ownerId === user.id
    ? 'owner'
    : member
      ? `member:${member.roleId ?? 'MEMBER'}`
      : 'none'

  return NextResponse.json({
    success: true,
    currentUser: {
      id: user.id,
      email: user.email,
    },
    visibleProjects: {
      count: visibleProjects.length,
    },
    currentProjectId,
    currentProject: {
      ownerId: currentProject.ownerId,
      memberStatus,
      title: currentProject.title,
    },
    canvasNodes: {
      count: nodes.length,
      image: nodes.filter((node) => node.kind === 'image').length,
      video: nodes.filter((node) => node.kind === 'video').length,
    },
    assets: {
      forProject: assetsForProjectCount,
      withCanvasNodeId: assetsWithCanvasNodeIdCount,
    },
    generationJobs: {
      forProject: generationJobsForProjectCount,
    },
    orphanNodes: {
      count: orphanNodes.length,
    },
    orphanAssets: {
      count: orphanAssetsCount,
    },
    whyCurrentProjectNotInDirectory: memberStatus === 'none'
      ? 'current_project_not_visible_for_user: no ownerId or active ProjectMember match for currentUser.id'
      : null,
  })
}
