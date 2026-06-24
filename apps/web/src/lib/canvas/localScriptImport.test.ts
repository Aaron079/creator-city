/**
 * Unit tests for localScriptImport.ts
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/canvas/localScriptImport.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateLocalScriptFile,
  LOCAL_SCRIPT_MAX_SIZE_BYTES,
} from './localScriptImport'

function makeFile(name: string, type: string, size: number): File {
  const buf = new Uint8Array(size)
  return new File([buf], name, { type })
}

describe('validateLocalScriptFile', () => {
  test('accepts .txt by extension', () => {
    const f = makeFile('script.txt', 'text/plain', 100)
    assert.deepEqual(validateLocalScriptFile(f), { ok: true })
  })

  test('accepts .md by extension', () => {
    const f = makeFile('notes.md', 'text/markdown', 100)
    assert.deepEqual(validateLocalScriptFile(f), { ok: true })
  })

  test('accepts .txt with empty mime type (filesystem)', () => {
    const f = makeFile('file.txt', '', 100)
    assert.deepEqual(validateLocalScriptFile(f), { ok: true })
  })

  test('rejects .pdf', () => {
    const f = makeFile('doc.pdf', 'application/pdf', 100)
    const r = validateLocalScriptFile(f)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })

  test('rejects .docx', () => {
    const f = makeFile('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 100)
    const r = validateLocalScriptFile(f)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })

  test('rejects .jpg as text', () => {
    const f = makeFile('photo.jpg', 'image/jpeg', 100)
    const r = validateLocalScriptFile(f)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })

  test('rejects file over 2MB', () => {
    const f = makeFile('large.txt', 'text/plain', LOCAL_SCRIPT_MAX_SIZE_BYTES + 1)
    const r = validateLocalScriptFile(f)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'TOO_LARGE')
  })

  test('accepts file exactly at 2MB limit', () => {
    const f = makeFile('ok.txt', 'text/plain', LOCAL_SCRIPT_MAX_SIZE_BYTES)
    assert.deepEqual(validateLocalScriptFile(f), { ok: true })
  })

  test('LOCAL_SCRIPT_MAX_SIZE_BYTES is 2MB', () => {
    assert.equal(LOCAL_SCRIPT_MAX_SIZE_BYTES, 2 * 1024 * 1024)
  })
})
