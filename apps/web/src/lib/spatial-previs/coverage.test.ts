import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { assessAuthoringRisks } from './coverage'
import type { SpatialCoverage, Vec3 } from './types'

const constrainedCoverage: SpatialCoverage = {
  mode: 'constrained',
  cameraFreedom: 'corridor-only',
  corridor: {
    min: { x: -12, y: 0, z: -12 },
    max: { x: 12, y: 12, z: 12 },
  },
}

describe('authoring coverage risks', () => {
  test('allows camera positions inside a constrained corridor', () => {
    assert.deepEqual(assessAuthoringRisks(constrainedCoverage, [
      { x: -12, y: 0, z: -12 },
      { x: 12, y: 12, z: 12 },
    ]), [])
  })

  test('warns once when a camera position leaves a constrained corridor', () => {
    const cameraPositions: Vec3[] = [
      { x: 0, y: 2, z: 8 },
      { x: 13, y: 2, z: 8 },
      { x: -13, y: 2, z: 8 },
    ]
    const source = structuredClone(cameraPositions)

    const risks = assessAuthoringRisks(constrainedCoverage, cameraPositions)

    assert.equal(risks.length, 1)
    assert.equal(risks[0]?.code, 'CAMERA_OUTSIDE_COVERAGE')
    assert.equal(risks[0]?.blocking, false)
    assert.equal(typeof risks[0]?.message, 'string')
    assert.equal(typeof risks[0]?.remedy, 'string')
    assert.deepEqual(cameraPositions, source)
  })

  test('does not warn for verified coverage', () => {
    const coverage: SpatialCoverage = { mode: 'verified', cameraFreedom: 'full' }

    assert.deepEqual(assessAuthoringRisks(coverage, [{ x: 100, y: 100, z: 100 }]), [])
  })

  test('warns about camera positions in unavailable coverage without blocking edits', () => {
    const coverage: SpatialCoverage = { mode: 'unavailable', cameraFreedom: 'disabled' }

    const risks = assessAuthoringRisks(coverage, [{ x: 0, y: 2, z: 8 }])

    assert.equal(risks.length, 1)
    assert.equal(risks[0]?.code, 'CAMERA_IN_UNAVAILABLE_COVERAGE')
    assert.equal(risks[0]?.blocking, false)
  })
})
