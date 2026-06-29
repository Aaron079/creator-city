import { isDbConnectionError } from '@/lib/db-error'

const DEFAULT_PROJECT_CHECK_RETRY_DELAYS_MS = [150, 500, 1000]

type ProjectOwnerLookup = (projectId: string) => Promise<{ ownerId: string } | null>

export type UploadProjectAccessResult =
  | { ok: true; attempts: number }
  | {
      ok: false
      errorCode: 'PROJECT_REQUIRED' | 'PROJECT_NOT_FOUND' | 'FORBIDDEN' | 'PROJECT_CHECK_UNAVAILABLE' | 'PROJECT_CHECK_FAILED'
      message: string
      status: number
      attempts: number
      cause?: unknown
    }

export async function verifyUploadProjectAccess(args: {
  projectId: string | null
  userId: string
  required: boolean
  lookupProjectOwnerId: ProjectOwnerLookup
  retryDelaysMs?: number[]
}): Promise<UploadProjectAccessResult> {
  const projectId = args.projectId?.trim() || null
  if (!projectId) {
    if (!args.required) return { ok: true, attempts: 0 }
    return {
      ok: false,
      errorCode: 'PROJECT_REQUIRED',
      message: '请先保存项目后再上传裁切资产。',
      status: 400,
      attempts: 0,
    }
  }

  const retryDelaysMs = args.retryDelaysMs ?? DEFAULT_PROJECT_CHECK_RETRY_DELAYS_MS
  for (let retryIndex = 0; retryIndex <= retryDelaysMs.length; retryIndex += 1) {
    const attempts = retryIndex + 1
    try {
      const project = await args.lookupProjectOwnerId(projectId)
      if (!project) {
        return {
          ok: false,
          errorCode: 'PROJECT_NOT_FOUND',
          message: '项目不存在。',
          status: 404,
          attempts,
        }
      }
      if (project.ownerId !== args.userId) {
        return {
          ok: false,
          errorCode: 'FORBIDDEN',
          message: '无权访问该项目。',
          status: 403,
          attempts,
        }
      }
      return { ok: true, attempts }
    } catch (cause) {
      const isTransientDbError = isDbConnectionError(cause)
      const retryDelayMs = retryDelaysMs[retryIndex]
      if (isTransientDbError && retryDelayMs !== undefined) {
        if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
        continue
      }
      return {
        ok: false,
        errorCode: isTransientDbError ? 'PROJECT_CHECK_UNAVAILABLE' : 'PROJECT_CHECK_FAILED',
        message: isTransientDbError ? '项目验证服务繁忙，请稍后重试。' : '项目验证失败，请重试。',
        status: isTransientDbError ? 503 : 500,
        attempts,
        cause,
      }
    }
  }

  return {
    ok: false,
    errorCode: 'PROJECT_CHECK_FAILED',
    message: '项目验证失败，请重试。',
    status: 500,
    attempts: retryDelaysMs.length + 1,
  }
}
