import http from 'http'
import { getEnvPresence, getMissingEnv } from './env'
import { jsonError, jsonNotFound, jsonOk, jsonUnauthorized } from './response'
import { isAuthorized } from './auth'
import { handleGenerateImage } from './handlers/generateImage'
import { handleImageGenerationStatus, handleStartImageGeneration } from './handlers/imageTasks'
import { handleRunImageJob } from './handlers/jobRunner'
import { handleRunVideoJob } from './handlers/videoJobRunner'
import { handleSeedreamConfigDebug } from './handlers/seedreamConfig'
import { handleArkNetworkDiagnostic } from './handlers/arkNetworkDiagnostic'
import { handleSeedreamModelProbe } from './handlers/seedreamModelProbe'
import { handleJobDebug } from './handlers/jobDebug'

const PORT = parseInt(process.env.PORT ?? '9000', 10)

function handleHealth(res: http.ServerResponse): void {
  const envPresence = getEnvPresence()
  const missingEnv = getMissingEnv()
  jsonOk(res, {
    ok: missingEnv.length === 0,
    service: 'creator-city-cn-executor',
    region: 'cn',
    runtime: 'node',
    env: envPresence,
    missingEnv,
  })
}

function handleGenerateVideo(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (!isAuthorized(req)) {
    jsonUnauthorized(res)
    return
  }
  jsonError(res, {
    errorCode: 'cn_executor_video_not_implemented',
    message: 'CN video executor scaffold is deployed, generation not implemented yet.',
  })
}

const server = http.createServer((req, res) => {
  const method = req.method?.toUpperCase() ?? 'GET'
  const url = req.url?.split('?')[0] ?? '/'

  // Root — always JSON 200, never redirect. Aliyun FC forbids external redirects
  // on the default public endpoint; returning a non-2xx can trigger platform
  // redirects, so all base paths must respond with a JSON body and 200.
  if (method === 'GET' && (url === '/' || url === '')) {
    jsonOk(res, {
      ok: true,
      service: 'creator-city-cn-executor',
      message: 'CN executor is running. Use /health for diagnostics.',
    })
    return
  }

  if (method === 'GET' && url === '/health') {
    handleHealth(res)
    return
  }

  if (method === 'GET' && url === '/debug/seedream-config') {
    handleSeedreamConfigDebug(req, res)
    return
  }

  if (method === 'GET' && url === '/debug/ark-network') {
    handleArkNetworkDiagnostic(req, res).catch((err: unknown) => {
      if (!res.headersSent) {
        jsonError(res, {
          errorCode: 'internal_error',
          message: err instanceof Error ? err.message : 'Unexpected error in network diagnostic.',
        })
      }
    })
    return
  }

  if (method === 'GET' && url === '/debug/seedream-model-probe') {
    handleSeedreamModelProbe(req, res).catch((err: unknown) => {
      if (!res.headersSent) {
        jsonError(res, {
          errorCode: 'internal_error',
          message: err instanceof Error ? err.message : 'Unexpected error in seedream model probe.',
        })
      }
    })
    return
  }

  if (method === 'GET' && url.startsWith('/api/jobs/debug')) {
    handleJobDebug(req, res).catch((err: unknown) => {
      if (!res.headersSent) {
        jsonError(res, {
          errorCode: 'internal_error',
          message: err instanceof Error ? err.message : 'Unexpected error in job debug.',
        })
      }
    })
    return
  }

  if (method === 'POST' && url === '/api/generate/image') {
    handleGenerateImage(req, res).catch((err: unknown) => {
      if (!res.headersSent) {
        jsonError(res, {
          errorCode: 'internal_error',
          message: err instanceof Error ? err.message : 'Unexpected error in image generation.',
        })
      }
    })
    return
  }

  if (method === 'POST' && url === '/api/generate/image/start') {
    handleStartImageGeneration(req, res).catch((err: unknown) => {
      if (!res.headersSent) {
        jsonError(res, {
          errorCode: 'internal_error',
          message: err instanceof Error ? err.message : 'Unexpected error starting image generation.',
        })
      }
    })
    return
  }

  if (method === 'GET' && url === '/api/generate/image/status') {
    handleImageGenerationStatus(req, res)
    return
  }

  if (method === 'POST' && url === '/api/jobs/run-image') {
    handleRunImageJob(req, res).catch((err: unknown) => {
      if (!res.headersSent) {
        jsonError(res, {
          errorCode: 'internal_error',
          message: err instanceof Error ? err.message : 'Unexpected error in job runner.',
        })
      }
    })
    return
  }

  if (method === 'POST' && url === '/api/jobs/run-video') {
    handleRunVideoJob(req, res).catch((err: unknown) => {
      if (!res.headersSent) {
        jsonError(res, {
          errorCode: 'internal_error',
          message: err instanceof Error ? err.message : 'Unexpected error in video job runner.',
        })
      }
    })
    return
  }

  if (method === 'POST' && url === '/api/generate/video') {
    handleGenerateVideo(req, res)
    return
  }

  jsonNotFound(res, url)
})

server.listen(PORT, () => {
  console.log(`[cn-executor] listening on port ${PORT}`)
})

export default server
