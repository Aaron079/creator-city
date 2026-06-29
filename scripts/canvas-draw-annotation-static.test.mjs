import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const annotationFiles = [
  'apps/web/src/components/create/AnnotationPanel.tsx',
  'apps/web/src/lib/canvas/annotationMetadata.ts',
]

describe('canvas draw annotation static boundary', () => {
  test('annotation UI and metadata helper do not call provider, generate, billing, credits, wallet, or upload APIs', () => {
    for (const file of annotationFiles) {
      const source = readFileSync(resolve(root, file), 'utf8')
      assert.doesNotMatch(source, /fetch\s*\(/, `${file} should not fetch`)
      assert.doesNotMatch(source, /\/api\/generate/i, `${file} should not call generate APIs`)
      assert.doesNotMatch(source, /\/api\/assets\/upload/i, `${file} should not upload assets`)
      assert.doesNotMatch(source, /provider/i, `${file} should not reference providers`)
      assert.doesNotMatch(source, /billing|credits|wallet/i, `${file} should not reference billing or credits`)
    }
  })
})
