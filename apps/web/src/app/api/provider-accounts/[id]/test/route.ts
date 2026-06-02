import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { db } from '@/lib/db'
import { decryptProviderApiKey } from '@/lib/provider-accounts/crypto'
import { testProviderConnection } from '@/lib/provider-accounts/test-connection'
import { toProviderAccountSummary, type SelectedAccount } from '@/lib/provider-accounts/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: { id: string } }

const ACCOUNT_SELECT = {
  id: true,
  providerId: true,
  accountLabel: true,
  keyLast4: true,
  credentialType: true,
  fieldMeta: true,
  status: true,
  isDefault: true,
  projectScope: true,
  lastTestedAt: true,
  lastTestStatus: true,
  lastTestError: true,
  createdAt: true,
  updatedAt: true,
} as const

// ── POST /api/provider-accounts/:id/test ──────────────────────────────────────
// Decrypts the stored key in-memory, calls GET /models on the provider, updates
// lastTestedAt/lastTestStatus/lastTestError, and returns the sanitised account.
// The plaintext key is never logged or returned.

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '请先登录后再管理 Provider API 账户。', 401)

  const raw = await db.userProviderAccount.findFirst({
    where: { id: params.id, userId: user.id },
    select: { ...ACCOUNT_SELECT, encryptedApiKey: true },
  })
  if (!raw) return jsonError('NOT_FOUND', '未找到该 API 账户。', 404)

  let plainKey: string
  try {
    plainKey = decryptProviderApiKey(raw.encryptedApiKey)
  } catch {
    return jsonError('INTERNAL_ERROR', '密钥解密失败，请删除并重新添加该账户。', 500)
  }

  const testResult = await testProviderConnection(raw.providerId, plainKey)

  // Only flip status for clear auth failure or confirmed success; leave other
  // statuses (rate_limited, timeout, etc.) unchanged to avoid false negatives.
  const statusUpdate =
    testResult.status === 'auth_failed' ? 'invalid'
    : testResult.status === 'ok' ? 'active'
    : undefined

  const updated = await db.userProviderAccount.update({
    where: { id: raw.id },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: testResult.status,
      lastTestError: testResult.status === 'ok' ? null : testResult.message,
      ...(statusUpdate !== undefined && statusUpdate !== raw.status ? { status: statusUpdate } : {}),
    },
    select: ACCOUNT_SELECT,
  })

  return jsonOk({
    account: toProviderAccountSummary(updated as SelectedAccount),
    testResult: {
      ok: testResult.status === 'ok',
      status: testResult.status,
      message: testResult.message,
    },
  })
}
