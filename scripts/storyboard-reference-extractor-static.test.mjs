import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const extractorPanel = readFileSync(
  new URL('../apps/web/src/components/create/StoryboardReferenceExtractorPanel.tsx', import.meta.url),
  'utf8',
)
const extractorContract = readFileSync(
  new URL('../apps/web/src/lib/canvas/storyboardReferenceExtract.ts', import.meta.url),
  'utf8',
)
const registry = readFileSync(
  new URL('../apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts', import.meta.url),
  'utf8',
)

test('storyboard reference extraction stays local to asset cropping and has no fixed-grid entry', () => {
  for (const [name, source] of [
    ['extractor panel', extractorPanel],
    ['extractor contract', extractorContract],
  ]) {
    assert.doesNotMatch(source, /\/api\/generate/i, `${name} must not call generation APIs`)
    assert.doesNotMatch(source, /\bprovider(?:Id|Adapter)?\b/i, `${name} must not use providers`)
    assert.doesNotMatch(source, /billing|credits|wallet|payment|checkout/i, `${name} must not use billing`)
  }

  assert.doesNotMatch(extractorPanel, /StoryboardGridLayoutId|layoutId|gridSessionId/)
  assert.match(registry, /id: 'storyboard-reference-extractor'/)
  assert.doesNotMatch(registry, /id: 'storyboard-grid-split'/)
})
