/**
 * Server-side only. Provider account service layer.
 * Handles all DB queries and key encryption. Never exposes encryptedApiKey or plaintext keys.
 */

import { db } from '@/lib/db'
import { encryptProviderApiKey, getProviderKeyLast4 } from './crypto'

// ── Constants ─────────────────────────────────────────────────────────────────

const API_KEY_MIN_LENGTH = 8
const ALLOWED_STATUSES = new Set(['active', 'disabled', 'invalid'])

// ── Select set (excludes encryptedApiKey always) ──────────────────────────────

const ACCOUNT_SELECT = {
  id: true,
  providerId: true,
  accountLabel: true,
  keyLast4: true,
  status: true,
  isDefault: true,
  projectScope: true,
  lastTestedAt: true,
  lastTestStatus: true,
  lastTestError: true,
  createdAt: true,
  updatedAt: true,
} as const

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProviderAccountSummary = {
  id: string
  providerId: string
  accountLabel: string
  keyLast4: string
  status: string
  isDefault: boolean
  projectScope: string | null
  lastTestedAt: Date | null
  lastTestStatus: string | null
  lastTestError: string | null
  createdAt: Date
  updatedAt: Date
}

export type SelectedAccount = {
  id: string
  providerId: string
  accountLabel: string
  keyLast4: string
  status: string
  isDefault: boolean
  projectScope: string | null
  lastTestedAt: Date | null
  lastTestStatus: string | null
  lastTestError: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateProviderAccountInput {
  providerId: string
  apiKey: string
  accountLabel: string
  isDefault?: boolean
  projectScope?: string | null
}

export interface UpdateProviderAccountInput {
  accountLabel?: string
  status?: string
  isDefault?: boolean
  projectScope?: string | null
}

// ── Errors ────────────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

// ── Serializer ────────────────────────────────────────────────────────────────

export function toProviderAccountSummary(account: SelectedAccount): ProviderAccountSummary {
  return {
    id: account.id,
    providerId: account.providerId,
    accountLabel: account.accountLabel,
    keyLast4: account.keyLast4,
    status: account.status,
    isDefault: account.isDefault,
    projectScope: account.projectScope,
    lastTestedAt: account.lastTestedAt,
    lastTestStatus: account.lastTestStatus,
    lastTestError: account.lastTestError,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function listUserProviderAccounts(userId: string): Promise<ProviderAccountSummary[]> {
  const accounts = await db.userProviderAccount.findMany({
    where: { userId },
    select: ACCOUNT_SELECT,
    orderBy: { createdAt: 'desc' },
  })
  return accounts.map(toProviderAccountSummary)
}

export async function createUserProviderAccount(
  userId: string,
  input: CreateProviderAccountInput,
): Promise<ProviderAccountSummary> {
  const providerId = input.providerId.trim()
  const accountLabel = input.accountLabel.trim()
  const { apiKey } = input
  const isDefault = input.isDefault ?? false
  const projectScope = input.projectScope?.trim() || null

  if (!providerId) throw new ValidationError('请填写完整的 Provider、账户名称和 API Key。')
  if (!accountLabel) throw new ValidationError('请填写完整的 Provider、账户名称和 API Key。')
  if (!apiKey || apiKey.length < API_KEY_MIN_LENGTH) {
    throw new ValidationError('请填写完整的 Provider、账户名称和 API Key。')
  }

  // encryptProviderApiKey throws if PROVIDER_KEY_ENCRYPTION_SECRET is missing — let it propagate
  const encryptedApiKey = encryptProviderApiKey(apiKey)
  const keyLast4 = getProviderKeyLast4(apiKey)

  // Clear existing default for same user + provider before setting new one
  if (isDefault) {
    await db.userProviderAccount.updateMany({
      where: { userId, providerId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const account = await db.userProviderAccount.create({
    data: { userId, providerId, accountLabel, encryptedApiKey, keyLast4, status: 'active', isDefault, projectScope },
    select: ACCOUNT_SELECT,
  })

  return toProviderAccountSummary(account)
}

export async function updateUserProviderAccount(
  userId: string,
  id: string,
  input: UpdateProviderAccountInput,
): Promise<ProviderAccountSummary> {
  // Verify ownership first
  const existing = await db.userProviderAccount.findFirst({
    where: { id, userId },
    select: { id: true, providerId: true },
  })
  if (!existing) throw new NotFoundError('未找到该 API 账户。')

  if (input.status !== undefined && !ALLOWED_STATUSES.has(input.status)) {
    throw new ValidationError('状态值无效，允许的值为：active / disabled / invalid。')
  }

  // Clear existing default for same provider before promoting this one
  if (input.isDefault === true) {
    await db.userProviderAccount.updateMany({
      where: { userId, providerId: existing.providerId, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    })
  }

  const data: Record<string, unknown> = {}
  if (input.accountLabel !== undefined) data.accountLabel = input.accountLabel.trim()
  if (input.status !== undefined) data.status = input.status
  if (input.isDefault !== undefined) data.isDefault = input.isDefault
  if ('projectScope' in input) data.projectScope = input.projectScope?.trim() || null

  const account = await db.userProviderAccount.update({
    where: { id },
    data,
    select: ACCOUNT_SELECT,
  })

  return toProviderAccountSummary(account)
}

export async function deleteUserProviderAccount(userId: string, id: string): Promise<void> {
  // Verify ownership before delete — prevents enumeration attacks
  const existing = await db.userProviderAccount.findFirst({
    where: { id, userId },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError('未找到该 API 账户。')

  await db.userProviderAccount.delete({ where: { id } })
}
