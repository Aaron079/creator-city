import type { IncomingMessage, ServerResponse } from 'http'
import { isAuthorized } from '../auth'
import { writeTaskStateJson, readTaskStateJson } from '../oss'
import { jsonError, jsonOk, jsonResponse, jsonUnauthorized } from '../response'
import {
  executeImageGeneration,
  parseImageExecutionRequest,
  type ImageExecutionResult,
} from './generateImage'

type ImageTaskRecord = {
  taskId: string
  status: 'running' | 'succeeded' | 'failed'
  startedAt: string
  updatedAt: string
  result?: ImageExecutionResult
  error?: ImageExecutionResult
}

const imageTasks = new Map<string, ImageTaskRecord>()
const TASK_TTL_MS = 1000 * 60 * 60 * 6

function randomHex(n: number): string {
  return [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
}

function makeTaskId(): string {
  return `img_${Date.now()}_${randomHex(10)}`
}

function pruneImageTasks(): void {
  const cutoff = Date.now() - TASK_TTL_MS
  for (const [taskId, task] of imageTasks.entries()) {
    if (Date.parse(task.updatedAt) < cutoff) imageTasks.delete(taskId)
  }
}

export async function handleStartImageGeneration(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    jsonUnauthorized(res)
    return
  }

  const input = await parseImageExecutionRequest(req)
  if ('errorCode' in input) {
    jsonError(res, input, input.errorCode === 'invalid_request' ? 400 : 200)
    return
  }

  pruneImageTasks()
  const taskId = makeTaskId()
  const now = new Date().toISOString()
  imageTasks.set(taskId, { taskId, status: 'running', startedAt: now, updatedAt: now })

  let result: ImageExecutionResult
  try {
    result = await executeImageGeneration(input)
  } catch (err) {
    result = {
      success: false,
      errorCode: 'cn_executor_image_task_failed',
      message: err instanceof Error ? err.message : 'Unexpected image task failure.',
      provider: 'volcengine_seedream',
    }
  }

  const updatedAt = new Date().toISOString()
  if (result.success) {
    imageTasks.set(taskId, { taskId, status: 'succeeded', startedAt: now, updatedAt, result })
  } else {
    imageTasks.set(taskId, { taskId, status: 'failed', startedAt: now, updatedAt, error: result })
  }

  await writeTaskStateJson(taskId, {
    taskId,
    status: result.success ? 'succeeded' : 'failed',
    startedAt: now,
    updatedAt,
    ...(result.success ? { result } : { error: result }),
  })

  if (result.success) {
    jsonOk(res, {
      ...result,
      status: 'succeeded',
      taskId,
      startedAt: now,
      updatedAt,
    })
  } else {
    jsonOk(res, {
      ...result,
      status: 'failed',
      taskId,
      startedAt: now,
      updatedAt,
    })
  }
}

export async function handleImageGenerationStatus(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    jsonUnauthorized(res)
    return
  }

  pruneImageTasks()
  const requestUrl = new URL(req.url ?? '/', 'http://localhost')
  const taskId = requestUrl.searchParams.get('taskId')?.trim() ?? ''
  if (!taskId) {
    jsonError(res, { errorCode: 'task_id_required', message: 'taskId is required.' }, 400)
    return
  }

  let task = imageTasks.get(taskId)

  if (!task) {
    const persisted = await readTaskStateJson(taskId)
    if (persisted) {
      task = {
        taskId: String(persisted.taskId ?? taskId),
        status: (persisted.status as ImageTaskRecord['status']) ?? 'failed',
        startedAt: String(persisted.startedAt ?? ''),
        updatedAt: String(persisted.updatedAt ?? ''),
        result: persisted.result as ImageExecutionResult | undefined,
        error: persisted.error as ImageExecutionResult | undefined,
      }
      imageTasks.set(taskId, task)
    }
  }

  if (!task) {
    jsonResponse(res, {
      success: false,
      status: 'failed',
      taskId,
      errorCode: 'cn_executor_task_not_found',
      message: 'Image task not found in this cn-executor instance or OSS state.',
    }, 404)
    return
  }

  if (task.status === 'running') {
    jsonOk(res, {
      success: true,
      status: 'running',
      taskId,
      startedAt: task.startedAt,
      updatedAt: task.updatedAt,
    })
    return
  }

  if (task.status === 'succeeded' && task.result) {
    jsonOk(res, {
      ...task.result,
      status: 'succeeded',
      taskId,
      startedAt: task.startedAt,
      updatedAt: task.updatedAt,
    })
    return
  }

  const error = task.error ?? {
    success: false,
    errorCode: 'cn_executor_image_task_failed',
    message: 'Image task failed.',
    provider: 'volcengine_seedream',
  }
  jsonOk(res, {
    ...error,
    success: false,
    status: 'failed',
    taskId,
    startedAt: task.startedAt,
    updatedAt: task.updatedAt,
  })
}
