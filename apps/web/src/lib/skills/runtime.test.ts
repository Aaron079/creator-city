/**
 * Unit tests for the independently callable Creator Skill registry and runtime.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/skills/runtime.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createCreatorSkillArtifact } from './artifacts'
import {
  CREATOR_EXECUTABLE_SKILL_REGISTRY,
  createCreatorExecutableSkillRegistry,
  getExecutableCreatorSkill,
  getExecutableCreatorSkillFromRegistry,
} from './executable-registry'
import { CREATOR_SKILL_REGISTRY } from './registry'
import { runCreatorSkill, runCreatorSkillFromRegistry } from './runtime'
import type {
  CreatorExecutableSkill,
  CreatorSkillManifest,
  CreatorSkillRunInput,
  CreatorSkillRunResult,
} from './types'

const BASE_MANIFEST: CreatorSkillManifest = {
  id: 'test-skill',
  version: '1.0.0',
  name: 'Test skill',
  description: 'A deterministic test skill.',
  category: 'story',
  executionPolicy: 'deterministic-local',
  acceptedNodeKinds: ['text'],
  acceptedArtifactTypes: ['script'],
  outputArtifactTypes: ['scene-list'],
  independentlyCallable: true,
}

function createInput(): CreatorSkillRunInput {
  return {
    sourceNodes: [
      {
        id: 'node-b',
        kind: 'text',
        title: 'Second',
        prompt: 'Keep  prompt spacing.\nAnd line breaks.',
        resultText: 'Keep  result spacing too.',
        metadataJson: { nested: { value: 2 } },
      },
      {
        id: 'node-a',
        kind: 'text',
        title: 'First',
        prompt: 'Opening prompt.',
        metadataJson: { nested: { value: 1 } },
      },
    ],
    artifacts: [
      createCreatorSkillArtifact({
        artifactId: 'script-1',
        artifactType: 'script',
        artifactVersion: 1,
        sourceNodeIds: ['node-a', 'node-b'],
        payload: { acts: [{ title: 'Act 1' }] },
      }),
    ],
    projectContext: {
      projectId: 'project-1',
      workflowId: 'workflow-1',
    },
    options: {
      nested: { enabled: true },
      values: ['one', { two: 2 }],
    },
  }
}

function createSceneBreakdownArtifact() {
  const sourceText = [
    'EXT. ROOFTOP - NIGHT',
    'Maya opens the antenna box.',
    'Leo gasps and steps back.',
  ].join('\n')
  return createCreatorSkillArtifact({
    artifactId: 'approved-scene-breakdown-002',
    artifactType: 'scene-breakdown',
    artifactVersion: 1,
    sourceNodeIds: ['original-script-node'],
    payload: {
      format: 'headed-script',
      scenes: [{
        sceneId: 'scene-002',
        order: 2,
        heading: 'EXT. ROOFTOP - NIGHT',
        location: 'ROOFTOP',
        timeOfDay: 'NIGHT',
        characters: ['MAYA', 'LEO'],
        actionSummary: 'Maya opens the antenna box.',
        sourceText,
        lineStart: 14,
        lineEnd: 16,
        reviewStatus: 'pending',
      }],
    },
  })
}

function createNarrativeBeatArtifact() {
  return createCreatorSkillArtifact({
    artifactId: 'approved-narrative-beat-map-002',
    artifactType: 'narrative-beat-map',
    artifactVersion: 1,
    sourceNodeIds: ['original-script-node'],
    sourceArtifactIds: ['approved-scene-breakdown-002'],
    payload: {
      scenes: [{
        sceneId: 'scene-002',
        order: 2,
        heading: 'EXT. ROOFTOP - NIGHT',
        beats: [{
          beatId: 'scene-002-beat-001',
          sceneId: 'scene-002',
          order: 1,
          type: 'action',
          sourceText: 'Maya opens the antenna box.',
          summary: 'Maya opens the antenna box.',
          lineStart: 15,
          lineEnd: 15,
          reviewStatus: 'pending',
        }],
      }],
    },
  })
}

function createOwnProtoRecord(value: unknown): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  Object.defineProperty(record, '__proto__', {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  })
  return record
}

function createResult(
  skillId: string,
  skillVersion: string,
  fingerprint: string,
): CreatorSkillRunResult {
  return {
    skillId,
    skillVersion,
    runFingerprint: fingerprint,
    status: 'ready',
    artifacts: [
      createCreatorSkillArtifact({
        artifactId: 'scenes-1',
        artifactType: 'scene-list',
        artifactVersion: 1,
        sourceNodeIds: ['node-a', 'node-b'],
        sourceArtifactIds: ['script-1'],
        payload: { scenes: ['Opening', 'Closing'] },
      }),
    ],
    evidence: [],
    warnings: [],
    blockers: [],
  }
}

function createSkill(
  manifest: Partial<CreatorSkillManifest> = {},
  run: CreatorExecutableSkill['run'] = (_input, fingerprint) => (
    createResult(
      manifest.id ?? BASE_MANIFEST.id,
      manifest.version ?? BASE_MANIFEST.version,
      fingerprint,
    )
  ),
): CreatorExecutableSkill {
  return {
    manifest: {
      ...BASE_MANIFEST,
      acceptedNodeKinds: [...BASE_MANIFEST.acceptedNodeKinds],
      acceptedArtifactTypes: [...BASE_MANIFEST.acceptedArtifactTypes],
      outputArtifactTypes: [...BASE_MANIFEST.outputArtifactTypes],
      ...manifest,
    },
    run,
  }
}

function assertBlocked(result: CreatorSkillRunResult, code: string) {
  assert.equal(result.status, 'blocked')
  assert.deepEqual(result.artifacts, [])
  assert.equal(result.blockers.length, 1)
  assert.equal(result.blockers[0]?.code, code)
  assert.match(result.runFingerprint, /^csf1_[0-9a-f]{8}$/)
}

describe('createCreatorExecutableSkillRegistry', () => {
  test('rejects duplicate id and version registrations after ID normalization', () => {
    assert.throws(
      () => createCreatorExecutableSkillRegistry([
        createSkill({ id: 'duplicate' }),
        createSkill({ id: ' duplicate ' }),
      ]),
      { name: 'TypeError', message: /Duplicate executable Creator Skill: duplicate@1\.0\.0/ },
    )
  })

  test('rejects invalid manifest identity, policy, callability, and output types', () => {
    const invalidSkills: Array<[string, CreatorExecutableSkill]> = [
      ['blank ID', createSkill({ id: '   ' })],
      ['blank name', createSkill({ name: '   ' })],
      ['blank description', createSkill({ description: '   ' })],
      ['invalid category', createSkill({ category: 'invalid' } as never)],
      ['invalid version', createSkill({ version: '1.0' })],
      ['prerelease version', createSkill({ version: '1.0.0-beta.1' })],
      ['non-local policy', createSkill({ executionPolicy: 'external-media' })],
      ['not independently callable', createSkill({ independentlyCallable: false } as never)],
      ['empty output types', createSkill({ outputArtifactTypes: [] })],
      ['blank output type', createSkill({ outputArtifactTypes: [' '] })],
      ['sparse accepted node kinds', createSkill({ acceptedNodeKinds: new Array<'text'>(1) })],
      ['sparse accepted Artifact types', createSkill({
        acceptedArtifactTypes: new Array<string>(1),
      })],
      ['sparse output Artifact types', createSkill({
        outputArtifactTypes: new Array<string>(1),
      })],
    ]

    for (const [label, skill] of invalidSkills) {
      assert.throws(
        () => createCreatorExecutableSkillRegistry([skill]),
        { name: 'TypeError' },
        label,
      )
    }
  })

  test('supports exact lookup and latest semantic-version lookup', () => {
    const v190 = createSkill({ id: ' versioned ', version: '1.9.0' })
    const v1100 = createSkill({ id: 'versioned', version: '1.10.0' })
    const v200 = createSkill({ id: 'versioned', version: '2.0.0' })
    const registry = createCreatorExecutableSkillRegistry([v1100, v200, v190])

    assert.equal(
      getExecutableCreatorSkillFromRegistry(registry, ' versioned ', '1.10.0')?.manifest.version,
      '1.10.0',
    )
    assert.equal(
      getExecutableCreatorSkillFromRegistry(registry, 'versioned')?.manifest.version,
      '2.0.0',
    )
    assert.equal(getExecutableCreatorSkillFromRegistry(registry, 'versioned', '9.0.0'), null)
    assert.equal(getExecutableCreatorSkillFromRegistry(registry, 'missing'), null)
  })

  test('compares semantic-version components without numeric precision loss', () => {
    const lower = createSkill({ id: 'large-version', version: '9007199254740992.0.0' })
    const higher = createSkill({ id: 'large-version', version: '9007199254740993.0.0' })
    const registry = createCreatorExecutableSkillRegistry([lower, higher])

    assert.equal(
      getExecutableCreatorSkillFromRegistry(registry, 'large-version')?.manifest.version,
      '9007199254740993.0.0',
    )
  })

  test('registers the three built-in executable Skills in dependency order', () => {
    const builtIn = getExecutableCreatorSkill('script-segmentation')

    assert.equal(CREATOR_EXECUTABLE_SKILL_REGISTRY.size, 3)
    assert.deepEqual(
      Array.from(CREATOR_EXECUTABLE_SKILL_REGISTRY.keys()),
      [
        'script-segmentation@1.0.0',
        'narrative-beat-analysis@1.0.0',
        'shot-planning@1.0.0',
      ],
    )
    assert.equal(builtIn?.manifest.id, 'script-segmentation')
    assert.equal(builtIn?.manifest.version, '1.0.0')
    assert.ok(Object.isFrozen(builtIn))
    assert.ok(Object.isFrozen(builtIn?.manifest))
    assert.ok(Object.isFrozen(builtIn?.manifest.acceptedNodeKinds))
    assert.equal(getExecutableCreatorSkill('test-skill'), null)
    assert.ok(CREATOR_SKILL_REGISTRY.length > 0)
    assert.notEqual(CREATOR_EXECUTABLE_SKILL_REGISTRY, CREATOR_SKILL_REGISTRY)
  })

  test('returns an immutable facade over frozen defensive Skill snapshots', () => {
    const skill = createSkill({
      name: '  Frozen skill  ',
      description: '  Frozen description  ',
      acceptedNodeKinds: ['text', 'text', 'image'],
      acceptedArtifactTypes: [' script ', 'script', 'outline'],
      outputArtifactTypes: [' scene-list ', 'scene-list', 'shot-list'],
    })
    const registry = createCreatorExecutableSkillRegistry([skill])
    const registered = getExecutableCreatorSkillFromRegistry(registry, 'test-skill')!

    skill.manifest.name = 'Mutated original'
    skill.manifest.acceptedNodeKinds.length = 0
    skill.manifest.acceptedArtifactTypes.push('mutated')
    skill.manifest.outputArtifactTypes.push('mutated')

    assert.equal(registered.manifest.name, '  Frozen skill  ')
    assert.equal(registered.manifest.description, '  Frozen description  ')
    assert.deepEqual(registered.manifest.acceptedNodeKinds, ['text', 'image'])
    assert.deepEqual(registered.manifest.acceptedArtifactTypes, ['script', 'outline'])
    assert.deepEqual(registered.manifest.outputArtifactTypes, ['scene-list', 'shot-list'])
    assert.equal((registry as unknown as Record<string, unknown>).set, undefined)
    assert.equal((registry as unknown as Record<string, unknown>).clear, undefined)
    assert.equal((registry as unknown as Record<string, unknown>).delete, undefined)
    assert.ok(Object.isFrozen(registry))
    assert.ok(Object.isFrozen(registered))
    assert.ok(Object.isFrozen(registered.manifest))
    assert.ok(Object.isFrozen(registered.manifest.acceptedNodeKinds))
    assert.throws(() => registered.manifest.outputArtifactTypes.push('mutated'))
  })

  test('preserves exact non-empty manifest display text', () => {
    const name = '  Display\nname  '
    const description = '  Description with  deliberate spacing.\n  '
    const registry = createCreatorExecutableSkillRegistry([
      createSkill({ name, description }),
    ])
    const registered = getExecutableCreatorSkillFromRegistry(registry, 'test-skill')!

    assert.equal(registered.manifest.name, name)
    assert.equal(registered.manifest.description, description)
  })

  test('registers indexed Skill and manifest array elements without custom iteration', () => {
    const skill = createSkill({
      acceptedNodeKinds: ['text', 'image'],
      acceptedArtifactTypes: ['script', 'outline'],
      outputArtifactTypes: ['scene-list', 'shot-list'],
    })
    const manifestArrays = [
      skill.manifest.acceptedNodeKinds,
      skill.manifest.acceptedArtifactTypes,
      skill.manifest.outputArtifactTypes,
    ]
    for (const values of manifestArrays) {
      Object.defineProperty(values, Symbol.iterator, {
        value() {
          throw new Error('hostile manifest iterator')
        },
      })
    }
    const skills = [skill]
    Object.defineProperty(skills, Symbol.iterator, {
      value() {
        throw new Error('hostile Skills iterator')
      },
    })

    const registry = createCreatorExecutableSkillRegistry(skills)
    const registered = getExecutableCreatorSkillFromRegistry(registry, 'test-skill')!

    assert.deepEqual(registered.manifest.acceptedNodeKinds, ['text', 'image'])
    assert.deepEqual(registered.manifest.acceptedArtifactTypes, ['script', 'outline'])
    assert.deepEqual(registered.manifest.outputArtifactTypes, ['scene-list', 'shot-list'])
  })

  test('contains hostile manifest array getters as controlled registry failures', () => {
    const hostileNodeKinds = new Proxy(['text'] as Array<'text'>, {
      get(target, property, receiver) {
        if (property === '0') throw new Error('hostile manifest index')
        return Reflect.get(target, property, receiver)
      },
    })

    assert.throws(
      () => createCreatorExecutableSkillRegistry([
        createSkill({ acceptedNodeKinds: hostileNodeKinds }),
      ]),
      { name: 'TypeError' },
    )
  })
})

describe('runCreatorSkill', () => {
  test('runs the statically registered script Skill without importing the barrel', () => {
    const result = runCreatorSkill('script-segmentation', {
      sourceNodes: [{
        id: 'direct-script',
        kind: 'text',
        title: 'Direct runtime import',
        prompt: 'EXT. CITY STREET - NIGHT\nRain runs along the curb.',
      }],
    })

    assert.equal(result.status, 'ready')
    assert.equal(result.artifacts.length, 1)
    assert.equal(result.artifacts[0]?.artifactType, 'scene-breakdown')
    assert.equal(result.artifacts[0]?.sourceNodeIds[0], 'direct-script')
  })

  test('runs narrative analysis from an approved Artifact without direct source nodes', () => {
    const result = runCreatorSkill('narrative-beat-analysis', {
      sourceNodes: [],
      artifacts: [createSceneBreakdownArtifact()],
    })

    assert.notEqual(result.status, 'blocked')
    assert.equal(result.artifacts[0]?.artifactType, 'narrative-beat-map')
    assert.deepEqual(result.artifacts[0]?.sourceNodeIds, ['original-script-node'])
    assert.deepEqual(
      result.artifacts[0]?.sourceArtifactIds,
      ['approved-scene-breakdown-002'],
    )
    assert.ok(result.evidence.length > 0)
    assert.ok(result.evidence.every((entry) => entry.sourceNodeId === 'original-script-node'))
  })

  test('runs shot planning from an approved Artifact without direct source nodes', () => {
    const result = runCreatorSkill('shot-planning', {
      sourceNodes: [],
      artifacts: [createNarrativeBeatArtifact()],
    })

    assert.notEqual(result.status, 'blocked')
    assert.equal(result.artifacts[0]?.artifactType, 'shot-plan')
    assert.deepEqual(result.artifacts[0]?.sourceNodeIds, ['original-script-node'])
    assert.deepEqual(
      result.artifacts[0]?.sourceArtifactIds,
      ['approved-narrative-beat-map-002'],
    )
    assert.ok(result.evidence.length > 0)
    assert.ok(result.evidence.every((entry) => entry.sourceNodeId === 'original-script-node'))
  })

  test('blocks unsupported Stage B Artifact types before built-in execution', () => {
    const unsupportedArtifact = createCreatorSkillArtifact({
      artifactId: 'unsupported-001',
      artifactType: 'shot-plan',
      artifactVersion: 1,
      sourceNodeIds: ['original-script-node'],
      payload: {},
    })

    assertBlocked(
      runCreatorSkill('narrative-beat-analysis', {
        sourceNodes: [],
        artifacts: [unsupportedArtifact],
      }),
      'UNSUPPORTED_SKILL_INPUT',
    )
    assertBlocked(
      runCreatorSkill('shot-planning', {
        sourceNodes: [],
        artifacts: [unsupportedArtifact],
      }),
      'UNSUPPORTED_SKILL_INPUT',
    )
  })
})

describe('runCreatorSkillFromRegistry', () => {
  test('accepts inherited provenance only from the specifically linked input Artifact', () => {
    const sourceArtifactA = createCreatorSkillArtifact({
      artifactId: 'script-a',
      artifactType: 'script',
      artifactVersion: 1,
      sourceNodeIds: ['source-a'],
      payload: { scenes: ['Opening'] },
    })
    const sourceArtifactB = createCreatorSkillArtifact({
      artifactId: 'outline-b',
      artifactType: 'outline',
      artifactVersion: 1,
      sourceNodeIds: ['source-b'],
      payload: { scenes: ['Closing'] },
    })
    const createArtifactOnlySkill = (
      sourceNodeId: string,
      sourceArtifactIds: string[],
    ) => createSkill({
      acceptedArtifactTypes: ['script', 'outline'],
    }, (_input, fingerprint) => ({
      skillId: 'test-skill',
      skillVersion: '1.0.0',
      runFingerprint: fingerprint,
      status: 'needs-review',
      artifacts: [createCreatorSkillArtifact({
        artifactId: 'scenes-1',
        artifactType: 'scene-list',
        artifactVersion: 1,
        sourceNodeIds: [sourceNodeId],
        sourceArtifactIds,
        payload: { scenes: ['Opening'] },
      })],
      evidence: [{
        evidenceId: 'evidence-1',
        ruleId: 'inherited-source',
        sourceNodeId,
        lineStart: 1,
        lineEnd: 1,
        excerpt: 'Opening',
        explanation: 'Inherited from the approved input Artifact.',
      }],
      warnings: [{
        code: 'REVIEW_SCENE',
        message: 'Review the inherited scene.',
        sourceNodeId,
        artifactId: 'scenes-1',
      }],
      blockers: [],
    }))
    const input = {
      sourceNodes: [],
      artifacts: [sourceArtifactA, sourceArtifactB],
    }

    const valid = runCreatorSkillFromRegistry(
      createCreatorExecutableSkillRegistry([
        createArtifactOnlySkill('source-b', ['outline-b']),
      ]),
      'test-skill',
      input,
    )
    assert.equal(valid.status, 'needs-review')
    assert.deepEqual(valid.artifacts[0]?.sourceNodeIds, ['source-b'])
    assert.deepEqual(valid.artifacts[0]?.sourceArtifactIds, ['outline-b'])
    assert.equal(valid.evidence[0]?.sourceNodeId, 'source-b')
    assert.equal(valid.warnings[0]?.sourceNodeId, 'source-b')

    assertBlocked(
      runCreatorSkillFromRegistry(
        createCreatorExecutableSkillRegistry([
          createArtifactOnlySkill('invented-node', ['outline-b']),
        ]),
        'test-skill',
        input,
      ),
      'INVALID_SKILL_OUTPUT',
    )
    assertBlocked(
      runCreatorSkillFromRegistry(
        createCreatorExecutableSkillRegistry([
          createArtifactOnlySkill('source-b', ['invented-artifact']),
        ]),
        'test-skill',
        input,
      ),
      'INVALID_SKILL_OUTPUT',
    )
  })

  test('rejects inherited provenance cross-wired to another input Artifact', () => {
    const artifacts = [
      createCreatorSkillArtifact({
        artifactId: 'script-a',
        artifactType: 'script',
        artifactVersion: 1,
        sourceNodeIds: ['source-a'],
        payload: {},
      }),
      createCreatorSkillArtifact({
        artifactId: 'outline-b',
        artifactType: 'outline',
        artifactVersion: 1,
        sourceNodeIds: ['source-b'],
        payload: {},
      }),
    ]
    const skill = createSkill({
      acceptedArtifactTypes: ['script', 'outline'],
    }, (_input, fingerprint) => ({
      ...createResult('test-skill', '1.0.0', fingerprint),
      artifacts: [createCreatorSkillArtifact({
        artifactId: 'scenes-1',
        artifactType: 'scene-list',
        artifactVersion: 1,
        sourceNodeIds: ['source-b'],
        sourceArtifactIds: ['script-a'],
        payload: {},
      })],
    }))

    assertBlocked(
      runCreatorSkillFromRegistry(
        createCreatorExecutableSkillRegistry([skill]),
        'test-skill',
        { sourceNodes: [], artifacts },
      ),
      'INVALID_SKILL_OUTPUT',
    )
  })

  test('rejects inherited source IDs when output omits source Artifact references', () => {
    const sourceArtifact = createCreatorSkillArtifact({
      artifactId: 'script-a',
      artifactType: 'script',
      artifactVersion: 1,
      sourceNodeIds: ['source-a'],
      payload: {},
    })
    const skill = createSkill({}, (_input, fingerprint) => ({
      ...createResult('test-skill', '1.0.0', fingerprint),
      artifacts: [createCreatorSkillArtifact({
        artifactId: 'scenes-1',
        artifactType: 'scene-list',
        artifactVersion: 1,
        sourceNodeIds: ['source-a'],
        sourceArtifactIds: [],
        payload: {},
      })],
    }))

    assertBlocked(
      runCreatorSkillFromRegistry(
        createCreatorExecutableSkillRegistry([skill]),
        'test-skill',
        { sourceNodes: [], artifacts: [sourceArtifact] },
      ),
      'INVALID_SKILL_OUTPUT',
    )
  })

  test('rejects duplicate input Artifact IDs across different types before execution', () => {
    let executionCount = 0
    const skill = createSkill({
      acceptedArtifactTypes: ['script', 'outline'],
    }, (_input, fingerprint) => {
      executionCount += 1
      return createResult('test-skill', '1.0.0', fingerprint)
    })
    const artifacts = [
      createCreatorSkillArtifact({
        artifactId: 'shared-id',
        artifactType: 'script',
        artifactVersion: 1,
        sourceNodeIds: ['source-a'],
        payload: {},
      }),
      createCreatorSkillArtifact({
        artifactId: 'shared-id',
        artifactType: 'outline',
        artifactVersion: 1,
        sourceNodeIds: ['source-b'],
        payload: {},
      }),
    ]

    assertBlocked(
      runCreatorSkillFromRegistry(
        createCreatorExecutableSkillRegistry([skill]),
        'test-skill',
        { sourceNodes: [], artifacts },
      ),
      'INVALID_SKILL_ARTIFACT',
    )
    assert.equal(executionCount, 0)
  })

  test('blocks unsupported source-node and Artifact inputs', () => {
    let executionCount = 0
    const registry = createCreatorExecutableSkillRegistry([
      createSkill({}, (_input, fingerprint) => {
        executionCount += 1
        return createResult('test-skill', '1.0.0', fingerprint)
      }),
    ])
    const unsupportedNode = createInput()
    unsupportedNode.sourceNodes[0] = {
      ...unsupportedNode.sourceNodes[0]!,
      kind: 'image',
    }
    const unsupportedArtifact = createInput()
    unsupportedArtifact.artifacts = [
      createCreatorSkillArtifact({
        artifactId: 'image-1',
        artifactType: 'image-analysis',
        artifactVersion: 1,
        sourceNodeIds: ['node-a'],
        payload: {},
      }),
    ]

    assertBlocked(
      runCreatorSkillFromRegistry(registry, 'test-skill', unsupportedNode),
      'UNSUPPORTED_SKILL_INPUT',
    )
    assertBlocked(
      runCreatorSkillFromRegistry(registry, 'test-skill', unsupportedArtifact),
      'UNSUPPORTED_SKILL_INPUT',
    )
    assert.equal(executionCount, 0)
  })

  test('requires at least one accepted node kind or Artifact type', () => {
    const registry = createCreatorExecutableSkillRegistry([createSkill()])

    assertBlocked(
      runCreatorSkillFromRegistry(registry, 'test-skill', { sourceNodes: [] }),
      'UNSUPPORTED_SKILL_INPUT',
    )
  })

  test('blocks invalid source-node identities and kinds', () => {
    const registry = createCreatorExecutableSkillRegistry([createSkill()])
    const invalidId = createInput()
    invalidId.sourceNodes[0] = { ...invalidId.sourceNodes[0]!, id: '   ' }
    const invalidKind = createInput()
    ;(invalidKind.sourceNodes[0] as { kind: string }).kind = 'audio'

    assertBlocked(
      runCreatorSkillFromRegistry(registry, 'test-skill', invalidId),
      'INVALID_SKILL_INPUT',
    )
    assertBlocked(
      runCreatorSkillFromRegistry(registry, 'test-skill', invalidKind),
      'INVALID_SKILL_INPUT',
    )
  })

  test('blocks malformed canonical Artifacts separately from unsupported types', () => {
    const registry = createCreatorExecutableSkillRegistry([createSkill()])
    const input = createInput()
    input.artifacts = [{
      artifactId: 'script-1',
      artifactType: 'script',
      artifactVersion: 1,
      sourceNodeIds: ['node-b', 'node-a'],
      sourceArtifactIds: [],
      payload: {},
    }]

    assertBlocked(
      runCreatorSkillFromRegistry(registry, 'test-skill', input),
      'INVALID_SKILL_ARTIFACT',
    )
  })

  test('classifies every throwing input Artifact accessor as an invalid Artifact', () => {
    const fields = [
      'artifactId',
      'artifactType',
      'artifactVersion',
      'sourceNodeIds',
      'sourceArtifactIds',
      'payload',
    ] as const
    const registry = createCreatorExecutableSkillRegistry([createSkill()])

    for (const field of fields) {
      const input = createInput()
      const artifact = { ...input.artifacts![0]! }
      Object.defineProperty(artifact, field, {
        enumerable: true,
        get() {
          throw new Error(`hostile ${field} accessor`)
        },
      })
      input.artifacts = [artifact]

      assert.doesNotThrow(() => {
        assertBlocked(
          runCreatorSkillFromRegistry(registry, 'test-skill', input),
          'INVALID_SKILL_ARTIFACT',
        )
      })
    }
  })

  test('classifies unsupported Artifact payload values as malformed Artifacts', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const unsupportedPayloads = [
      new Date('2026-01-01T00:00:00.000Z'),
      new Map([['key', 'value']]),
      cyclic,
    ]
    const registry = createCreatorExecutableSkillRegistry([createSkill()])

    for (const payload of unsupportedPayloads) {
      const input = createInput()
      input.artifacts = [
        createCreatorSkillArtifact({
          artifactId: 'script-1',
          artifactType: 'script',
          artifactVersion: 1,
          sourceNodeIds: ['node-a'],
          payload,
        }),
      ]

      assertBlocked(
        runCreatorSkillFromRegistry(registry, 'test-skill', input),
        'INVALID_SKILL_ARTIFACT',
      )
    }
  })

  test('classifies sparse input Artifact arrays as malformed Artifacts', () => {
    const registry = createCreatorExecutableSkillRegistry([createSkill()])
    const input = createInput()
    input.artifacts = new Array(1)

    assertBlocked(
      runCreatorSkillFromRegistry(registry, 'test-skill', input),
      'INVALID_SKILL_ARTIFACT',
    )
  })

  test('classifies throwing input Artifact slots separately from source-node slots', () => {
    const registry = createCreatorExecutableSkillRegistry([createSkill()])
    const artifactInput = createInput()
    artifactInput.artifacts = new Proxy(artifactInput.artifacts!, {
      get(target, property, receiver) {
        if (property === '0') throw new Error('hostile Artifact slot')
        return Reflect.get(target, property, receiver)
      },
    })
    const sourceNodeInput = createInput()
    sourceNodeInput.sourceNodes = new Proxy(sourceNodeInput.sourceNodes, {
      get(target, property, receiver) {
        if (property === '0') throw new Error('hostile source-node slot')
        return Reflect.get(target, property, receiver)
      },
    })

    assert.doesNotThrow(() => {
      assertBlocked(
        runCreatorSkillFromRegistry(registry, 'test-skill', artifactInput),
        'INVALID_SKILL_ARTIFACT',
      )
      assertBlocked(
        runCreatorSkillFromRegistry(registry, 'test-skill', sourceNodeInput),
        'INVALID_SKILL_INPUT',
      )
    })
  })

  test('returns a controlled result when the Skill is missing', () => {
    assertBlocked(
      runCreatorSkill('missing', createInput()),
      'SKILL_NOT_FOUND',
    )
  })

  test('contains invalid dynamic Skill versions without throwing', () => {
    const registry = createCreatorExecutableSkillRegistry([createSkill()])
    const invalidVersions: unknown[] = [42, { major: 1 }, '1.0']

    for (const invalidVersion of invalidVersions) {
      assert.doesNotThrow(() => {
        assert.equal(
          getExecutableCreatorSkillFromRegistry(
            registry,
            'test-skill',
            invalidVersion as string,
          ),
          null,
        )
      })
      assertBlocked(
        runCreatorSkillFromRegistry(
          registry,
          'test-skill',
          createInput(),
          invalidVersion as string,
        ),
        'INVALID_SKILL_INPUT',
      )
    }

    assertBlocked(
      runCreatorSkillFromRegistry(registry, 'test-skill', createInput(), '9.0.0'),
      'SKILL_NOT_FOUND',
    )
  })

  test('contains hostile registry lookup, iteration, and Skill access', () => {
    const throwingGetRegistry = {
      get() {
        throw new Error('hostile get')
      },
    } as unknown as ReadonlyMap<string, CreatorExecutableSkill>
    const throwingValuesRegistry = {
      values() {
        throw new Error('hostile values')
      },
    } as unknown as ReadonlyMap<string, CreatorExecutableSkill>
    const hostileSkill = Object.defineProperty(
      { run: () => createResult('test-skill', '1.0.0', 'csf1_deadbeef') },
      'manifest',
      {
        get() {
          throw new Error('hostile manifest')
        },
      },
    ) as unknown as CreatorExecutableSkill
    const hostileSkillRegistry = new Map<string, CreatorExecutableSkill>([
      ['test-skill@1.0.0', hostileSkill],
    ])

    const attempts: Array<() => CreatorSkillRunResult> = [
      () => runCreatorSkillFromRegistry(
        throwingGetRegistry,
        'test-skill',
        createInput(),
        '1.0.0',
      ),
      () => runCreatorSkillFromRegistry(throwingValuesRegistry, 'test-skill', createInput()),
      () => runCreatorSkillFromRegistry(
        hostileSkillRegistry,
        'test-skill',
        createInput(),
        '1.0.0',
      ),
    ]

    for (const attempt of attempts) {
      assert.doesNotThrow(() => {
        assertBlocked(attempt(), 'INVALID_SKILL_INPUT')
      })
    }
  })

  test('isolates execution from mutation of a hostile external Skill manifest', () => {
    const skill = createSkill()
    skill.run = (_input, fingerprint) => {
      skill.manifest.outputArtifactTypes.length = 0
      return createResult('test-skill', '1.0.0', fingerprint)
    }
    const externalRegistry = new Map<string, CreatorExecutableSkill>([
      ['test-skill@1.0.0', skill],
    ])

    const result = runCreatorSkillFromRegistry(
      externalRegistry,
      'test-skill',
      createInput(),
      '1.0.0',
    )

    assert.equal(result.status, 'ready')
    assert.equal(result.artifacts.length, 1)
  })

  test('converts executor exceptions into blocked results', () => {
    const registry = createCreatorExecutableSkillRegistry([
      createSkill({}, () => {
        throw new Error('executor failed')
      }),
    ])

    assertBlocked(
      runCreatorSkillFromRegistry(registry, 'test-skill', createInput()),
      'SKILL_EXECUTION_FAILED',
    )
  })

  test('rejects malformed and undeclared output Artifacts', () => {
    const malformed = createSkill({}, (_input, fingerprint) => {
      const result = createResult('test-skill', '1.0.0', fingerprint)
      result.artifacts[0] = {
        ...result.artifacts[0]!,
        sourceNodeIds: ['node-b', 'node-a'],
      }
      return result
    })
    const undeclared = createSkill({}, (_input, fingerprint) => {
      const result = createResult('test-skill', '1.0.0', fingerprint)
      result.artifacts[0] = {
        ...result.artifacts[0]!,
        artifactType: 'shot-list',
      }
      return result
    })

    assertBlocked(
      runCreatorSkillFromRegistry(
        createCreatorExecutableSkillRegistry([malformed]),
        'test-skill',
        createInput(),
      ),
      'INVALID_SKILL_OUTPUT',
    )
    assertBlocked(
      runCreatorSkillFromRegistry(
        createCreatorExecutableSkillRegistry([undeclared]),
        'test-skill',
        createInput(),
      ),
      'INVALID_SKILL_OUTPUT',
    )
  })

  test('classifies every throwing output Artifact accessor as invalid output', () => {
    const fields = [
      'artifactId',
      'artifactType',
      'artifactVersion',
      'sourceNodeIds',
      'sourceArtifactIds',
      'payload',
    ] as const

    for (const field of fields) {
      const skill = createSkill({}, (_input, fingerprint) => {
        const result = createResult('test-skill', '1.0.0', fingerprint)
        Object.defineProperty(result.artifacts[0]!, field, {
          enumerable: true,
          get() {
            throw new Error(`hostile ${field} accessor`)
          },
        })
        return result
      })

      assert.doesNotThrow(() => {
        assertBlocked(
          runCreatorSkillFromRegistry(
            createCreatorExecutableSkillRegistry([skill]),
            'test-skill',
            createInput(),
          ),
          'INVALID_SKILL_OUTPUT',
        )
      })
    }
  })

  test('rejects output Artifacts with unsupported payload values', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const unsupportedPayloads = [
      new Date('2026-01-01T00:00:00.000Z'),
      new Map([['key', 'value']]),
      cyclic,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]

    for (const payload of unsupportedPayloads) {
      const skill = createSkill({}, (_input, fingerprint) => ({
        ...createResult('test-skill', '1.0.0', fingerprint),
        artifacts: [
          createCreatorSkillArtifact({
            artifactId: 'scenes-1',
            artifactType: 'scene-list',
            artifactVersion: 1,
            sourceNodeIds: ['node-a', 'node-b'],
            sourceArtifactIds: ['script-1'],
            payload,
          }),
        ],
      }))

      assertBlocked(
        runCreatorSkillFromRegistry(
          createCreatorExecutableSkillRegistry([skill]),
          'test-skill',
          createInput(),
        ),
        'INVALID_SKILL_OUTPUT',
      )
    }
  })

  test('rejects sparse output Artifact arrays', () => {
    const skill = createSkill({}, (_input, fingerprint) => {
      const result = createResult('test-skill', '1.0.0', fingerprint)
      result.artifacts = new Array(1)
      return result
    })

    assertBlocked(
      runCreatorSkillFromRegistry(
        createCreatorExecutableSkillRegistry([skill]),
        'test-skill',
        createInput(),
      ),
      'INVALID_SKILL_OUTPUT',
    )
  })

  test('returns normalized output Artifacts without executor-owned references', () => {
    const payload = { scenes: [{ title: 'Opening' }] }
    const artifact = createCreatorSkillArtifact({
      artifactId: 'scenes-1',
      artifactType: 'scene-list',
      artifactVersion: 1,
      sourceNodeIds: ['node-a', 'node-b'],
      sourceArtifactIds: ['script-1'],
      payload,
    })
    const skill = createSkill({}, (_input, fingerprint) => ({
      ...createResult('test-skill', '1.0.0', fingerprint),
      artifacts: [artifact],
    }))

    const result = runCreatorSkillFromRegistry(
      createCreatorExecutableSkillRegistry([skill]),
      'test-skill',
      createInput(),
    )
    const resultArtifact = result.artifacts[0]!

    assert.notEqual(resultArtifact, artifact)
    assert.notEqual(resultArtifact.payload, payload)
    payload.scenes[0]!.title = 'Mutated after execution'
    artifact.sourceNodeIds.push('node-c')
    assert.deepEqual(resultArtifact.payload, { scenes: [{ title: 'Opening' }] })
    assert.deepEqual(resultArtifact.sourceNodeIds, ['node-a', 'node-b'])
  })

  test('normalizes valid evidence and issues and rejects malformed entries', () => {
    const validEvidence = {
      evidenceId: 'evidence-1',
      ruleId: 'rule-1',
      sourceNodeId: 'node-a',
      lineStart: 1,
      lineEnd: 2,
      excerpt: 'Opening excerpt',
      explanation: 'Supports the scene split.',
    }
    const validIssue = {
      code: 'REVIEW_SCENE',
      message: 'Review the opening scene.',
      sourceNodeId: 'node-a',
      artifactId: 'scenes-1',
    }
    const invalidEvidenceEntries: unknown[] = [
      { ...validEvidence, evidenceId: '   ' },
      { ...validEvidence, sourceNodeId: 'missing-node' },
      { ...validEvidence, lineStart: 0 },
      { ...validEvidence, lineStart: 3, lineEnd: 2 },
      { ...validEvidence, excerpt: '   ' },
      { ...validEvidence, extra: true },
    ]
    const invalidIssueEntries: unknown[] = [
      { ...validIssue, code: '   ' },
      { ...validIssue, message: '   ' },
      { ...validIssue, sourceNodeId: 'missing-node' },
      { ...validIssue, artifactId: 'missing-artifact' },
      { ...validIssue, sourceNodeId: 42 },
      { ...validIssue, extra: true },
    ]

    for (const evidence of invalidEvidenceEntries) {
      const skill = createSkill({}, (_input, fingerprint) => ({
        ...createResult('test-skill', '1.0.0', fingerprint),
        evidence: [evidence] as never,
      }))
      assertBlocked(
        runCreatorSkillFromRegistry(
          createCreatorExecutableSkillRegistry([skill]),
          'test-skill',
          createInput(),
        ),
        'INVALID_SKILL_OUTPUT',
      )
    }

    for (const issue of invalidIssueEntries) {
      const skill = createSkill({}, (_input, fingerprint) => ({
        ...createResult('test-skill', '1.0.0', fingerprint),
        warnings: [issue] as never,
      }))
      assertBlocked(
        runCreatorSkillFromRegistry(
          createCreatorExecutableSkillRegistry([skill]),
          'test-skill',
          createInput(),
        ),
        'INVALID_SKILL_OUTPUT',
      )
    }

    const normalizedSkill = createSkill({}, (_input, fingerprint) => ({
      ...createResult('test-skill', '1.0.0', fingerprint),
      evidence: [{
        ...validEvidence,
        evidenceId: ' evidence-1 ',
        ruleId: ' rule-1 ',
        sourceNodeId: ' node-a ',
        excerpt: ' Opening excerpt ',
        explanation: ' Supports the scene split. ',
      }],
      warnings: [{
        ...validIssue,
        code: ' REVIEW_SCENE ',
        message: ' Review the opening scene. ',
        sourceNodeId: ' node-a ',
        artifactId: ' scenes-1 ',
      }],
    }))
    const normalized = runCreatorSkillFromRegistry(
      createCreatorExecutableSkillRegistry([normalizedSkill]),
      'test-skill',
      createInput(),
    )

    assert.deepEqual(normalized.evidence, [{
      ...validEvidence,
      excerpt: ' Opening excerpt ',
      explanation: ' Supports the scene split. ',
    }])
    assert.deepEqual(normalized.warnings, [{
      ...validIssue,
      message: ' Review the opening scene. ',
    }])
  })

  test('preserves exact non-empty evidence and issue prose', () => {
    const excerpt = '  Opening\nexcerpt  '
    const explanation = '  Supports  the scene split.\n  '
    const message = '  Review\nthis  scene.  '
    const skill = createSkill({}, (_input, fingerprint) => ({
      ...createResult('test-skill', '1.0.0', fingerprint),
      evidence: [{
        evidenceId: ' evidence-1 ',
        ruleId: ' rule-1 ',
        sourceNodeId: ' node-a ',
        lineStart: 1,
        lineEnd: 2,
        excerpt,
        explanation,
      }],
      warnings: [{
        code: ' REVIEW_SCENE ',
        message,
        sourceNodeId: ' node-a ',
        artifactId: ' scenes-1 ',
      }],
    }))

    const result = runCreatorSkillFromRegistry(
      createCreatorExecutableSkillRegistry([skill]),
      'test-skill',
      createInput(),
    )

    assert.equal(result.evidence[0]?.evidenceId, 'evidence-1')
    assert.equal(result.evidence[0]?.excerpt, excerpt)
    assert.equal(result.evidence[0]?.explanation, explanation)
    assert.equal(result.warnings[0]?.code, 'REVIEW_SCENE')
    assert.equal(result.warnings[0]?.message, message)
  })

  test('rejects duplicate and invalid-provenance output Artifacts', () => {
    const artifact = createCreatorSkillArtifact({
      artifactId: 'scenes-1',
      artifactType: 'scene-list',
      artifactVersion: 1,
      sourceNodeIds: ['node-a'],
      sourceArtifactIds: ['script-1'],
      payload: {},
    })
    const invalidArtifactSets = [
      [artifact, { ...artifact, payload: { duplicate: true } }],
      [{ ...artifact, sourceNodeIds: ['missing-node'] }],
      [{ ...artifact, sourceArtifactIds: ['missing-artifact'] }],
    ]

    for (const artifacts of invalidArtifactSets) {
      const skill = createSkill({}, (_input, fingerprint) => ({
        ...createResult('test-skill', '1.0.0', fingerprint),
        artifacts,
      }))
      assertBlocked(
        runCreatorSkillFromRegistry(
          createCreatorExecutableSkillRegistry([skill]),
          'test-skill',
          createInput(),
        ),
        'INVALID_SKILL_OUTPUT',
      )
    }
  })

  test('enforces output status invariants', () => {
    const blocker = { code: 'BLOCKED', message: 'Execution is blocked.' }
    const invalidResults: CreatorSkillRunResult[] = [
      {
        ...createResult('test-skill', '1.0.0', 'csf1_deadbeef'),
        status: 'blocked',
        blockers: [blocker],
      },
      {
        ...createResult('test-skill', '1.0.0', 'csf1_deadbeef'),
        status: 'blocked',
        artifacts: [],
      },
      {
        ...createResult('test-skill', '1.0.0', 'csf1_deadbeef'),
        blockers: [blocker],
      },
      {
        ...createResult('test-skill', '1.0.0', 'csf1_deadbeef'),
        status: 'needs-review',
        blockers: [blocker],
      },
    ]

    for (const invalidResult of invalidResults) {
      const skill = createSkill({}, () => invalidResult)
      assertBlocked(
        runCreatorSkillFromRegistry(
          createCreatorExecutableSkillRegistry([skill]),
          'test-skill',
          createInput(),
        ),
        'INVALID_SKILL_OUTPUT',
      )
    }
  })

  test('deep-clones normalized evidence, warnings, and blockers', () => {
    const evidence = {
      evidenceId: 'evidence-1',
      ruleId: 'rule-1',
      sourceNodeId: 'node-a',
      lineStart: 1,
      lineEnd: 1,
      excerpt: 'Opening',
      explanation: 'Supports the opening.',
    }
    const warning = {
      code: 'REVIEW_SCENE',
      message: 'Review the opening.',
      sourceNodeId: 'node-a',
      artifactId: 'scenes-1',
    }
    const blocker = {
      code: 'MISSING_CONTEXT',
      message: 'Context is missing.',
      sourceNodeId: 'node-a',
      artifactId: 'script-1',
    }
    const readySkill = createSkill({}, (_input, fingerprint) => ({
      ...createResult('test-skill', '1.0.0', fingerprint),
      evidence: [evidence],
      warnings: [warning],
    }))
    const blockedSkill = createSkill({ id: 'blocked-skill' }, (_input, fingerprint) => ({
      skillId: 'blocked-skill',
      skillVersion: '1.0.0',
      runFingerprint: fingerprint,
      status: 'blocked',
      artifacts: [],
      evidence: [],
      warnings: [],
      blockers: [blocker],
    }))

    const ready = runCreatorSkillFromRegistry(
      createCreatorExecutableSkillRegistry([readySkill]),
      'test-skill',
      createInput(),
    )
    const blocked = runCreatorSkillFromRegistry(
      createCreatorExecutableSkillRegistry([blockedSkill]),
      'blocked-skill',
      createInput(),
    )

    assert.notEqual(ready.evidence[0], evidence)
    assert.notEqual(ready.warnings[0], warning)
    assert.notEqual(blocked.blockers[0], blocker)
    evidence.excerpt = 'Mutated'
    warning.message = 'Mutated'
    blocker.message = 'Mutated'
    assert.equal(ready.evidence[0]?.excerpt, 'Opening')
    assert.equal(ready.warnings[0]?.message, 'Review the opening.')
    assert.equal(blocked.blockers[0]?.message, 'Context is missing.')
  })

  test('forces registered identity fields and preserves meaningful text', () => {
    const skill = createSkill(
      { id: ' identity-skill ', version: '1.2.3' },
      (input, fingerprint) => {
        assert.equal(input.sourceNodes[1]?.prompt, 'Keep  prompt spacing.\nAnd line breaks.')
        assert.equal(input.sourceNodes[1]?.resultText, 'Keep  result spacing too.')
        return {
          ...createResult('spoofed-id', '9.9.9', 'csf1_deadbeef'),
          runFingerprint: fingerprint === 'never' ? fingerprint : 'csf1_deadbeef',
        }
      },
    )
    const registry = createCreatorExecutableSkillRegistry([skill])

    const result = runCreatorSkillFromRegistry(registry, 'identity-skill', createInput())

    assert.equal(result.skillId, 'identity-skill')
    assert.equal(result.skillVersion, '1.2.3')
    assert.notEqual(result.runFingerprint, 'csf1_deadbeef')
    assert.match(result.runFingerprint, /^csf1_[0-9a-f]{8}$/)
  })

  test('normalizes top-level ordering for deterministic execution and fingerprints', () => {
    const skill = createSkill({}, (input, fingerprint) => ({
      ...createResult('test-skill', '1.0.0', fingerprint),
      artifacts: [
        createCreatorSkillArtifact({
          artifactId: 'scenes-1',
          artifactType: 'scene-list',
          artifactVersion: 1,
          sourceNodeIds: input.sourceNodes.map((node) => node.id),
          sourceArtifactIds: (input.artifacts ?? []).map((artifact) => artifact.artifactId),
          payload: {
            prompts: input.sourceNodes.map((node) => node.prompt),
            options: input.options,
          },
        }),
      ],
    }))
    const registry = createCreatorExecutableSkillRegistry([skill])
    const left = createInput()
    const right = createInput()
    right.sourceNodes.reverse()
    right.artifacts?.reverse()

    assert.deepEqual(
      runCreatorSkillFromRegistry(registry, 'test-skill', left),
      runCreatorSkillFromRegistry(registry, 'test-skill', right),
    )
  })

  test('recursively canonicalizes object key order before executor inspection', () => {
    const skill = createSkill({}, (input, fingerprint) => {
      const sourceNode = input.sourceNodes.find((node) => node.id === 'node-b')!
      const metadata = sourceNode.metadataJson as Record<string, unknown>
      const metadataNested = metadata.alpha as Record<string, unknown>
      const options = input.options as Record<string, unknown>
      const optionsNested = options.alpha as Record<string, unknown>
      return {
        ...createResult('test-skill', '1.0.0', fingerprint),
        artifacts: [
          createCreatorSkillArtifact({
            artifactId: 'scenes-1',
            artifactType: 'scene-list',
            artifactVersion: 1,
            sourceNodeIds: ['node-a', 'node-b'],
            sourceArtifactIds: ['script-1'],
            payload: {
              metadataKeys: Object.keys(metadata),
              metadataNestedKeys: Object.keys(metadataNested),
              optionKeys: Object.keys(options),
              optionNestedKeys: Object.keys(optionsNested),
            },
          }),
        ],
      }
    })
    const registry = createCreatorExecutableSkillRegistry([skill])
    const left = createInput()
    const right = createInput()
    left.sourceNodes[0]!.metadataJson = {
      zeta: true,
      alpha: { zeta: 2, alpha: 1 },
    }
    right.sourceNodes[0]!.metadataJson = {
      alpha: { alpha: 1, zeta: 2 },
      zeta: true,
    }
    left.options = {
      zeta: true,
      alpha: { zeta: 2, alpha: 1 },
    }
    right.options = {
      alpha: { alpha: 1, zeta: 2 },
      zeta: true,
    }

    assert.deepEqual(
      runCreatorSkillFromRegistry(registry, 'test-skill', left),
      runCreatorSkillFromRegistry(registry, 'test-skill', right),
    )
  })

  const invalidNestedInputCases: Array<[
    string,
    (input: CreatorSkillRunInput) => void,
  ]> = [
    ['options sparse arrays', (input) => {
      const values = [1, 2, 3]
      delete values[1]
      input.options = { values }
    }],
    ['options own undefined array slots', (input) => {
      input.options = { values: [1, undefined, 2] }
    }],
    ['source metadata sparse arrays', (input) => {
      const values = [1, 2, 3]
      delete values[1]
      input.sourceNodes[0]!.metadataJson = { values }
    }],
    ['source metadata own undefined array slots', (input) => {
      input.sourceNodes[0]!.metadataJson = { values: [1, undefined, 2] }
    }],
  ]

  for (const [label, configureInput] of invalidNestedInputCases) {
    test(`blocks ${label} before execution with the fallback fingerprint`, () => {
      let executionCount = 0
      const skill = createSkill({}, (_input, fingerprint) => {
        executionCount += 1
        return createResult('test-skill', '1.0.0', fingerprint)
      })
      const input = createInput()
      configureInput(input)

      const result = runCreatorSkillFromRegistry(
        createCreatorExecutableSkillRegistry([skill]),
        'test-skill',
        input,
      )

      assertBlocked(result, 'INVALID_SKILL_INPUT')
      assert.equal(result.runFingerprint, 'csf1_00000000')
      assert.equal(executionCount, 0)
    })
  }

  test('contains hostile nested input array getters before execution', () => {
    let executionCount = 0
    const skill = createSkill({}, (_input, fingerprint) => {
      executionCount += 1
      return createResult('test-skill', '1.0.0', fingerprint)
    })
    const registry = createCreatorExecutableSkillRegistry([skill])

    for (const location of ['options', 'metadata'] as const) {
      const input = createInput()
      const values = [1, 2]
      Object.defineProperty(values, 1, {
        enumerable: true,
        configurable: true,
        get() {
          throw new Error('hostile nested input array getter')
        },
      })
      if (location === 'options') {
        input.options = { values }
      } else {
        input.sourceNodes[0]!.metadataJson = { values }
      }

      assert.doesNotThrow(() => {
        const result = runCreatorSkillFromRegistry(registry, 'test-skill', input)
        assertBlocked(result, 'INVALID_SKILL_INPUT')
        assert.equal(result.runFingerprint, 'csf1_00000000')
      })
    }
    assert.equal(executionCount, 0)
  })

  for (const [label, values] of [
    ['sparse', () => {
      const nested = [1, 2, 3]
      delete nested[1]
      return nested
    }],
    ['own undefined', () => [1, undefined, 2]],
  ] as const) {
    test(`classifies Artifact payload nested ${label} arrays as malformed Artifacts`, () => {
      let executionCount = 0
      const skill = createSkill({}, (_input, fingerprint) => {
        executionCount += 1
        return createResult('test-skill', '1.0.0', fingerprint)
      })
      const input = createInput()
      input.artifacts = [{
        ...input.artifacts![0]!,
        payload: { values: values() },
      }]

      const result = runCreatorSkillFromRegistry(
        createCreatorExecutableSkillRegistry([skill]),
        'test-skill',
        input,
      )

      assertBlocked(result, 'INVALID_SKILL_ARTIFACT')
      assert.equal(result.runFingerprint, 'csf1_00000000')
      assert.equal(executionCount, 0)
    })
  }

  test('preserves exact valid dense nested array order for executor input', () => {
    const expected = ['third', 'first', 'second']
    let executionCount = 0
    const skill = createSkill({}, (input, fingerprint) => {
      executionCount += 1
      assert.deepEqual(input.options?.values, expected)
      const metadata = input.sourceNodes.find((node) => node.id === 'node-b')
        ?.metadataJson as Record<string, unknown>
      assert.deepEqual(
        metadata.values,
        expected,
      )
      assert.deepEqual(
        (input.artifacts?.[0]?.payload as Record<string, unknown>).values,
        expected,
      )
      return createResult('test-skill', '1.0.0', fingerprint)
    })
    const input = createInput()
    input.options = { values: [...expected] }
    input.sourceNodes[0]!.metadataJson = { values: [...expected] }
    input.artifacts = [{
      ...input.artifacts![0]!,
      payload: { values: [...expected] },
    }]
    const snapshot = structuredClone(input)

    const result = runCreatorSkillFromRegistry(
      createCreatorExecutableSkillRegistry([skill]),
      'test-skill',
      input,
    )

    assert.equal(result.status, 'ready')
    assert.equal(executionCount, 1)
    assert.deepEqual(input, snapshot)
  })

  test('preserves an own enumerable __proto__ input key without changing prototypes', () => {
    const skill = createSkill({}, (input, fingerprint) => {
      const options = input.options!
      return {
        ...createResult('test-skill', '1.0.0', fingerprint),
        artifacts: [
          createCreatorSkillArtifact({
            artifactId: 'scenes-1',
            artifactType: 'scene-list',
            artifactVersion: 1,
            sourceNodeIds: ['node-a', 'node-b'],
            sourceArtifactIds: ['script-1'],
            payload: {
              hasOwnProto: Object.prototype.hasOwnProperty.call(options, '__proto__'),
              hasOrdinaryPrototype: Object.getPrototypeOf(options) === Object.prototype,
              protoValue: options.__proto__,
            },
          }),
        ],
      }
    })
    const input = createInput()
    input.options = createOwnProtoRecord({ polluted: true })

    const result = runCreatorSkillFromRegistry(
      createCreatorExecutableSkillRegistry([skill]),
      'test-skill',
      input,
    )

    assert.deepEqual(result.artifacts[0]?.payload, {
      hasOwnProto: true,
      hasOrdinaryPrototype: true,
      protoValue: { polluted: true },
    })
  })

  test('preserves an own enumerable __proto__ output key without changing prototypes', () => {
    const payload = createOwnProtoRecord({ polluted: true })
    const skill = createSkill({}, (_input, fingerprint) => ({
      ...createResult('test-skill', '1.0.0', fingerprint),
      artifacts: [
        createCreatorSkillArtifact({
          artifactId: 'scenes-1',
          artifactType: 'scene-list',
          artifactVersion: 1,
          sourceNodeIds: ['node-a', 'node-b'],
          sourceArtifactIds: ['script-1'],
          payload,
        }),
      ],
    }))

    const result = runCreatorSkillFromRegistry(
      createCreatorExecutableSkillRegistry([skill]),
      'test-skill',
      createInput(),
    )
    const resultPayload = result.artifacts[0]?.payload as Record<string, unknown>

    assert.ok(Object.prototype.hasOwnProperty.call(resultPayload, '__proto__'))
    assert.equal(Object.getPrototypeOf(resultPayload), Object.prototype)
    assert.deepEqual(resultPayload.__proto__, { polluted: true })
    assert.equal((Object.prototype as Record<string, unknown>).polluted, undefined)
  })

  test('does not expose caller-owned nested input to a mutating executor', () => {
    const input = createInput()
    const snapshot = structuredClone(input)
    const skill = createSkill({}, (ownedInput, fingerprint) => {
      ownedInput.sourceNodes.reverse()
      ownedInput.sourceNodes[0]!.prompt = 'mutated'
      ;(ownedInput.sourceNodes[0]!.metadataJson as { nested: { value: number } }).nested.value = 99
      ;(ownedInput.artifacts![0]!.payload as { acts: Array<{ title: string }> }).acts[0]!.title = 'mutated'
      ;(ownedInput.options!.nested as { enabled: boolean }).enabled = false
      ;(ownedInput.options!.values as unknown[]).push('mutated')
      return createResult('test-skill', '1.0.0', fingerprint)
    })
    const registry = createCreatorExecutableSkillRegistry([skill])

    runCreatorSkillFromRegistry(registry, 'test-skill', input)

    assert.deepEqual(input, snapshot)
  })

  test('copies runtime input from indexed elements before a mutating executor runs', () => {
    const input = createInput()
    const callerSourceNodes = input.sourceNodes
    const callerNestedValues = [{ value: 1 }]
    input.options = { nestedValues: callerNestedValues }
    Object.defineProperty(callerSourceNodes, 'map', {
      value() {
        return [callerSourceNodes[0]!, callerSourceNodes[1]!]
      },
    })
    Object.defineProperties(callerNestedValues, {
      filter: {
        value() {
          return callerNestedValues
        },
      },
      map: {
        value() {
          return callerNestedValues
        },
      },
    })
    const originalNodePrompt = callerSourceNodes.find((node) => node.id === 'node-a')!.prompt
    const skill = createSkill({}, (ownedInput, fingerprint) => {
      ownedInput.sourceNodes[0]!.prompt = 'executor mutation'
      const nestedValues = ownedInput.options!.nestedValues as Array<{ value: number }>
      nestedValues[0]!.value = 99
      return createResult('test-skill', '1.0.0', fingerprint)
    })

    const result = runCreatorSkillFromRegistry(
      createCreatorExecutableSkillRegistry([skill]),
      'test-skill',
      input,
    )

    assert.equal(result.status, 'ready')
    assert.equal(
      callerSourceNodes.find((node) => node.id === 'node-a')!.prompt,
      originalNodePrompt,
    )
    assert.equal(callerNestedValues[0]!.value, 1)
  })

  test('normalizes runtime input Artifacts by indexed slots without custom iteration', () => {
    const input = createInput()
    Object.defineProperty(input.artifacts!, Symbol.iterator, {
      value() {
        throw new Error('hostile input Artifact iterator')
      },
    })
    const registry = createCreatorExecutableSkillRegistry([createSkill()])

    const result = runCreatorSkillFromRegistry(registry, 'test-skill', input)

    assert.equal(result.status, 'ready')
    assert.equal(result.artifacts.length, 1)
  })

  test('normalizes output collections by indexed slots without custom iteration', () => {
    const skill = createSkill({}, (_input, fingerprint) => {
      const result = createResult('test-skill', '1.0.0', fingerprint)
      const outputArrays = [
        result.artifacts,
        result.evidence,
        result.warnings,
        result.blockers,
      ]
      for (const values of outputArrays) {
        Object.defineProperty(values, Symbol.iterator, {
          value() {
            throw new Error('hostile output iterator')
          },
        })
      }
      return result
    })

    const result = runCreatorSkillFromRegistry(
      createCreatorExecutableSkillRegistry([skill]),
      'test-skill',
      createInput(),
    )

    assert.equal(result.status, 'ready')
    assert.equal(result.artifacts.length, 1)
  })

  test('deep-clones nested output arrays without caller-controlled filter or map', () => {
    const executorValues = [{ value: 1 }]
    Object.defineProperties(executorValues, {
      filter: {
        value() {
          return executorValues
        },
      },
      map: {
        value() {
          return executorValues
        },
      },
    })
    const skill = createSkill({}, (_input, fingerprint) => ({
      ...createResult('test-skill', '1.0.0', fingerprint),
      artifacts: [
        createCreatorSkillArtifact({
          artifactId: 'scenes-1',
          artifactType: 'scene-list',
          artifactVersion: 1,
          sourceNodeIds: ['node-a', 'node-b'],
          sourceArtifactIds: ['script-1'],
          payload: { values: executorValues },
        }),
      ],
    }))

    const result = runCreatorSkillFromRegistry(
      createCreatorExecutableSkillRegistry([skill]),
      'test-skill',
      createInput(),
    )
    const outputValues = (result.artifacts[0]?.payload as {
      values: Array<{ value: number }>
    }).values

    executorValues[0]!.value = 99
    assert.equal(outputValues[0]!.value, 1)
    assert.notEqual(outputValues, executorValues)
  })

  test('contains fingerprint normalization failures with a stable fallback fingerprint', () => {
    let executed = false
    const skill = createSkill({}, (_input, fingerprint) => {
      executed = true
      return createResult('test-skill', '1.0.0', fingerprint)
    })
    const registry = createCreatorExecutableSkillRegistry([skill])
    const input = createInput()
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    input.options = cyclic

    const first = runCreatorSkillFromRegistry(registry, 'test-skill', input)
    const second = runCreatorSkillFromRegistry(registry, 'test-skill', input)

    assertBlocked(first, 'INVALID_SKILL_INPUT')
    assertBlocked(second, 'INVALID_SKILL_INPUT')
    assert.equal(first.runFingerprint, second.runFingerprint)
    assert.equal(executed, false)
  })
})
