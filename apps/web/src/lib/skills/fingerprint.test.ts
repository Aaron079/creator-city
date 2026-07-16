/**
 * Unit tests for executable Creator Skill artifacts and fingerprints.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/skills/fingerprint.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  createCreatorSkillArtifact,
  isCreatorSkillArtifact,
} from './artifacts'
import { createCreatorSkillFingerprint } from './fingerprint'
import type {
  CreatorExecutableSkill,
  CreatorSkillManifest,
  CreatorSkillRunInput,
  CreatorSkillRunResult,
} from './types'

function createInput(): CreatorSkillRunInput {
  return {
    sourceNodes: [
      {
        id: 'node-b',
        kind: 'text',
        title: 'Second beat',
        prompt: 'Keep  the deliberate spacing.',
        metadataJson: {
          framing: { lens: '50mm', angle: 'low' },
          sequence: 2,
        },
      },
      {
        id: 'node-a',
        kind: 'text',
        title: 'First beat',
        prompt: 'Start here.',
        resultText: 'A quiet opening.',
      },
    ],
    artifacts: [
      {
        artifactId: 'artifact-b',
        artifactType: 'scene-list',
        artifactVersion: 1,
        sourceNodeIds: ['node-b'],
        sourceArtifactIds: [],
        payload: { scenes: ['arrival', 'departure'] },
      },
      {
        artifactId: 'artifact-a',
        artifactType: 'character-list',
        artifactVersion: 1,
        sourceNodeIds: ['node-a'],
        sourceArtifactIds: [],
        payload: { characters: ['Mara', 'Ivo'] },
      },
    ],
    projectContext: {
      projectId: 'project-1',
      workflowId: 'workflow-1',
    },
    options: {
      strict: true,
      limits: { scenes: 12, characters: 8 },
    },
  }
}

describe('executable Creator Skill contracts', () => {
  test('exposes the exact manifest, artifact, and run-result field names', () => {
    const manifest = {
      id: 'script-analysis',
      version: '1.0.0',
      name: 'Script analysis',
      description: 'Analyzes a script locally.',
      category: 'story',
      executionPolicy: 'deterministic-local',
      acceptedNodeKinds: ['text'],
      acceptedArtifactTypes: ['script'],
      outputArtifactTypes: ['scene-list'],
      independentlyCallable: true,
    } satisfies CreatorSkillManifest
    const artifact = createCreatorSkillArtifact({
      artifactId: 'artifact-1',
      artifactType: 'scene-list',
      artifactVersion: 1,
      sourceNodeIds: ['node-a'],
      payload: {},
    })
    const runResult: CreatorSkillRunResult = {
      skillId: manifest.id,
      skillVersion: manifest.version,
      runFingerprint: 'csf1_12345678',
      status: 'ready',
      artifacts: [artifact],
      evidence: [],
      warnings: [],
      blockers: [],
    }
    const executableSkill: CreatorExecutableSkill = {
      manifest,
      run: () => runResult,
    }
    const synchronousResult: CreatorSkillRunResult = executableSkill.run(
      createInput(),
      runResult.runFingerprint,
    )

    assert.deepEqual(Object.keys(manifest), [
      'id',
      'version',
      'name',
      'description',
      'category',
      'executionPolicy',
      'acceptedNodeKinds',
      'acceptedArtifactTypes',
      'outputArtifactTypes',
      'independentlyCallable',
    ])
    assert.deepEqual(Object.keys(artifact), [
      'artifactId',
      'artifactType',
      'artifactVersion',
      'sourceNodeIds',
      'sourceArtifactIds',
      'payload',
    ])
    assert.deepEqual(Object.keys(synchronousResult), [
      'skillId',
      'skillVersion',
      'runFingerprint',
      'status',
      'artifacts',
      'evidence',
      'warnings',
      'blockers',
    ])
  })
})

describe('createCreatorSkillFingerprint', () => {
  test('matches the golden FNV-1a fingerprint for an exact canonical input', () => {
    const input: CreatorSkillRunInput = {
      sourceNodes: [
        {
          id: 'node-1',
          kind: 'text',
          title: 'Opening',
          prompt: 'Hello',
        },
      ],
    }

    assert.equal(
      createCreatorSkillFingerprint('golden-skill', '1.0.0', input),
      'csf1_210df68c',
    )
  })

  test('is independent of option key order', () => {
    const left = createInput()
    const right = createInput()
    left.options = { strict: true, limits: { scenes: 12, characters: 8 } }
    right.options = { limits: { characters: 8, scenes: 12 }, strict: true }

    assert.equal(
      createCreatorSkillFingerprint('script-analysis', '1.0.0', left),
      createCreatorSkillFingerprint('script-analysis', '1.0.0', right),
    )
  })

  test('is independent of source node order', () => {
    const left = createInput()
    const right = createInput()
    right.sourceNodes = [...right.sourceNodes].reverse()

    assert.equal(
      createCreatorSkillFingerprint('script-analysis', '1.0.0', left),
      createCreatorSkillFingerprint('script-analysis', '1.0.0', right),
    )
  })

  test('is independent of artifact order by artifactType then artifactId', () => {
    const left = createInput()
    const right = createInput()
    right.artifacts = [...(right.artifacts ?? [])].reverse()

    assert.equal(
      createCreatorSkillFingerprint('script-analysis', '1.0.0', left),
      createCreatorSkillFingerprint('script-analysis', '1.0.0', right),
    )
  })

  test('sorts artifact type and id independently without delimiter collisions', () => {
    const left = createInput()
    left.artifacts = [
      {
        artifactId: 'b\0c',
        artifactType: 'a',
        artifactVersion: 1,
        sourceNodeIds: [],
        sourceArtifactIds: [],
        payload: {},
      },
      {
        artifactId: 'c',
        artifactType: 'a\0b',
        artifactVersion: 1,
        sourceNodeIds: [],
        sourceArtifactIds: [],
        payload: {},
      },
    ]
    const right = createInput()
    right.artifacts = [...left.artifacts].reverse()

    assert.equal(
      createCreatorSkillFingerprint('script-analysis', '1.0.0', left),
      createCreatorSkillFingerprint('script-analysis', '1.0.0', right),
    )
  })

  test('rejects duplicate source node ids', () => {
    const input = createInput()
    const firstNode = input.sourceNodes[0]
    assert.ok(firstNode)
    input.sourceNodes.push({ ...firstNode, title: 'Duplicate identity' })

    assert.throws(
      () => createCreatorSkillFingerprint('script-analysis', '1.0.0', input),
      { name: 'TypeError', message: /Duplicate source node id: node-b/ },
    )
  })

  test('rejects duplicate artifact type and id identity pairs', () => {
    const input = createInput()
    const firstArtifact = input.artifacts?.[0]
    assert.ok(firstArtifact)
    input.artifacts?.push({ ...firstArtifact, payload: { duplicate: true } })

    assert.throws(
      () => createCreatorSkillFingerprint('script-analysis', '1.0.0', input),
      { name: 'TypeError', message: /Duplicate artifact identity: scene-list, artifact-b/ },
    )
  })

  test('is independent of nested metadata key order', () => {
    const left = createInput()
    const right = createInput()
    const leftNode = left.sourceNodes[0]
    const rightNode = right.sourceNodes[0]
    assert.ok(leftNode)
    assert.ok(rightNode)
    leftNode.metadataJson = {
      sequence: 2,
      framing: { angle: 'low', lens: '50mm' },
    }
    rightNode.metadataJson = {
      framing: { lens: '50mm', angle: 'low' },
      sequence: 2,
    }

    assert.equal(
      createCreatorSkillFingerprint('script-analysis', '1.0.0', left),
      createCreatorSkillFingerprint('script-analysis', '1.0.0', right),
    )
  })

  test('omits undefined object properties', () => {
    const left = createInput()
    const right = createInput()
    const rightNode = right.sourceNodes[0]
    assert.ok(rightNode)
    right.options = { ...right.options, transient: undefined }
    rightNode.resultText = undefined

    assert.equal(
      createCreatorSkillFingerprint('script-analysis', '1.0.0', left),
      createCreatorSkillFingerprint('script-analysis', '1.0.0', right),
    )
  })

  test('accepts JSON-compatible primitives, arrays, and null-prototype objects', () => {
    const nullPrototypeOptions = Object.create(null) as Record<string, unknown>
    nullPrototypeOptions.values = [null, true, 'text', 42, undefined]
    nullPrototypeOptions.nested = Object.assign(Object.create(null), { enabled: false })
    const left = createInput()
    left.options = nullPrototypeOptions
    const right = createInput()
    right.options = {
      values: [null, true, 'text', 42],
      nested: { enabled: false },
    }

    assert.equal(
      createCreatorSkillFingerprint('script-analysis', '1.0.0', left),
      createCreatorSkillFingerprint('script-analysis', '1.0.0', right),
    )
  })

  test('rejects unsupported primitive and object values with controlled errors', () => {
    class UnsupportedInstance {}
    const unsupportedValues: Array<[string, unknown]> = [
      ['function', () => undefined],
      ['symbol', Symbol('unsupported')],
      ['Date', new Date('2026-01-01T00:00:00.000Z')],
      ['Map', new Map([['key', 'value']])],
      ['Set', new Set(['value'])],
      ['RegExp', /value/],
      ['class instance', new UnsupportedInstance()],
    ]

    for (const [label, value] of unsupportedValues) {
      const input = createInput()
      input.options = { value }
      assert.throws(
        () => createCreatorSkillFingerprint('script-analysis', '1.0.0', input),
        { name: 'TypeError', message: /Unsupported fingerprint value/ },
        label,
      )
    }
  })

  test('rejects non-finite numbers with controlled errors', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const input = createInput()
      input.options = { value }
      assert.throws(
        () => createCreatorSkillFingerprint('script-analysis', '1.0.0', input),
        { name: 'TypeError', message: /Fingerprint numbers must be finite/ },
      )
    }
  })

  test('rejects bigint values with controlled errors', () => {
    const input = createInput()
    input.options = { value: BigInt(1) }

    assert.throws(
      () => createCreatorSkillFingerprint('script-analysis', '1.0.0', input),
      { name: 'TypeError', message: /Unsupported fingerprint value: bigint/ },
    )
  })

  test('rejects cyclic inputs with a controlled error', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const input = createInput()
    input.options = cyclic

    assert.throws(
      () => createCreatorSkillFingerprint('script-analysis', '1.0.0', input),
      { name: 'TypeError', message: /Cyclic fingerprint input/ },
    )
  })

  test('changes when the skill version changes', () => {
    const input = createInput()

    assert.notEqual(
      createCreatorSkillFingerprint('script-analysis', '1.0.0', input),
      createCreatorSkillFingerprint('script-analysis', '2.0.0', input),
    )
  })

  test('preserves exact Unicode strings without NFC normalization', () => {
    const left = createInput()
    const right = createInput()
    const leftNode = left.sourceNodes[0]
    const rightNode = right.sourceNodes[0]
    assert.ok(leftNode)
    assert.ok(rightNode)
    leftNode.prompt = 'Cafe\u0301'
    rightNode.prompt = 'Caf\u00e9'

    assert.notEqual(
      createCreatorSkillFingerprint('script-analysis', '1.0.0', left),
      createCreatorSkillFingerprint('script-analysis', '1.0.0', right),
    )
  })

  test('preserves meaningful whitespace differences', () => {
    const left = createInput()
    const right = createInput()
    const rightNode = right.sourceNodes[0]
    assert.ok(rightNode)
    rightNode.prompt = 'Keep the deliberate spacing.'

    assert.notEqual(
      createCreatorSkillFingerprint('script-analysis', '1.0.0', left),
      createCreatorSkillFingerprint('script-analysis', '1.0.0', right),
    )
  })

  test('preserves payload array order', () => {
    const left = createInput()
    const right = createInput()
    const rightArtifact = right.artifacts?.[0]
    assert.ok(rightArtifact)
    const payload = rightArtifact.payload as { scenes: string[] }
    payload.scenes.reverse()

    assert.notEqual(
      createCreatorSkillFingerprint('script-analysis', '1.0.0', left),
      createCreatorSkillFingerprint('script-analysis', '1.0.0', right),
    )
  })

  test('returns the same prefixed eight-digit hash on repeated calls', () => {
    const input = createInput()
    const first = createCreatorSkillFingerprint('script-analysis', '1.0.0', input)

    assert.match(first, /^csf1_[0-9a-f]{8}$/)
    assert.equal(first, createCreatorSkillFingerprint('script-analysis', '1.0.0', input))
    assert.equal(first, createCreatorSkillFingerprint('script-analysis', '1.0.0', input))
  })

  test('does not read runtime clocks, randomness, or mutate its input', () => {
    const input = createInput()
    const original = structuredClone(input)
    const originalDateNow = Date.now
    const originalRandom = Math.random
    Date.now = () => { throw new Error('Date.now must not be used') }
    Math.random = () => { throw new Error('Math.random must not be used') }

    try {
      assert.doesNotThrow(() => createCreatorSkillFingerprint('script-analysis', '1.0.0', input))
      assert.deepEqual(input, original)
    } finally {
      Date.now = originalDateNow
      Math.random = originalRandom
    }
  })
})

describe('Creator Skill artifacts', () => {
  test('trims identifiers and sorts and deduplicates source identifiers', () => {
    const artifact = createCreatorSkillArtifact({
      artifactId: '  artifact-1  ',
      artifactType: '  scene-list  ',
      artifactVersion: 1,
      sourceNodeIds: [' node-b ', 'node-a', 'node-b'],
      sourceArtifactIds: [' parent-b ', 'parent-a', 'parent-b'],
      payload: { scenes: ['one', 'two'] },
    })

    assert.deepEqual(artifact, {
      artifactId: 'artifact-1',
      artifactType: 'scene-list',
      artifactVersion: 1,
      sourceNodeIds: ['node-a', 'node-b'],
      sourceArtifactIds: ['parent-a', 'parent-b'],
      payload: { scenes: ['one', 'two'] },
    })
    assert.equal(isCreatorSkillArtifact(artifact), true)
  })

  test('defaults optional source artifact identifiers to an empty array', () => {
    const artifact = createCreatorSkillArtifact({
      artifactId: 'artifact-1',
      artifactType: 'scene-list',
      artifactVersion: 1,
      sourceNodeIds: [],
      payload: {},
    })

    assert.deepEqual(artifact.sourceArtifactIds, [])
  })

  test('does not mutate the input or reuse its source id arrays', () => {
    const sourceNodeIds = [' node-b ', 'node-a']
    const sourceArtifactIds = [' parent-b ', 'parent-a']
    const input = {
      artifactId: ' artifact-1 ',
      artifactType: ' scene-list ',
      artifactVersion: 1,
      sourceNodeIds,
      sourceArtifactIds,
      payload: ['first', 'second'],
    }
    const original = structuredClone(input)
    const artifact = createCreatorSkillArtifact(input)

    assert.deepEqual(input, original)
    assert.notEqual(artifact.sourceNodeIds, sourceNodeIds)
    assert.notEqual(artifact.sourceArtifactIds, sourceArtifactIds)
  })

  test('rejects empty artifact and source identifiers', () => {
    const valid = {
      artifactId: 'artifact-1',
      artifactType: 'scene-list',
      artifactVersion: 1,
      sourceNodeIds: ['node-a'],
      sourceArtifactIds: [] as string[],
      payload: {},
    }

    assert.throws(() => createCreatorSkillArtifact({ ...valid, artifactId: '  ' }), /artifactId/)
    assert.throws(() => createCreatorSkillArtifact({ ...valid, artifactType: '' }), /artifactType/)
    assert.throws(() => createCreatorSkillArtifact({ ...valid, sourceNodeIds: [''] }), /sourceNodeIds/)
    assert.throws(() => createCreatorSkillArtifact({ ...valid, sourceArtifactIds: ['  '] }), /sourceArtifactIds/)
  })

  test('rejects non-positive and non-integer artifact versions', () => {
    const valid = {
      artifactId: 'artifact-1',
      artifactType: 'scene-list',
      sourceNodeIds: [] as string[],
      sourceArtifactIds: [] as string[],
      payload: {},
    }

    assert.throws(() => createCreatorSkillArtifact({ ...valid, artifactVersion: 0 }), /artifactVersion/)
    assert.throws(() => createCreatorSkillArtifact({ ...valid, artifactVersion: -1 }), /artifactVersion/)
    assert.throws(() => createCreatorSkillArtifact({ ...valid, artifactVersion: 1.5 }), /artifactVersion/)
  })

  test('recognizes only structurally valid artifacts with exact field names', () => {
    assert.equal(isCreatorSkillArtifact(null), false)
    assert.equal(isCreatorSkillArtifact({}), false)
    assert.equal(isCreatorSkillArtifact({
      artifactId: 'artifact-1',
      type: 'scene-list',
      version: 1,
      sourceNodeIds: [],
      sourceArtifactIds: [],
      payload: {},
    }), false)
    assert.equal(isCreatorSkillArtifact({
      artifactId: 'artifact-1',
      artifactType: 'scene-list',
      artifactVersion: 0,
      sourceNodeIds: [],
      sourceArtifactIds: [],
      payload: {},
    }), false)
    assert.equal(isCreatorSkillArtifact({
      artifactId: 'artifact-1',
      artifactType: 'scene-list',
      artifactVersion: 1,
      sourceNodeIds: [''],
      sourceArtifactIds: [],
      payload: {},
    }), false)
  })

  test('rejects untrimmed artifact and source identifiers', () => {
    const valid = {
      artifactId: 'artifact-1',
      artifactType: 'scene-list',
      artifactVersion: 1,
      sourceNodeIds: ['node-a'],
      sourceArtifactIds: ['parent-a'],
      payload: {},
    }

    assert.equal(isCreatorSkillArtifact({ ...valid, artifactId: ' artifact-1' }), false)
    assert.equal(isCreatorSkillArtifact({ ...valid, artifactType: 'scene-list ' }), false)
    assert.equal(isCreatorSkillArtifact({ ...valid, sourceNodeIds: [' node-a'] }), false)
    assert.equal(isCreatorSkillArtifact({ ...valid, sourceArtifactIds: ['parent-a '] }), false)
  })

  test('rejects source identifier arrays that are unsorted or contain duplicates', () => {
    const valid = {
      artifactId: 'artifact-1',
      artifactType: 'scene-list',
      artifactVersion: 1,
      sourceNodeIds: ['node-a'],
      sourceArtifactIds: ['parent-a'],
      payload: {},
    }

    assert.equal(isCreatorSkillArtifact({ ...valid, sourceNodeIds: ['node-b', 'node-a'] }), false)
    assert.equal(isCreatorSkillArtifact({ ...valid, sourceNodeIds: ['node-a', 'node-a'] }), false)
    assert.equal(isCreatorSkillArtifact({ ...valid, sourceArtifactIds: ['parent-b', 'parent-a'] }), false)
    assert.equal(isCreatorSkillArtifact({ ...valid, sourceArtifactIds: ['parent-a', 'parent-a'] }), false)
  })

  test('rejects artifacts with an undefined payload', () => {
    assert.equal(isCreatorSkillArtifact({
      artifactId: 'artifact-1',
      artifactType: 'scene-list',
      artifactVersion: 1,
      sourceNodeIds: [],
      sourceArtifactIds: [],
      payload: undefined,
    }), false)
  })
})
