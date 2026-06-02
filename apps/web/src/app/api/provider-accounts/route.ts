import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import {
  listUserProviderAccounts,
  createUserProviderAccount,
  ValidationError,
} from '@/lib/provider-accounts/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── GET /api/provider-accounts ───────────────────────────────────────────────
// Returns all provider accounts for the authenticated user.
// Never returns encryptedApiKey or the original API key.

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '请先登录后再管理 Provider API 账户。', 401)

  try {
    const accounts = await listUserProviderAccounts(user.id)
    return jsonOk({ accounts })
  } catch (err) {
    if (isConfigError(err)) {
      return jsonError('SERVICE_UNAVAILABLE', 'Provider Key 加密服务暂时不可用，请稍后再试。', 503)
    }
    return jsonError('INTERNAL_ERROR', '获取账户列表失败，请稍后再试。', 500)
  }
}

// ── POST /api/provider-accounts ──────────────────────────────────────────────
// Creates a new provider account for the authenticated user.
// Request body: { providerId, apiKey, accountLabel, isDefault?, projectScope? }
// Response: summary without encryptedApiKey or original apiKey.

type CreateBody = {
  providerId?: unknown
  apiKey?: unknown
  accountLabel?: unknown
  isDefault?: unknown
  projectScope?: unknown
  credentialType?: unknown
  fields?: unknown
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '请先登录后再管理 Provider API 账户。', 401)

  let body: CreateBody
  try {
    body = await request.json() as CreateBody
  } catch {
    return jsonError('VALIDATION_FAILED', '请求格式错误。', 400)
  }

  const providerId = typeof body.providerId === 'string' ? body.providerId : ''
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey : ''
  const accountLabel = typeof body.accountLabel === 'string' ? body.accountLabel : ''
  const isDefault = body.isDefault === true
  const projectScope = typeof body.projectScope === 'string' ? body.projectScope : null
  const credentialType = typeof body.credentialType === 'string' ? body.credentialType : undefined

  // Extract extra fields — only accept string values, silently drop non-strings
  const rawFields = body.fields
  const fields: Record<string, string> | undefined =
    rawFields && typeof rawFields === 'object' && !Array.isArray(rawFields)
      ? Object.fromEntries(
          Object.entries(rawFields as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'string' && (v as string).trim().length > 0)
            .map(([k, v]) => [k, (v as string).trim()])
        )
      : undefined

  try {
    const account = await createUserProviderAccount(user.id, {
      providerId,
      apiKey,
      accountLabel,
      isDefault,
      projectScope,
      credentialType,
      fields: fields && Object.keys(fields).length > 0 ? fields : undefined,
    })
    return jsonOk({ account }, { status: 201 })
  } catch (err) {
    if (err instanceof ValidationError) {
      return jsonError('VALIDATION_FAILED', err.message, 400)
    }
    if (isConfigError(err)) {
      return jsonError('SERVICE_UNAVAILABLE', 'Provider Key 加密服务暂时不可用，请稍后再试。', 503)
    }
    return jsonError('INTERNAL_ERROR', '创建账户失败，请稍后再试。', 500)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isConfigError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('PROVIDER_KEY_ENCRYPTION_SECRET')
}
