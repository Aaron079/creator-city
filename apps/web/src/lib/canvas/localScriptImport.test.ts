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

describe('validateLocalScriptFile — allowed extensions', () => {
  test('accepts .txt', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('script.txt', 'text/plain', 100)), { ok: true })
  })

  test('accepts .md', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('notes.md', 'text/markdown', 100)), { ok: true })
  })

  test('accepts .markdown', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('README.markdown', 'text/markdown', 100)), { ok: true })
  })

  test('accepts .fountain', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('screenplay.fountain', '', 100)), { ok: true })
  })

  test('accepts .fountain with empty mime (macOS filesystem)', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('my-script.fountain', '', 100)), { ok: true })
  })

  test('accepts .srt', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('subtitles.srt', 'application/x-subrip', 100)), { ok: true })
  })

  test('accepts .srt with empty mime', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('subtitles.srt', '', 100)), { ok: true })
  })

  test('accepts .vtt', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('captions.vtt', 'text/vtt', 100)), { ok: true })
  })

  test('accepts .csv', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('shots.csv', 'text/csv', 100)), { ok: true })
  })

  test('accepts .json as text', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('data.json', 'application/json', 100)), { ok: true })
  })

  test('accepts .json with empty mime', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('data.json', '', 100)), { ok: true })
  })

  test('accepts .txt with empty mime (filesystem)', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('file.txt', '', 100)), { ok: true })
  })
})

describe('validateLocalScriptFile — uppercase extensions', () => {
  test('accepts SCRIPT.TXT (uppercase)', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('SCRIPT.TXT', 'text/plain', 100)), { ok: true })
  })

  test('accepts Script.Fountain (mixed case)', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('Script.Fountain', '', 100)), { ok: true })
  })

  test('accepts DATA.JSON (uppercase)', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('DATA.JSON', 'application/json', 100)), { ok: true })
  })
})

describe('validateLocalScriptFile — Word / PDF rejection', () => {
  test('rejects .doc with Word-specific error message', () => {
    const r = validateLocalScriptFile(makeFile('script.doc', 'application/msword', 100))
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.equal(r.error.code, 'INVALID_TYPE')
      assert.match(r.error.message, /Word|PDF|TXT|Markdown|Fountain/u)
    }
  })

  test('rejects .docx with Word-specific error message', () => {
    const r = validateLocalScriptFile(makeFile('script.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 100))
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.equal(r.error.code, 'INVALID_TYPE')
      assert.match(r.error.message, /Word|PDF/u)
    }
  })

  test('rejects .pdf', () => {
    const r = validateLocalScriptFile(makeFile('doc.pdf', 'application/pdf', 100))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })

  test('rejects .rtf', () => {
    const r = validateLocalScriptFile(makeFile('script.rtf', 'application/rtf', 100))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })

  test('rejects .doc even with empty mime', () => {
    const r = validateLocalScriptFile(makeFile('legacy.doc', '', 100))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })
})

describe('validateLocalScriptFile — blocked mime types', () => {
  test('rejects image/jpeg regardless of extension', () => {
    const r = validateLocalScriptFile(makeFile('photo.jpg', 'image/jpeg', 100))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })

  test('rejects video/mp4', () => {
    const r = validateLocalScriptFile(makeFile('clip.mp4', 'video/mp4', 100))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })

  test('rejects application/pdf mime even if extension unknown', () => {
    const r = validateLocalScriptFile(makeFile('file.unknown', 'application/pdf', 100))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })
})

describe('validateLocalScriptFile — unknown extensions', () => {
  test('rejects unknown extension .xyz', () => {
    const r = validateLocalScriptFile(makeFile('file.xyz', 'text/plain', 100))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })

  test('rejects no extension', () => {
    const r = validateLocalScriptFile(makeFile('noext', 'text/plain', 100))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })
})

describe('validateLocalScriptFile — size limit', () => {
  test('accepts file exactly at 2MB', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('ok.txt', 'text/plain', LOCAL_SCRIPT_MAX_SIZE_BYTES)), { ok: true })
  })

  test('rejects file over 2MB', () => {
    const r = validateLocalScriptFile(makeFile('large.txt', 'text/plain', LOCAL_SCRIPT_MAX_SIZE_BYTES + 1))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'TOO_LARGE')
  })

  test('LOCAL_SCRIPT_MAX_SIZE_BYTES is 2MB', () => {
    assert.equal(LOCAL_SCRIPT_MAX_SIZE_BYTES, 2 * 1024 * 1024)
  })
})

describe('validateLocalScriptFile — MIME + extension interaction', () => {
  test('allowed ext + empty MIME passes', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('script.fountain', '', 100)), { ok: true })
  })

  test('allowed ext + text/plain MIME passes (macOS .fountain)', () => {
    assert.deepEqual(validateLocalScriptFile(makeFile('script.fountain', 'text/plain', 100)), { ok: true })
  })

  test('allowed ext + mismatched non-blocked MIME passes (ext is primary gate)', () => {
    // e.g. browser reports unexpected MIME for .srt
    assert.deepEqual(validateLocalScriptFile(makeFile('subs.srt', 'text/plain', 100)), { ok: true })
  })

  test('allowed ext + blocked image MIME rejects (blocked MIME wins)', () => {
    // If browser somehow reports image/jpeg for a .txt file, reject it
    const r = validateLocalScriptFile(makeFile('weird.txt', 'image/jpeg', 100))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })
})
