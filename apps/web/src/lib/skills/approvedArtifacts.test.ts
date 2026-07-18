/**
 * Unit tests for approved Creator Skill artifact metadata.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/skills/approvedArtifacts.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { cloneCreatorSkillArtifact } from './artifacts'
import { readApprovedCreatorSkillArtifact } from './approved-artifacts'

function createArtifact() {
  return {
    artifactId: 'artifact-1',
    artifactType: 'scene-list',
    artifactVersion: 1,
    sourceNodeIds: ['node-a', 'node-b'],
    sourceArtifactIds: ['source-1'],
    payload: {
      title: '  Exact payload text  ',
      scenes: [{ heading: 'INT. STUDIO - DAY', beats: [1, true, null] }],
    },
  }
}

function metadataWith(approvedArtifact: unknown): unknown {
  return { creatorSkill: { approvedArtifact } }
}

function assertInvalid(metadata: unknown) {
  const result = readApprovedCreatorSkillArtifact(metadata)
  assert.equal(result.status, 'invalid')
  if (result.status === 'invalid') {
    assert.equal(result.issue.code, 'APPROVED_ARTIFACT_INVALID')
    assert.ok(result.issue.message.length > 0)
  }
}

describe('readApprovedCreatorSkillArtifact', () => {
  test('returns absent for non-object metadata and missing own fields', () => {
    for (const metadata of [undefined, null, false, 1, 'metadata', {}, { creatorSkill: {} }]) {
      assert.deepEqual(readApprovedCreatorSkillArtifact(metadata), { status: 'absent' })
    }
  })

  test('returns a canonical artifact for valid metadata', () => {
    const result = readApprovedCreatorSkillArtifact(metadataWith(createArtifact()))

    assert.equal(result.status, 'valid')
    if (result.status === 'valid') {
      assert.deepEqual(result.artifact, createArtifact())
      assert.equal(result.artifact.payload && typeof result.artifact.payload, 'object')
    }
  })

  test('returns invalid for malformed present fields', () => {
    assertInvalid({ creatorSkill: null })
    assertInvalid({ creatorSkill: [] })
    assertInvalid(metadataWith(null))
    assertInvalid(metadataWith({ ...createArtifact(), artifactVersion: 0 }))
    assertInvalid(metadataWith({ ...createArtifact(), artifactId: ' artifact-1' }))
    assertInvalid(metadataWith({ ...createArtifact(), sourceNodeIds: ['node-b', 'node-a'] }))
  })

  test('returns invalid for inherited creatorSkill and approvedArtifact fields', () => {
    const inheritedCreatorSkill = Object.create({
      creatorSkill: { approvedArtifact: createArtifact() },
    })
    const inheritedApprovedArtifact = {
      creatorSkill: Object.create({ approvedArtifact: createArtifact() }),
    }

    assertInvalid(inheritedCreatorSkill)
    assertInvalid(inheritedApprovedArtifact)
  })

  test('returns invalid without invoking accessor-backed fields', () => {
    let reads = 0
    const metadata = {}
    Object.defineProperty(metadata, 'creatorSkill', {
      enumerable: true,
      get() {
        reads += 1
        throw new Error('creatorSkill getter must not run')
      },
    })
    const creatorSkill = {}
    Object.defineProperty(creatorSkill, 'approvedArtifact', {
      enumerable: true,
      get() {
        reads += 1
        throw new Error('approvedArtifact getter must not run')
      },
    })

    assertInvalid(metadata)
    assertInvalid({ creatorSkill })
    assert.equal(reads, 0)
  })

  test('contains hostile nested payloads without invoking getters or array hooks', () => {
    let calls = 0
    const payload = { safe: true }
    Object.defineProperty(payload, 'hostile', {
      enumerable: true,
      get() {
        calls += 1
        throw new Error('payload getter must not run')
      },
    })
    const values = [1, 2]
    for (const key of ['map', 'filter'] as const) {
      Object.defineProperty(values, key, {
        get() {
          calls += 1
          throw new Error(`${key} getter must not run`)
        },
      })
    }
    Object.defineProperty(values, Symbol.iterator, {
      get() {
        calls += 1
        throw new Error('iterator getter must not run')
      },
    })

    assertInvalid(metadataWith({ ...createArtifact(), payload }))
    assertInvalid(metadataWith({ ...createArtifact(), payload: values }))
    assert.equal(calls, 0)
  })

  test('returns invalid for sparse source ID and payload arrays', () => {
    const sparseSourceIds = new Array<string>(2)
    sparseSourceIds[1] = 'node-b'
    const sparsePayload = new Array<unknown>(2)
    sparsePayload[1] = 'scene'

    assertInvalid(metadataWith({ ...createArtifact(), sourceNodeIds: sparseSourceIds }))
    assertInvalid(metadataWith({ ...createArtifact(), payload: sparsePayload }))
    assertInvalid(metadataWith({ ...createArtifact(), payload: [undefined] }))
  })

  test('isolates the returned artifact from later caller mutation', () => {
    const source = createArtifact()
    const result = readApprovedCreatorSkillArtifact(metadataWith(source))
    assert.equal(result.status, 'valid')
    if (result.status !== 'valid') return

    source.sourceNodeIds[0] = 'changed'
    source.payload.scenes[0]!.heading = 'changed'

    assert.deepEqual(result.artifact.sourceNodeIds, ['node-a', 'node-b'])
    assert.deepEqual(result.artifact.payload, {
      title: '  Exact payload text  ',
      scenes: [{ heading: 'INT. STUDIO - DAY', beats: [1, true, null] }],
    })
  })

  test('returns deterministic fresh clones on every read', () => {
    const metadata = metadataWith(createArtifact())
    const first = readApprovedCreatorSkillArtifact(metadata)
    const second = readApprovedCreatorSkillArtifact(metadata)
    assert.equal(first.status, 'valid')
    assert.equal(second.status, 'valid')
    if (first.status !== 'valid' || second.status !== 'valid') return

    assert.deepEqual(first.artifact, second.artifact)
    assert.notEqual(first.artifact, second.artifact)
    assert.notEqual(first.artifact.sourceNodeIds, second.artifact.sourceNodeIds)
    assert.notEqual(first.artifact.payload, second.artifact.payload)
  })
})

describe('cloneCreatorSkillArtifact', () => {
  test('clones valid JSON-compatible data and preserves own __proto__ data safely', () => {
    const payload: Record<string, unknown> = { text: '  preserve me  ' }
    Object.defineProperty(payload, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
      writable: true,
    })

    const clone = cloneCreatorSkillArtifact({ ...createArtifact(), payload })
    const clonePayload = clone.payload as Record<string, unknown>

    assert.equal(clonePayload.text, '  preserve me  ')
    assert.equal(Object.prototype.hasOwnProperty.call(clonePayload, '__proto__'), true)
    assert.deepEqual(Object.getOwnPropertyDescriptor(clonePayload, '__proto__')?.value, {
      polluted: true,
    })
    assert.equal(({} as { polluted?: boolean }).polluted, undefined)
  })

  test('rejects invalid artifact fields with controlled TypeErrors', () => {
    const valid = createArtifact()
    const inherited = Object.create({ artifactId: valid.artifactId })
    Object.assign(inherited, valid)
    delete inherited.artifactId

    const invalidValues: unknown[] = [
      null,
      [],
      { ...valid, artifactVersion: Number.NaN },
      { ...valid, artifactVersion: 1.5 },
      { ...valid, sourceNodeIds: ['node-a', 'node-a'] },
      { ...valid, sourceNodeIds: [' node-a'] },
      inherited,
    ]

    for (const value of invalidValues) {
      assert.throws(() => cloneCreatorSkillArtifact(value), TypeError)
    }
  })

  test('rejects non-JSON payload values and descriptors with controlled TypeErrors', () => {
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    const symbolKeyed = { safe: true }
    Object.defineProperty(symbolKeyed, Symbol('hidden'), { value: true, enumerable: true })
    const accessor = {}
    Object.defineProperty(accessor, 'value', { enumerable: true, get: () => 'no' })

    const invalidPayloads: unknown[] = [
      undefined,
      Symbol('value'),
      BigInt(1),
      () => true,
      Number.POSITIVE_INFINITY,
      new Date(0),
      new Map(),
      cycle,
      symbolKeyed,
      accessor,
    ]

    for (const payload of invalidPayloads) {
      assert.throws(
        () => cloneCreatorSkillArtifact({ ...createArtifact(), payload }),
        TypeError,
      )
    }
  })
})
