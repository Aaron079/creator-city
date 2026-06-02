/**
 * Server-side only. Never import in client components.
 *
 * Encrypt/decrypt provider API keys with AES-256-GCM.
 * Requires env var: PROVIDER_KEY_ENCRYPTION_SECRET (32-byte buffer, base64-encoded)
 *
 * Storage format: base64(iv):base64(authTag):base64(ciphertext)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const KEY_BYTES = 32

function getMasterKey(): Buffer {
  const secret = process.env.PROVIDER_KEY_ENCRYPTION_SECRET
  if (!secret) {
    throw new Error(
      'Server configuration error: PROVIDER_KEY_ENCRYPTION_SECRET is not set.',
    )
  }
  const buf = Buffer.from(secret, 'base64')
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      'Server configuration error: PROVIDER_KEY_ENCRYPTION_SECRET must decode to exactly 32 bytes.',
    )
  }
  return buf
}

/** Encrypts a provider API key. Returns iv:authTag:ciphertext (all base64). */
export function encryptProviderApiKey(plainText: string): string {
  const key = getMasterKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':')
}

/** Decrypts a value previously produced by encryptProviderApiKey. */
export function decryptProviderApiKey(encrypted: string): string {
  const key = getMasterKey()
  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Server error: invalid encrypted key format.')
  }
  const iv = Buffer.from(parts[0]!, 'base64')
  const authTag = Buffer.from(parts[1]!, 'base64')
  const ciphertext = Buffer.from(parts[2]!, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/** Returns the last 4 characters of a provider key for safe display. */
export function getProviderKeyLast4(plainText: string): string {
  if (plainText.length < 4) return '****'
  return plainText.slice(-4)
}

/**
 * Redacts a provider key for safe logging.
 * Returns first4...last4 for keys > 8 chars, otherwise ****.
 * Never use this to display the full key to users.
 */
export function redactProviderKey(value: string): string {
  if (value.length <= 8) return '****'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

// ── Multi-field credential helpers ────────────────────────────────────────────
// These use the same AES-256-GCM algorithm as the primary API key functions.

/** Encrypts a single named credential field (e.g. endpointId). */
export function encryptProviderField(plainText: string): string {
  return encryptProviderApiKey(plainText)
}

/** Decrypts a single named credential field produced by encryptProviderField. */
export function decryptProviderField(encrypted: string): string {
  return decryptProviderApiKey(encrypted)
}

/**
 * Encrypts all values in a record of plain-text fields.
 * Input:  { endpointId: 'ep-abc123', ... }
 * Output: { endpointId: 'iv:authTag:cipher', ... }
 * Each field gets its own random IV, so ciphertexts are always unique.
 */
export function encryptProviderFields(fields: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields)) {
    result[key] = encryptProviderApiKey(value)
  }
  return result
}

/**
 * Decrypts all values in a record of encrypted fields.
 * Input:  { endpointId: 'iv:authTag:cipher', ... }
 * Output: { endpointId: 'ep-abc123', ... }
 */
export function decryptProviderFields(fields: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields)) {
    result[key] = decryptProviderApiKey(value)
  }
  return result
}

/**
 * Returns the last 4 characters of a field value for safe display.
 * Identical behavior to getProviderKeyLast4 — alias for semantic clarity.
 */
export function getFieldPreview(value: string): string {
  return getProviderKeyLast4(value)
}
