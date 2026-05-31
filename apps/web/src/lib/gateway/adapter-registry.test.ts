/**
 * Unit tests for adapter-registry.ts
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/gateway/adapter-registry.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { GatewayAdapterRegistry } from './adapter-registry'
import type { GatewayProviderAdapter, ProviderRequest, ProviderResponse } from './types'

function makeAdapter(providerId: string, nodeTypes: string[] = ['image']): GatewayProviderAdapter {
  return {
    providerId,
    displayName: `Test ${providerId}`,
    region: 'global',
    capabilities: { nodeTypes: nodeTypes as GatewayProviderAdapter['capabilities']['nodeTypes'] },
    async generate(_req: ProviderRequest): Promise<ProviderResponse> {
      return { success: true, providerId, modelId: 'test', status: 'succeeded' }
    },
  }
}

describe('GatewayAdapterRegistry', () => {
  test('register and get an adapter', () => {
    const registry = new GatewayAdapterRegistry()
    const adapter = makeAdapter('test-provider')
    registry.register(adapter)
    assert.equal(registry.get('test-provider'), adapter)
  })

  test('get returns null for unknown providerId', () => {
    const registry = new GatewayAdapterRegistry()
    assert.equal(registry.get('nonexistent'), null)
  })

  test('has returns true after registration', () => {
    const registry = new GatewayAdapterRegistry()
    registry.register(makeAdapter('my-provider'))
    assert.equal(registry.has('my-provider'), true)
  })

  test('has returns false for unregistered provider', () => {
    const registry = new GatewayAdapterRegistry()
    assert.equal(registry.has('missing'), false)
  })

  test('list returns all registered adapters', () => {
    const registry = new GatewayAdapterRegistry()
    registry.register(makeAdapter('a'))
    registry.register(makeAdapter('b'))
    registry.register(makeAdapter('c'))
    assert.equal(registry.list().length, 3)
  })

  test('size reflects registered count', () => {
    const registry = new GatewayAdapterRegistry()
    assert.equal(registry.size, 0)
    registry.register(makeAdapter('x'))
    assert.equal(registry.size, 1)
  })

  test('duplicate registration throws', () => {
    const registry = new GatewayAdapterRegistry()
    registry.register(makeAdapter('dup-provider'))
    assert.throws(
      () => registry.register(makeAdapter('dup-provider')),
      /Duplicate registration.*dup-provider/,
    )
  })

  test('listByNodeType filters correctly', () => {
    const registry = new GatewayAdapterRegistry()
    registry.register(makeAdapter('img-only', ['image']))
    registry.register(makeAdapter('vid-only', ['video']))
    registry.register(makeAdapter('both', ['image', 'video']))

    const imageAdapters = registry.listByNodeType('image')
    assert.equal(imageAdapters.length, 2)
    assert.ok(imageAdapters.some((a) => a.providerId === 'img-only'))
    assert.ok(imageAdapters.some((a) => a.providerId === 'both'))

    const videoAdapters = registry.listByNodeType('video')
    assert.equal(videoAdapters.length, 2)
    assert.ok(videoAdapters.some((a) => a.providerId === 'vid-only'))

    const textAdapters = registry.listByNodeType('text')
    assert.equal(textAdapters.length, 0)
  })
})
