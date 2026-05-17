import type { IncomingMessage, ServerResponse } from 'http'
import { isAuthorized } from '../auth'
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

function updateTask(taskId: string, patch: Partial<ImageTaskRecord>): void {
  const previous = imageTasks.get(taskId)
  if (!previous) return
  imageTasks.set(taskId, {
    ...previous,
    ...patch,
    taskId,
    updatedAt: new Date().toISOString(),
  })
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
  imageTasks.set(taskId, {
    taskId,
    status: 'running',
    startedAt: now,
    updatedAt: now,
  })

  void executeImageGeneration(input)
    .then((result) => {
      if (result.success) {
        updateTask(taskId, { status: 'succeeded', result })
      } else {
        updateTask(taskId, { status: 'failed', error: result })
      }
    })
    .catch((error: unknown) => {
      updateTask(taskId, {
        status: 'failed',
        error: {
          success: false,
          errorCode: 'cn_executor_image_task_failed',
          message: error instanceof Error ? error.message : 'Unexpected image task failure.',
          provider: 'volcengine_seedream',
        },
      })
    })

  jsonOk(res, {
    success: true,
    status: 'running',
    taskId,
    message: 'Image generation submitted to cn executor',
  })
}

export function handleImageGenerationStatus(req: IncomingMessage, res: ServerResponse): void {
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

  const task = imageTasks.get(taskId)
  if (!task) {
    jsonResponse(res, {
      success: false,
      status: 'failed',
      taskId,
      errorCode: 'cn_executor_task_not_found',
      message: 'Image task was not found in this cn-executor instance.',
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
