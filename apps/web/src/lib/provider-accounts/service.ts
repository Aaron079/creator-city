/**
 * Server-side only. Provider account service layer.
 * Handles all DB queries and key encryption. Never exposes encryptedApiKey,
 * encryptedFields, or plaintext keys in any response.
 */

import { db } from '@/lib/db'
import {
  encryptProviderApiKey,
  getProviderKeyLast4,
  encryptProviderFields,
  getFieldPreview,
} from './crypto'

// ── Constants ─────────────────────────────────────────────────────────────────

const API_KEY_MIN_LENGTH = 8
const ALLOWED_STATUSES = new Set(['active', 'disabled', 'invalid'])

// Human-readable labels for known extra credential fields.
const FIELD_LABELS: Record<string, string> = {
  endpointId: 'Endpoint ID',
  modelId: 'Model ID',
  accessKeyId: 'Access Key ID',
  accessKeySecret: 'Access Key Secret',
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

// ── Select set (excludes encryptedApiKey and encryptedFields always) ──────────
// encryptedFields must NEVER appear here — it contains encrypted secrets.

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

// ── Types ─────────────────────────────────────────────────────────────────────

export type FieldMetaEntry = {
  label: string
  last4: string
  updatedAt: string
}

export type FieldMetaMap = Record<string, FieldMetaEntry>

export type ProviderAccountSummary = {
  id: string
  providerId: string
  accountLabel: string
  keyLast4: string
  credentialType: string | null
  fieldMeta: FieldMetaMap | null
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
  credentialType: string | null
  fieldMeta: unknown // Prisma JsonValue — cast in serializer
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
  credentialType?: string
  fields?: Record<string, string> // plaintext extra fields (e.g. { endpointId: '...' })
}

export interface UpdateProviderAccountInput {
  accountLabel?: string
  status?: string
  isDefault?: boolean
  projectScope?: string | null
  credentialType?: string
  fields?: Record<string, string> // if provided, replaces all extra encrypted fields
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
  const rawMeta = account.fieldMeta
  const fieldMeta: FieldMetaMap | null =
    rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
      ? (rawMeta as FieldMetaMap)
      : null

  return {
    id: account.id,
    providerId: account.providerId,
    accountLabel: account.accountLabel,
    keyLast4: account.keyLast4,
    credentialType: account.credentialType ?? null,
    fieldMeta,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEncryptedFieldsAndMeta(fields: Record<string, string>) {
  const encryptedFields = encryptProviderFields(fields)
  const fieldMeta: FieldMetaMap = {}
  const now = new Date().toISOString()
  for (const [key, value] of Object.entries(fields)) {
    fieldMeta[key] = { label: fieldLabel(key), last4: getFieldPreview(value), updatedAt: now }
  }
  return { encryptedFields, fieldMeta }
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function listUserProviderAccounts(userId: string): Promise<ProviderAccountSummary[]> {
  const accounts = await db.userProviderAccount.findMany({
    where: { userId },
    select: ACCOUNT_SELECT,
    orderBy: { createdAt: 'desc' },
  })
  return accounts.map((a) => toProviderAccountSummary(a as SelectedAccount))
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

  // Determine credential type and encrypt any extra fields
  const hasExtraFields = input.fields && Object.keys(input.fields).length > 0
  const credentialType = input.credentialType
    ?? (hasExtraFields ? 'bearer_with_endpoint' : 'single_api_key')

  let extraData: { encryptedFields?: Record<string, string>; fieldMeta?: FieldMetaMap } = {}
  if (hasExtraFields) {
    const { encryptedFields, fieldMeta } = buildEncryptedFieldsAndMeta(input.fields!)
    extraData = { encryptedFields, fieldMeta }
  }

  // Clear existing default for same user + provider before setting new one
  if (isDefault) {
    await db.userProviderAccount.updateMany({
      where: { userId, providerId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const account = await db.userProviderAccount.create({
    data: {
      userId,
      providerId,
      accountLabel,
      encryptedApiKey,
      keyLast4,
      status: 'active',
      isDefault,
      projectScope,
      credentialType,
      ...(extraData.encryptedFields ? { encryptedFields: extraData.encryptedFields } : {}),
      ...(extraData.fieldMeta ? { fieldMeta: extraData.fieldMeta } : {}),
    },
    select: ACCOUNT_SELECT,
  })

  return toProviderAccountSummary(account as SelectedAccount)
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
  if (input.credentialType !== undefined) data.credentialType = input.credentialType

  // If new extra fields are provided, replace all encryptedFields and regenerate fieldMeta
  if (input.fields && Object.keys(input.fields).length > 0) {
    const { encryptedFields, fieldMeta } = buildEncryptedFieldsAndMeta(input.fields)
    data.encryptedFields = encryptedFields
    data.fieldMeta = fieldMeta
  }

  const account = await db.userProviderAccount.update({
    where: { id },
    data,
    select: ACCOUNT_SELECT,
  })

  return toProviderAccountSummary(account as SelectedAccount)
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
