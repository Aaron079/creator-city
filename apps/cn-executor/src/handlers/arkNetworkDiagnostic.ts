import type { IncomingMessage, ServerResponse } from 'http'
import dns from 'dns'
import net from 'net'
import { isAuthorized } from '../auth'
import { jsonResponse } from '../response'
import { VOLCENGINE_ARK_DEFAULT_BASE_URL, imageEndpoint } from '../volcengine'

const ARK_HOST = 'ark.cn-beijing.volces.com'
const ARK_PORT = 443
const TIMEOUT_MS = 10_000

function parseHost(url: string): string {
  try { return new URL(url).hostname } catch { return ARK_HOST }
}

async function checkDns(host: string): Promise<{ ok: boolean; addresses?: string[]; error?: string; durationMs: number }> {
  const t0 = Date.now()
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, error: 'DNS lookup timed out', durationMs: Date.now() - t0 })
    }, TIMEOUT_MS)
    dns.resolve4(host, (err, addresses) => {
      clearTimeout(timer)
      if (err) {
        resolve({ ok: false, error: `${err.code ?? 'DNS_ERROR'}: ${err.message}`, durationMs: Date.now() - t0 })
      } else {
        resolve({ ok: true, addresses, durationMs: Date.now() - t0 })
      }
    })
  })
}

async function checkTcp(host: string, port: number): Promise<{ ok: boolean; error?: string; durationMs: number }> {
  const t0 = Date.now()
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: TIMEOUT_MS })
    socket.once('connect', () => {
      socket.destroy()
      resolve({ ok: true, durationMs: Date.now() - t0 })
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve({ ok: false, error: `TCP connect to ${host}:${port} timed out after ${TIMEOUT_MS}ms`, durationMs: Date.now() - t0 })
    })
    socket.once('error', (err) => {
      resolve({ ok: false, error: `TCP connect failed: ${err.message}`, durationMs: Date.now() - t0 })
    })
  })
}

async function checkHttpsNoAuth(endpoint: string): Promise<{
  ok: boolean; httpStatus?: number; error?: string; durationMs: number; note: string
}> {
  const t0 = Date.now()
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // Any HTTP response (even 401/400) means network is reachable
    return {
      ok: true,
      httpStatus: res.status,
      durationMs: Date.now() - t0,
      note: `HTTP ${res.status} — network reachable; 4xx expected without auth`,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t0,
      note: 'fetch failed — likely no outbound internet from this runtime',
    }
  }
}

async function checkHttpsWithAuth(endpoint: string, apiKey: string): Promise<{
  ok: boolean; httpStatus?: number; httpStatusText?: string; error?: string; durationMs: number; responsePreview?: string
}> {
  const t0 = Date.now()
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: 'connectivity-check', prompt: 'test', size: '1x1', n: 1 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const text = await res.text().catch(() => '')
    return {
      ok: res.status < 500,
      httpStatus: res.status,
      httpStatusText: res.statusText,
      responsePreview: text.slice(0, 400),
      durationMs: Date.now() - t0,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t0,
    }
  }
}

export async function handleArkNetworkDiagnostic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    jsonResponse(res, { ok: false, errorCode: 'cn_executor_auth_failed' }, 401)
    return
  }

  const baseUrl = process.env.VOLCENGINE_ARK_BASE_URL?.trim() || VOLCENGINE_ARK_DEFAULT_BASE_URL
  const endpoint = imageEndpoint(baseUrl)
  const host = parseHost(baseUrl)
  const apiKey = process.env.VOLCENGINE_ARK_API_KEY?.trim() ?? ''
  const hasApiKey = Boolean(apiKey)

  console.log('[ark-network-diag] starting checks', { host, endpoint })

  const [dns4, tcp, httpsNoAuth, httpsWithAuth] = await Promise.all([
    checkDns(host),
    checkTcp(host, ARK_PORT),
    checkHttpsNoAuth(endpoint),
    hasApiKey
      ? checkHttpsWithAuth(endpoint, apiKey)
      : Promise.resolve({ ok: false, error: 'VOLCENGINE_ARK_API_KEY not set', durationMs: 0 }),
  ])

  const networkReachable = httpsNoAuth.ok
  const authStatus = 'httpStatus' in httpsWithAuth ? httpsWithAuth.httpStatus : undefined
  const diagnosis =
    !dns4.ok
      ? 'DNS_FAILURE: 无法解析火山 Ark 域名，函数计算实例可能没有 DNS 配置或无公网访问。'
      : !tcp.ok
        ? 'TCP_FAILURE: DNS 正常但 TCP:443 不通，函数计算出网规则可能屏蔽了 HTTPS。'
        : !networkReachable
          ? 'HTTPS_FETCH_FAILED: TCP 可连但 fetch 失败，可能是 TLS SNI 拦截或代理问题。'
          : !hasApiKey
            ? 'NO_API_KEY: 网络可达，但 VOLCENGINE_ARK_API_KEY 未配置。'
            : authStatus === 404
              ? 'network_ok_but_model_or_endpoint_not_found: 网络正常、API Key 认证通过，但请求的 model/endpoint 不存在或当前 API Key 无权访问。请用 /debug/seedream-model-probe 确认正确的 model ID。'
              : authStatus === 401 || authStatus === 403
                ? 'AUTH_FAILED: 网络可达但 API Key 无效（401/403）。请检查 VOLCENGINE_ARK_API_KEY。'
                : !httpsWithAuth.ok
                  ? 'AUTH_FAILED: 网络可达但认证/请求失败。请检查 VOLCENGINE_ARK_API_KEY。'
                  : 'AUTH_OK: 网络可达，API Key 有效（4xx 参数错误属正常，说明认证成功）。'

  console.log('[ark-network-diag] complete', {
    networkReachable,
    dns: dns4.ok,
    tcp: tcp.ok,
    diagnosis,
  })

  jsonResponse(res, {
    ok: networkReachable,
    diagnosis,
    endpoint,
    host,
    hasApiKey,
    checks: {
      dns: dns4,
      tcp: { ...tcp, host, port: ARK_PORT },
      httpsNoAuth,
      httpsWithAuth: hasApiKey
        ? { ...httpsWithAuth, apiKeyPreview: `${apiKey.slice(0, 6)}...` }
        : { ok: false, error: 'skipped — no API key', durationMs: 0 },
    },
  }, 200)
}
