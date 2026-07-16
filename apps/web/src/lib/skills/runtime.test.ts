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
    manifest: { ...BASE_MANIFEST, ...manifest },
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
      ['invalid version', createSkill({ version: '1.0' })],
      ['prerelease version', createSkill({ version: '1.0.0-beta.1' })],
      ['non-local policy', createSkill({ executionPolicy: 'external-media' })],
      ['not independently callable', createSkill({ independentlyCallable: false } as never)],
      ['empty output types', createSkill({ outputArtifactTypes: [] })],
      ['blank output type', createSkill({ outputArtifactTypes: [' '] })],
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

  test('keeps the executable registry empty and separate from the legacy prompt registry', () => {
    assert.equal(CREATOR_EXECUTABLE_SKILL_REGISTRY.size, 0)
    assert.equal(getExecutableCreatorSkill('test-skill'), null)
    assert.ok(CREATOR_SKILL_REGISTRY.length > 0)
    assert.notEqual(CREATOR_EXECUTABLE_SKILL_REGISTRY, CREATOR_SKILL_REGISTRY)
  })
})

describe('runCreatorSkillFromRegistry', () => {
  test('blocks unsupported source-node and Artifact inputs', () => {
    const registry = createCreatorExecutableSkillRegistry([createSkill()])
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
