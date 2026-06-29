import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('homepage aurora has a silent WebGL fallback', () => {
  const source = read('apps/web/src/components/home/SoftAurora.tsx')
  assert.match(source, /function\s+canCreateWebGLContext/, 'WebGL support should be checked before OGL initialization')
  assert.match(source, /if\s*\(!canCreateWebGLContext\(\)\)\s*{[\s\S]*setWebglAvailable\(false\)/, 'fallback should be selected before Renderer when WebGL is unavailable')
  assert.doesNotMatch(source, /experimental-webgl/, 'fallback preflight should avoid noisy legacy WebGL probes')
  assert.match(source, /try\s*{[\s\S]*new Renderer\(/, 'Renderer initialization should be guarded')
  assert.match(source, /catch\s*(?:\([^)]*\))?\s*{[\s\S]*setWebglAvailable\(false\)/, 'WebGL failure should enable fallback state')
  assert.match(source, /data-soft-aurora-fallback/, 'fallback markup should be present for QA')
  assert.doesNotMatch(source, /console\.(error|warn)\(/, 'fallback should not spam the console')
})

test('marketplace listings GET supports unauthenticated public reads', () => {
  const source = read('apps/web/src/app/api/marketplace/listings/route.ts')
  const getBody = source.slice(source.indexOf('export async function GET'), source.indexOf('// ─── POST'))
  const sellerLookupIndex = getBody.indexOf('if (assetId && mine) {')
  const userLookupIndex = getBody.indexOf('const user = await getCurrentUser()')
  assert.ok(sellerLookupIndex > 0, 'seller lookup branch should remain explicit')
  assert.ok(userLookupIndex > sellerLookupIndex, 'auth lookup should be scoped to seller lookup')
  assert.doesNotMatch(getBody.slice(0, sellerLookupIndex), /jsonError\('UNAUTHORIZED'/, 'public listing path should not reject before seller lookup')
  assert.match(getBody, /status:\s*AssetListingStatus\.ACTIVE/, 'public query must remain ACTIVE-only')
  assert.match(getBody, /asset:\s*{\s*isPublic:\s*true,\s*status:\s*'READY'\s*}/, 'public query must remain public READY assets only')
})

test('marketplace page does not request personal orders before auth', () => {
  const source = read('apps/web/src/components/marketplace/MarketplaceListings.tsx')
  const loadBody = source.slice(source.indexOf('const loadMarketplace'), source.indexOf('void loadMarketplace()'))
  const guardIndex = loadBody.indexOf('if (userId) {')
  const orderFetchIndex = loadBody.indexOf('/api/me/marketplace-orders?role=buyer')
  assert.ok(guardIndex > 0, 'authenticated order fetch guard should remain explicit')
  assert.ok(orderFetchIndex > guardIndex, 'personal orders should only be fetched after a current user is known')
  assert.equal(loadBody.slice(0, guardIndex).includes('/api/me/marketplace-orders?role=buyer'), false)
})

test('community page has no public mock or preview copy', () => {
  const source = read('apps/web/src/app/community/page.tsx')
  assert.doesNotMatch(source, /前端预览阶段|动态数据|mock/i)
})
