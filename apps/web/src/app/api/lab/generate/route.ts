import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ensureActiveProject } from '@/lib/projects/ensure-active-project'
import { getExecutorForProvider } from '@/lib/executors/executor-gateway'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

type LabGenerateBody = {
  prompt?: string
  providerId?: string
  aspectRatio?: string
  type?: 'image' | 'video'
}

function extractMissingColumn(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.match(/The column `([^`]+)` does not exist/)?.[1] ??
    msg.match(/Unknown arg `([^`]+)`/)?.[1] ??
    null
  )
}

async function createLabJob(args: {
  userId: string
  providerId: string
  type: string
  prompt: string
  projectId: string
  workflowId: string
  nodeId: string
  aspectRatio: string
  providerRegion: string
  executionRegion: string
  storageRegion: string
  executorKind: string
}) {
  const skip = new Set<string>()
  for (let attempt = 0; attempt < 8; attempt++) {
    const data = {
      userId: args.userId,
      providerId: args.providerId,
      nodeType: args.type,
      status: 'QUEUED' as const,
      prompt: args.prompt.slice(0, 2000),
      ...(skip.has('kind') ? {} : { kind: args.type }),
      ...(skip.has('provider') ? {} : { provider: args.providerId }),
      ...(skip.has('projectId') ? {} : { projectId: args.projectId }),
      ...(skip.has('nodeId') ? {} : { nodeId: args.nodeId }),
      ...(skip.has('input') ? {} : {
        input: {
          prompt: args.prompt,
          providerId: args.providerId,
          projectId: args.projectId,
          workflowId: args.workflowId,
          nodeId: args.nodeId,
          aspectRatio: args.aspectRatio,
          providerRegion: args.providerRegion,
          executionRegion: args.executionRegion,
          storageRegion: args.storageRegion,
          executorKind: args.executorKind,
          labMode: true,
        },
      }),
    }
    try {
      return await db.generationJob.create({ data })
    } catch (err) {
      const col = extractMissingColumn(err)
      if (!col || skip.has(col)) throw err
      skip.add(col)
    }
  }
  throw new Error('createLabJob: too many missing columns')
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, errorCode: 'UNAUTHORIZED', message: '请先登录。' }, { status: 401 })
  }

  const imageProviders = [
    { providerId: 'volcengine-seedream-image', label: '火山 Seedream 图片', type: 'image' },
  ]
  const videoProviders = [
    { providerId: 'volcengine-seedance-video', label: '火山 Seedance 视频', type: 'video' },
  ]

  const cnBase = process.env.CREATOR_CN_API_BASE_URL?.trim() ?? ''
  const cnSecret = process.env.CREATOR_EXECUTOR_SHARED_SECRET?.trim() ?? ''

  return NextResponse.json({
    success: true,
    providers: [...imageProviders, ...videoProviders],
    env: {
      cnExecutorConfigured: Boolean(cnBase),
      cnSecretConfigured: Boolean(cnSecret),
      ossBucket: process.env.ALIYUN_OSS_BUCKET ?? null,
      ossRegion: process.env.ALIYUN_OSS_REGION ?? null,
      seedreamModel: process.env.VOLCENGINE_SEEDREAM_MODEL ? '(set)' : null,
    },
  })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, errorCode: 'UNAUTHORIZED', message: '请先登录。' }, { status: 401 })
  }

  let body: LabGenerateBody
  try {
    body = await request.json() as LabGenerateBody
  } catch {
    return NextResponse.json({ success: false, errorCode: 'INVALID_INPUT', message: 'Invalid JSON' }, { status: 400 })
  }

  const prompt = body.prompt?.trim() ?? ''
  const providerId = body.providerId?.trim() || 'volcengine-seedream-image'
  const aspectRatio = body.aspectRatio?.trim() || '16:9'
  const type = body.type === 'video' ? 'video' : 'image'

  if (!prompt) {
    return NextResponse.json({ success: false, errorCode: 'PROMPT_REQUIRED', message: 'prompt 不能为空。' }, { status: 400 })
  }

  // Ensure a project + workflow exists for this user
  let activeProject: Awaited<ReturnType<typeof ensureActiveProject>>
  try {
    activeProject = await ensureActiveProject(user)
  } catch (err) {
    return NextResponse.json({
      success: false,
      errorCode: 'project_ensure_failed',
      message: err instanceof Error ? err.message : '确保项目失败。',
    }, { status: 200 })
  }

  const projectId = activeProject.project.id
  const workflowId = activeProject.workflow.id
  const nodeId = `lab-${crypto.randomBytes(4).toString('hex')}`

  const exec = getExecutorForProvider(providerId)
  const { providerRegion, executionRegion, storageRegion, executor: resolvedExecutor, executorKind } = exec

  const cnBaseUrl = process.env.CREATOR_CN_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
  const cnSecret = process.env.CREATOR_EXECUTOR_SHARED_SECRET ?? ''

  if (providerRegion === 'cn' && !cnBaseUrl) {
    return NextResponse.json({
      success: false,
      errorCode: 'cn_executor_url_not_configured',
      message: 'CN provider 需要 CREATOR_CN_API_BASE_URL，但该环境变量未设置。',
      providerId,
      providerRegion,
      executionRegion,
      storageRegion,
      executor: resolvedExecutor,
      executorKind,
    }, { status: 200 })
  }

  // Create GenerationJob
  let generationJobId: string
  try {
    const job = await createLabJob({
      userId: user.id,
      providerId,
      type,
      prompt,
      projectId,
      workflowId,
      nodeId,
      aspectRatio,
      providerRegion,
      executionRegion,
      storageRegion,
      executorKind,
    })
    generationJobId = job.id
  } catch (err) {
    return NextResponse.json({
      success: false,
      errorCode: 'job_create_failed',
      message: err instanceof Error ? err.message : '创建生成任务失败。',
      providerId,
      providerRegion,
    }, { status: 200 })
  }

  if (!cnBaseUrl) {
    return NextResponse.json({
      success: false,
      errorCode: 'cn_executor_url_not_configured',
      message: 'CREATOR_CN_API_BASE_URL 未配置，无法调用 cn-executor。',
      generationJobId,
      providerId,
      providerRegion,
      executionRegion,
      storageRegion,
      executor: resolvedExecutor,
      executorKind,
      projectId,
      workflowId,
      nodeId,
    }, { status: 200 })
  }

  // Call cn-executor
  const executorEndpoint = type === 'video' ? '/api/jobs/run-video' : '/api/jobs/run-image'
  let cnResult: Record<string, unknown> | null = null
  let cnHttpStatus: number | null = null

  try {
    const cnResp = await fetch(`${cnBaseUrl}${executorEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cnSecret}`,
        'x-creator-executor-secret': cnSecret,
      },
      body: JSON.stringify({ generationJobId }),
      signal: AbortSignal.timeout(88_000),
    })
    cnHttpStatus = cnResp.status
    const rawText = await cnResp.text()

    if (cnResp.status === 401) {
      cnResult = {
        status: 'failed',
        errorCode: 'cn_executor_auth_rejected',
        errorStage: 'cn_executor_auth',
        message: 'cn-executor 返回 401：CREATOR_EXECUTOR_SHARED_SECRET 不匹配。',
      }
    } else {
      try {
        const parsed = JSON.parse(rawText)
        cnResult = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed as Record<string, unknown>
          : { status: 'failed', errorCode: 'cn_executor_parse_error', raw: rawText.slice(0, 500) }
      } catch {
        cnResult = { status: 'failed', errorCode: 'cn_executor_non_json', errorStage: 'cn_executor_response', raw: rawText.slice(0, 500) }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    cnResult = {
      status: 'failed',
      errorCode: msg.toLowerCase().includes('timeout') || msg.includes('AbortError') ? 'cn_executor_timeout' : 'cn_executor_network_error',
      errorStage: 'cn_executor_network',
      message: `cn-executor 网络错误：${msg}`,
    }
  }

  const succeeded = cnResult?.status === 'succeeded'
  return NextResponse.json({
    success: succeeded,
    status: cnResult?.status ?? 'failed',
    generationJobId,
    providerId,
    providerRegion,
    executionRegion,
    storageRegion,
    executor: resolvedExecutor,
    executorKind,
    cnExecutorHttpStatus: cnHttpStatus,
    projectId,
    workflowId,
    nodeId,
    // Result fields
    resultImageUrl: cnResult?.resultImageUrl ?? null,
    resultVideoUrl: cnResult?.resultVideoUrl ?? null,
    stableUrl: cnResult?.stableUrl ?? null,
    assetId: cnResult?.assetId ?? null,
    // Debug fields
    errorCode: cnResult?.errorCode ?? null,
    errorStage: cnResult?.errorStage ?? null,
    stageTrace: cnResult?.stageTrace ?? null,
    message: cnResult?.message ?? null,
    upstreamMessage: cnResult?.upstreamMessage ?? null,
    upstreamStatus: cnResult?.upstreamStatus ?? null,
    cnExecutorResult: cnResult,
  }, { status: 200 })
}
