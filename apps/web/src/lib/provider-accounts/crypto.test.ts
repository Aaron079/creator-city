/**
 * Unit tests for provider-accounts/crypto.ts
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/provider-accounts/crypto.test.ts
 *
 * Requires PROVIDER_KEY_ENCRYPTION_SECRET to be a 32-byte base64 string.
 * This test sets the env var before importing the module.
 */

// Must set env before module import so getMasterKey() sees it
const TEST_SECRET = Buffer.alloc(32, 0x4b).toString('base64') // 32 bytes of 'K'
process.env.PROVIDER_KEY_ENCRYPTION_SECRET = TEST_SECRET

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  encryptProviderApiKey,
  decryptProviderApiKey,
  getProviderKeyLast4,
  redactProviderKey,
  encryptProviderField,
  decryptProviderField,
  encryptProviderFields,
  decryptProviderFields,
  getFieldPreview,
} from './crypto'

describe('encryptProviderApiKey / decryptProviderApiKey', () => {
  test('encrypted output differs from plaintext', () => {
    const plain = 'sk-test1234567890abcdefghijklmn'
    const enc = encryptProviderApiKey(plain)
    assert.notEqual(enc, plain)
  })

  test('decrypt restores original plaintext', () => {
    const plain = 'sk-test1234567890abcdefghijklmn'
    const enc = encryptProviderApiKey(plain)
    assert.equal(decryptProviderApiKey(enc), plain)
  })

  test('each call produces a unique ciphertext (random IV)', () => {
    const plain = 'sk-same-key-value'
    const enc1 = encryptProviderApiKey(plain)
    const enc2 = encryptProviderApiKey(plain)
    assert.notEqual(enc1, enc2)
  })

  test('storage format is iv:authTag:ciphertext (3 parts)', () => {
    const enc = encryptProviderApiKey('sk-abc123')
    assert.equal(enc.split(':').length, 3)
  })

  test('decrypting a tampered ciphertext throws', () => {
    const enc = encryptProviderApiKey('sk-abc123')
    const parts = enc.split(':')
    parts[2] = Buffer.from('tampered-payload').toString('base64')
    assert.throws(() => decryptProviderApiKey(parts.join(':')))
  })

  test('decrypting a tampered authTag throws', () => {
    const enc = encryptProviderApiKey('sk-abc123')
    const parts = enc.split(':')
    parts[1] = Buffer.alloc(16, 0x00).toString('base64')
    assert.throws(() => decryptProviderApiKey(parts.join(':')))
  })

  test('decrypting malformed string throws', () => {
    assert.throws(() => decryptProviderApiKey('not-a-valid-format'))
  })
})

describe('getProviderKeyLast4', () => {
  test('returns last 4 chars for a normal key', () => {
    assert.equal(getProviderKeyLast4('sk-1234567890abcdef'), 'cdef')
  })

  test('returns **** for keys shorter than 4 chars', () => {
    assert.equal(getProviderKeyLast4('ab'), '****')
    assert.equal(getProviderKeyLast4(''), '****')
  })

  test('returns **** for exactly 3 chars', () => {
    assert.equal(getProviderKeyLast4('abc'), '****')
  })

  test('returns all 4 chars for a 4-char key', () => {
    assert.equal(getProviderKeyLast4('abcd'), 'abcd')
  })
})

describe('redactProviderKey', () => {
  test('does not return the full key', () => {
    const key = 'sk-1234567890abcdef'
    const redacted = redactProviderKey(key)
    assert.notEqual(redacted, key)
  })

  test('contains ... separator', () => {
    const redacted = redactProviderKey('sk-1234567890abcdef')
    assert.ok(redacted.includes('...'))
  })

  test('shows only 4-char prefix and 4-char suffix', () => {
    const key = 'sk-1234567890abcdef'
    const redacted = redactProviderKey(key)
    assert.equal(redacted, `${key.slice(0, 4)}...${key.slice(-4)}`)
  })

  test('returns **** for keys 8 chars or shorter', () => {
    assert.equal(redactProviderKey('short'), '****')
    assert.equal(redactProviderKey('exactly8'), '****')
    assert.equal(redactProviderKey(''), '****')
  })

  test('works for 9-char key', () => {
    const key = '123456789'
    const redacted = redactProviderKey(key)
    assert.equal(redacted, '1234...6789')
  })
})

