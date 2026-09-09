import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveSeedanceCapability } from './capabilities'
import { buildSeedanceTakePackage, type RequestedDerivative } from './package'
import { normalizeSpatialPrevis } from '../spatial-previs/normalize'

test('builds an immutable provider-neutral package from the canonical master take', () => {
  const previs = normalizeSpatialPrevis({
    projectId: 'project-1',
    durationSec: 30,
    sourceMode: 'multi-view',
    updatedAt: '2026-09-09T00:00:00.000Z',
  })
  const capability = resolveSeedanceCapability({
    model: 'seedance-2.5',
    entryPoint: 'ark',
    entitlement: 'standard',
  })
  const source = structuredClone({ previs, capability })

  const output = buildSeedanceTakePackage({
    previs,
    capability,
    deliveryMode: 'direct',
  })

  assert.equal(output.durationSec, 30)
  assert.match(output.direction, /camera/)
  assert.equal(output.capability.maxSingleDurationSec, 30)
  assert.equal(output.deliveryMode, 'direct')
  assert.ok(Object.isFrozen(output))
  assert.ok(Object.isFrozen(output.capability))
  assert.deepEqual({ previs, capability }, source)
})

test('retains every unsupported requested derivative with one warning per control', () => {
  const previs = normalizeSpatialPrevis({ projectId: 'project-1', updatedAt: '2026-09-09T00:00:00.000Z' })
  const capability = resolveSeedanceCapability({
    model: 'seedance-2.5',
    entryPoint: 'ark',
    entitlement: 'standard',
  })
  const requestedControls: RequestedDerivative[] = [
    { id: 'depth-map', kind: 'depth' as const, value: { source: 'scene-depth-v1' } },
    { id: 'layout-lock', kind: 'layout' as const, value: { subject: 'center' } },
  ]
  const source = structuredClone(requestedControls)

  const output = buildSeedanceTakePackage({
    previs,
    capability,
    deliveryMode: 'direct',
    requestedControls,
  })

  assert.deepEqual(output.unsupportedControls, requestedControls)
  assert.deepEqual(output.warnings.map((warning) => warning.controlId), ['depth-map', 'layout-lock'])
  assert.deepEqual(output.warnings.map((warning) => warning.code), [
    'UNSUPPORTED_REQUESTED_CONTROL',
    'UNSUPPORTED_REQUESTED_CONTROL',
  ])
  assert.equal(output.controls.length, 0)
  assert.deepEqual(requestedControls, source)
})

test('rejects non-JSON requested control values before packaging', () => {
  const previs = normalizeSpatialPrevis({ projectId: 'project-1', updatedAt: '2026-09-09T00:00:00.000Z' })
  const capability = resolveSeedanceCapability({
    model: 'seedance-2.5',
    entryPoint: 'ark',
    entitlement: 'standard',
  })

  assert.throws(
    () => buildSeedanceTakePackage({
      previs,
      capability,
      deliveryMode: 'direct',
      requestedControls: [{
        id: 'unfreezable-map',
        kind: 'depth',
        value: new Map([['source', 'scene-depth-v1']]),
      } as never],
    }),
    /UNSUPPORTED_REQUESTED_CONTROL_VALUE/,
  )

  const cyclic: { self?: unknown } = {}
  cyclic.self = cyclic
  assert.throws(
    () => buildSeedanceTakePackage({
      previs,
      capability,
      deliveryMode: 'direct',
      requestedControls: [{
        id: 'cyclic-value',
        kind: 'depth',
        value: cyclic,
      } as never],
    }),
    /UNSUPPORTED_REQUESTED_CONTROL_VALUE/,
  )
})
