import http from 'http'
import { getEnvPresence, getMissingEnv } from './env'
import { jsonError, jsonNotFound, jsonOk, jsonUnauthorized } from './response'
import { isAuthorized } from './auth'

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

function handleGenerateImage(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (!isAuthorized(req)) {
    jsonUnauthorized(res)
    return
  }
  jsonError(res, {
    errorCode: 'cn_executor_image_not_implemented',
    message: 'CN image executor scaffold is deployed, generation not implemented yet.',
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

  if (method === 'POST' && url === '/api/generate/image') {
    handleGenerateImage(req, res)
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
