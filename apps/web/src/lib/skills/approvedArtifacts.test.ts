/**
 * Unit tests for approved Creator Skill artifact metadata.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/skills/approvedArtifacts.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { cloneCreatorSkillArtifact, isCreatorSkillArtifact } from './artifacts'
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

  test('ignores an inherited creatorSkill field without traversing prototypes', () => {
    const inheritedCreatorSkill = Object.create({
      creatorSkill: { approvedArtifact: createArtifact() },
    })

    assert.deepEqual(readApprovedCreatorSkillArtifact(inheritedCreatorSkill), {
      status: 'absent',
    })
  })

  test('does not invoke a self-returning prototype trap for a missing own field', () => {
    let prototypeReads = 0
    const metadata: object = new Proxy({}, {
      getPrototypeOf() {
        prototypeReads += 1
        if (prototypeReads > 2) throw new Error('bounded self-returning prototype trap')
        return metadata
      },
    })

    assert.deepEqual(readApprovedCreatorSkillArtifact(metadata), { status: 'absent' })
    assert.equal(prototypeReads, 0)
  })

  test('validates metadata containers as guarded plain records', () => {
    class MetadataRecord {
      creatorSkill = { approvedArtifact: createArtifact() }
    }

    const arrayMetadata: unknown[] & { creatorSkill?: unknown } = []
    arrayMetadata.creatorSkill = { approvedArtifact: createArtifact() }
    const nullPrototypeMetadata = Object.create(null) as Record<string, unknown>
    const nullPrototypeCreatorSkill = Object.create(null) as Record<string, unknown>
    nullPrototypeCreatorSkill.approvedArtifact = createArtifact()
    nullPrototypeMetadata.creatorSkill = nullPrototypeCreatorSkill

    assertInvalid(arrayMetadata)
    assertInvalid(new MetadataRecord())
    assert.equal(readApprovedCreatorSkillArtifact(nullPrototypeMetadata).status, 'valid')
  })

  test('contains metadata descriptor and prototype trap failures as invalid', () => {
    const descriptorFailure = new Proxy({}, {
      getOwnPropertyDescriptor() {
        throw new Error('descriptor trap')
      },
    })
    const prototypeFailure = new Proxy({
      creatorSkill: { approvedArtifact: createArtifact() },
    }, {
      getPrototypeOf() {
        throw new Error('prototype trap')
      },
    })

    assertInvalid(descriptorFailure)
    assertInvalid(prototypeFailure)
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

  test('sorts nested payload object keys for deterministic serialization', () => {
    const left = cloneCreatorSkillArtifact({
      ...createArtifact(),
      payload: {
        zebra: { yellow: 2, alpha: 1 },
        alpha: [{ delta: 4, beta: 2 }],
      },
    })
    const right = cloneCreatorSkillArtifact({
      ...createArtifact(),
      payload: {
        alpha: [{ beta: 2, delta: 4 }],
        zebra: { alpha: 1, yellow: 2 },
      },
    })

    assert.equal(JSON.stringify(left), JSON.stringify(right))
    assert.deepEqual(Object.keys(left.payload as object), ['alpha', 'zebra'])
    assert.deepEqual(Object.keys((left.payload as { zebra: object }).zebra), ['alpha', 'yellow'])
    assert.deepEqual(
      Object.keys((left.payload as { alpha: object[] }).alpha[0]!),
      ['beta', 'delta'],
    )
  })

  test('uses native sorting for a large reverse-inserted payload without mutating it', () => {
    const payload: Record<string, number> = {}
    for (let index = 2047; index >= 0; index -= 1) {
      payload[`key-${index.toString().padStart(4, '0')}`] = index
    }
    const inputKeys = Object.keys(payload)
    const inputSnapshot = { ...payload }
    const sortDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'sort')!
    const originalSort = Array.prototype.sort
    let nativeSortCalls = 0
    let clonedPayload: Record<string, number> | undefined

    Object.defineProperty(Array.prototype, 'sort', {
      ...sortDescriptor,
      value: function sort(
        this: unknown[],
        compareFn?: (left: unknown, right: unknown) => number,
      ) {
        nativeSortCalls += 1
        return Reflect.apply(originalSort, this, compareFn ? [compareFn] : [])
      },
    })
    try {
      clonedPayload = cloneCreatorSkillArtifact({
        ...createArtifact(),
        payload,
      }).payload as Record<string, number>
    } finally {
      Object.defineProperty(Array.prototype, 'sort', sortDescriptor)
    }

    assert.ok(clonedPayload)
    assert.ok(nativeSortCalls > 0)
    assert.deepEqual(Object.keys(clonedPayload), [...inputKeys].sort())
    assert.deepEqual(Object.keys(payload), inputKeys)
    assert.deepEqual(payload, inputSnapshot)
  })

  test('shares the exact canonical six-field rule with the artifact predicate', () => {
    const exact = createArtifact()
    const extraString = { ...createArtifact(), extra: true }
    const extraSymbol = createArtifact() as ReturnType<typeof createArtifact> & {
      [key: symbol]: boolean
    }
    extraSymbol[Symbol('extra')] = true

    assert.equal(isCreatorSkillArtifact(exact), true)
    assert.doesNotThrow(() => cloneCreatorSkillArtifact(exact))
    for (const artifact of [extraString, extraSymbol]) {
      assert.equal(isCreatorSkillArtifact(artifact), false)
      assert.throws(() => cloneCreatorSkillArtifact(artifact), TypeError)
    }
  })
})