describe('encryptProviderField / decryptProviderField', () => {
  test('decrypt restores original plaintext', () => {
    const plain = 'ep-abc123xyz789'
    const enc = encryptProviderField(plain)
    assert.equal(decryptProviderField(enc), plain)
  })

  test('each call produces a unique ciphertext', () => {
    const plain = 'ep-same-endpoint-id'
    assert.notEqual(encryptProviderField(plain), encryptProviderField(plain))
  })

  test('decrypting tampered field throws', () => {
    const enc = encryptProviderField('ep-test')
    const parts = enc.split(':')
    parts[2] = Buffer.from('tampered').toString('base64')
    assert.throws(() => decryptProviderField(parts.join(':')))
  })
})

describe('encryptProviderFields / decryptProviderFields', () => {
  test('roundtrip preserves all field values', () => {
    const fields = { endpointId: 'ep-abc123', regionCode: 'cn-beijing' }
    const encrypted = encryptProviderFields(fields)
    const decrypted = decryptProviderFields(encrypted)
    assert.deepEqual(decrypted, fields)
  })

  test('each field gets independent encryption (different ciphertexts)', () => {
    const fields = { a: 'same-value', b: 'same-value' }
    const encrypted = encryptProviderFields(fields)
    assert.notEqual(encrypted.a, encrypted.b)
  })

  test('empty record roundtrips as empty record', () => {
    assert.deepEqual(decryptProviderFields(encryptProviderFields({})), {})
  })

  test('decrypting a tampered field throws', () => {
    const encrypted = encryptProviderFields({ endpointId: 'ep-real' })
    const parts = encrypted.endpointId!.split(':')
    parts[2] = Buffer.from('bad-payload').toString('base64')
    assert.throws(() => decryptProviderFields({ endpointId: parts.join(':') }))
  })

  test('encrypted values differ from plaintext', () => {
    const fields = { endpointId: 'ep-abc123' }
    const encrypted = encryptProviderFields(fields)
    assert.notEqual(encrypted.endpointId, fields.endpointId)
  })
})

describe('getFieldPreview', () => {
  test('returns last 4 chars', () => {
    assert.equal(getFieldPreview('endpoint-id-abcdef'), 'cdef')
    assert.equal(getFieldPreview('ep-abc123xyz7890'), '7890')
  })

  test('returns **** for values shorter than 4 chars', () => {
    assert.equal(getFieldPreview('ab'), '****')
    assert.equal(getFieldPreview(''), '****')
  })

  test('does not return the full value', () => {
    const value = 'ep-abc123xyz789abcdef'
    const preview = getFieldPreview(value)
    assert.notEqual(preview, value)
    assert.equal(preview.length, 4)
  })
})

describe('missing PROVIDER_KEY_ENCRYPTION_SECRET', () => {
  test('encryptProviderApiKey throws safe error when env is unset', () => {
    const original = process.env.PROVIDER_KEY_ENCRYPTION_SECRET
    delete process.env.PROVIDER_KEY_ENCRYPTION_SECRET
    assert.throws(
      () => encryptProviderApiKey('some-key'),
      (err: unknown) => {
        assert.ok(err instanceof Error)
        assert.ok(
          err.message.includes('PROVIDER_KEY_ENCRYPTION_SECRET'),
          `Expected error to mention PROVIDER_KEY_ENCRYPTION_SECRET, got: ${err.message}`,
        )
        // Must not contain the actual key value
        assert.ok(!err.message.includes('some-key'))
        return true
      },
    )
    process.env.PROVIDER_KEY_ENCRYPTION_SECRET = original
  })
})
