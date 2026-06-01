import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import {
  updateUserProviderAccount,
  deleteUserProviderAccount,
  ValidationError,
  NotFoundError,
} from '@/lib/provider-accounts/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: { id: string } }

// ── PATCH /api/provider-accounts/:id ─────────────────────────────────────────
// Updates accountLabel, status, isDefault, or projectScope.
// Explicitly does NOT allow updating apiKey — must delete and re-add.

type PatchBody = {
  accountLabel?: unknown
  status?: unknown
  isDefault?: unknown
  projectScope?: unknown
  // Any other fields (including apiKey) are silently ignored.
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '请先登录后再管理 Provider API 账户。', 401)

  let body: PatchBody
  try {
    body = await request.json() as PatchBody
  } catch {
    return jsonError('VALIDATION_FAILED', '请求格式错误。', 400)
  }

  // Build a typed, whitelist-only input — apiKey and encryptedApiKey are never read
  const input: {
    accountLabel?: string
    status?: string
    isDefault?: boolean
    projectScope?: string | null
  } = {}

  if (typeof body.accountLabel === 'string') input.accountLabel = body.accountLabel
  if (typeof body.status === 'string') input.status = body.status
  if (typeof body.isDefault === 'boolean') input.isDefault = body.isDefault
  if ('projectScope' in body) {
    input.projectScope = typeof body.projectScope === 'string' ? body.projectScope : null
  }

  try {
    const account = await updateUserProviderAccount(user.id, params.id, input)
    return jsonOk({ account })
  } catch (err) {
    if (err instanceof NotFoundError) {
      return jsonError('NOT_FOUND', err.message, 404)
    }
    if (err instanceof ValidationError) {
      return jsonError('VALIDATION_FAILED', err.message, 400)
    }
    return jsonError('INTERNAL_ERROR', '更新账户失败，请稍后再试。', 500)
  }
}

// ── DELETE /api/provider-accounts/:id ────────────────────────────────────────
// Permanently deletes the account and its encrypted key.
// Only the owning user can delete their own account.

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '请先登录后再管理 Provider API 账户。', 401)

  try {
    await deleteUserProviderAccount(user.id, params.id)
    return jsonOk({ deleted: true })
  } catch (err) {
    if (err instanceof NotFoundError) {
      return jsonError('NOT_FOUND', err.message, 404)
    }
    return jsonError('INTERNAL_ERROR', '删除账户失败，请稍后再试。', 500)
  }
}
