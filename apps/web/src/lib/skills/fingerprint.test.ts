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
import type { CreatorSkillRunInput } from './types'

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
        type: 'scene-list',
        version: 1,
        sourceNodeIds: ['node-b'],
        sourceArtifactIds: [],
        payload: { scenes: ['arrival', 'departure'] },
      },
      {
        artifactId: 'artifact-a',
        type: 'character-list',
        version: 1,
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

describe('createCreatorSkillFingerprint', () => {
  test('is independent of option key order', () => {
    const left = createInput()
    const right = createInput()
    left.options = { strict: true, limits: { scenes: 12, characters: 8 } }
    right.options = { limits: { characters: 8, scenes: 12 }, strict: true }

    assert.equal(
      createCreatorSkillFingerprint('script-analysis', 1, left),
      createCreatorSkillFingerprint('script-analysis', 1, right),
    )
  })

  test('is independent of source node order', () => {
    const left = createInput()
    const right = createInput()
    right.sourceNodes = [...right.sourceNodes].reverse()

    assert.equal(
      createCreatorSkillFingerprint('script-analysis', 1, left),
      createCreatorSkillFingerprint('script-analysis', 1, right),
    )
  })

  test('is independent of artifact order by type and artifact id', () => {
    const left = createInput()
    const right = createInput()
    right.artifacts = [...(right.artifacts ?? [])].reverse()

    assert.equal(
      createCreatorSkillFingerprint('script-analysis', 1, left),
      createCreatorSkillFingerprint('script-analysis', 1, right),
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
      createCreatorSkillFingerprint('script-analysis', 1, left),
      createCreatorSkillFingerprint('script-analysis', 1, right),
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
      createCreatorSkillFingerprint('script-analysis', 1, left),
      createCreatorSkillFingerprint('script-analysis', 1, right),
    )
  })

  test('changes when the skill version changes', () => {
    const input = createInput()

    assert.notEqual(
      createCreatorSkillFingerprint('script-analysis', 1, input),
      createCreatorSkillFingerprint('script-analysis', 2, input),
    )
  })

  test('preserves meaningful text differences', () => {
    const left = createInput()
    const right = createInput()
    const rightNode = right.sourceNodes[0]
    assert.ok(rightNode)
    rightNode.prompt = 'Keep the deliberate spacing.'

    assert.notEqual(
      createCreatorSkillFingerprint('script-analysis', 1, left),
      createCreatorSkillFingerprint('script-analysis', 1, right),
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
      createCreatorSkillFingerprint('script-analysis', 1, left),
      createCreatorSkillFingerprint('script-analysis', 1, right),
    )
  })

  test('returns the same prefixed eight-digit hash on repeated calls', () => {
    const input = createInput()
    const first = createCreatorSkillFingerprint('script-analysis', 1, input)

    assert.match(first, /^csf1_[0-9a-f]{8}$/)
    assert.equal(first, createCreatorSkillFingerprint('script-analysis', 1, input))
    assert.equal(first, createCreatorSkillFingerprint('script-analysis', 1, input))
  })

  test('does not read runtime clocks, randomness, or mutate its input', () => {
    const input = createInput()
    const original = structuredClone(input)
    const originalDateNow = Date.now
    const originalRandom = Math.random
    Date.now = () => { throw new Error('Date.now must not be used') }
    Math.random = () => { throw new Error('Math.random must not be used') }

    try {
      assert.doesNotThrow(() => createCreatorSkillFingerprint('script-analysis', 1, input))
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
      type: '  scene-list  ',
      version: 1,
      sourceNodeIds: [' node-b ', 'node-a', 'node-b'],
      sourceArtifactIds: [' parent-b ', 'parent-a', 'parent-b'],
      payload: { scenes: ['one', 'two'] },
    })

    assert.deepEqual(artifact, {
      artifactId: 'artifact-1',
      type: 'scene-list',
      version: 1,
      sourceNodeIds: ['node-a', 'node-b'],
      sourceArtifactIds: ['parent-a', 'parent-b'],
      payload: { scenes: ['one', 'two'] },
    })
    assert.equal(isCreatorSkillArtifact(artifact), true)
  })

  test('does not mutate the input or reuse its source id arrays', () => {
    const sourceNodeIds = [' node-b ', 'node-a']
    const sourceArtifactIds = [' parent-b ', 'parent-a']
    const input = {
      artifactId: ' artifact-1 ',
      type: ' scene-list ',
      version: 1,
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
      type: 'scene-list',
      version: 1,
      sourceNodeIds: ['node-a'],
      sourceArtifactIds: [] as string[],
      payload: {},
    }

    assert.throws(() => createCreatorSkillArtifact({ ...valid, artifactId: '  ' }), /artifactId/)
    assert.throws(() => createCreatorSkillArtifact({ ...valid, type: '' }), /type/)
    assert.throws(() => createCreatorSkillArtifact({ ...valid, sourceNodeIds: [''] }), /sourceNodeIds/)
    assert.throws(() => createCreatorSkillArtifact({ ...valid, sourceArtifactIds: ['  '] }), /sourceArtifactIds/)
  })

  test('rejects non-positive and non-integer versions', () => {
    const valid = {
      artifactId: 'artifact-1',
      type: 'scene-list',
      sourceNodeIds: [] as string[],
      sourceArtifactIds: [] as string[],
      payload: {},
    }

    assert.throws(() => createCreatorSkillArtifact({ ...valid, version: 0 }), /version/)
    assert.throws(() => createCreatorSkillArtifact({ ...valid, version: -1 }), /version/)
    assert.throws(() => createCreatorSkillArtifact({ ...valid, version: 1.5 }), /version/)
  })

  test('recognizes only structurally valid artifacts', () => {
    assert.equal(isCreatorSkillArtifact(null), false)
    assert.equal(isCreatorSkillArtifact({}), false)
    assert.equal(isCreatorSkillArtifact({
      artifactId: 'artifact-1',
      type: 'scene-list',
      version: 0,
      sourceNodeIds: [],
      sourceArtifactIds: [],
      payload: {},
    }), false)
    assert.equal(isCreatorSkillArtifact({
      artifactId: 'artifact-1',
      type: 'scene-list',
      version: 1,
      sourceNodeIds: [''],
      sourceArtifactIds: [],
      payload: {},
    }), false)
  })
})
