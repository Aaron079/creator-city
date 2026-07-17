/**
 * Public contract tests for pure script-scene materialization planning.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/skills/scriptSegmentationMaterialization.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import type {
  CreatorSkillEvidence,
  CreatorSkillRunResult,
} from '../../../../lib/skills'
import type { ScriptSceneDraft } from '../../../../lib/skills/script-segmentation'
import {
  planScriptSceneMaterialization,
  type ApprovedSceneDraft,
} from './scriptSegmentationMaterialization'

const SOURCE_NODE_ID = 'script-1'
const RUN_FINGERPRINT = 'csf1_12ab34cd'

function scene(
  sceneId: string,
  order: number,
  heading: string,
  sourceText: string,
  lineStart: number,
  lineEnd: number,
): ScriptSceneDraft {
  return {
    sceneId,
    order,
    heading,
    characters: [],
    actionSummary: sourceText,
    sourceText,
    lineStart,
    lineEnd,
    reviewStatus: 'pending',
  }
}

function evidence(
  evidenceId: string,
  sceneDraft: ScriptSceneDraft,
  overrides: Partial<CreatorSkillEvidence> = {},
): CreatorSkillEvidence {
  return {
    evidenceId,
    ruleId: 'scene-boundary',
    sourceNodeId: SOURCE_NODE_ID,
    lineStart: sceneDraft.lineStart,
    lineEnd: sceneDraft.lineEnd,
    excerpt: sceneDraft.sourceText,
    explanation: `Boundary for ${sceneDraft.sceneId}`,
    ...overrides,
  }
}

const FIRST_SCENE = scene(
  'scene-001',
  1,
  'EXT. ROOFTOP - NIGHT',
  'EXT. ROOFTOP - NIGHT\nMaya crosses the roof.',
  1,
  2,
)
const SECOND_SCENE = scene(
  'scene-002',
  2,
  'INT. STATION - DAY',
  'INT. STATION - DAY\nThe doors close.',
  3,
  4,
)

function resultFixture(
  overrides: Partial<CreatorSkillRunResult> = {},
): CreatorSkillRunResult {
  return {
    skillId: 'script-segmentation',
    skillVersion: '1.0.0',
    runFingerprint: RUN_FINGERPRINT,
    status: 'ready',
    artifacts: [{
      artifactId: 'scene-breakdown-001',
      artifactType: 'scene-breakdown',
      artifactVersion: 1,
      sourceNodeIds: [SOURCE_NODE_ID],
      sourceArtifactIds: [],
      payload: {
        format: 'headed-script',
        scenes: [FIRST_SCENE, SECOND_SCENE],
      },
    }],
    evidence: [
      evidence('ev-first', FIRST_SCENE),
      evidence('ev-second', SECOND_SCENE),
      evidence('ev-wrong-source', FIRST_SCENE, { sourceNodeId: 'script-2' }),
      evidence('ev-wrong-range', FIRST_SCENE, { lineEnd: 99 }),
    ],
    warnings: [],
    blockers: [],
    ...overrides,
  }
}

function approve(
  draft: ScriptSceneDraft,
  overrides: Partial<ApprovedSceneDraft> = {},
): ApprovedSceneDraft {
  return {
    ...draft,
    reviewStatus: 'approved',
    ...overrides,
  }
}

function plan(overrides: Partial<Parameters<typeof planScriptSceneMaterialization>[0]> = {}) {
  return planScriptSceneMaterialization({
    sourceNodeId: SOURCE_NODE_ID,
    result: resultFixture(),
    approvedScenes: [approve(FIRST_SCENE), approve(SECOND_SCENE)],
    existingNodes: [],
    ...overrides,
  })
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function deepFreeze(value: unknown, seen = new Set<object>()): void {
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  for (const nested of Object.values(value)) deepFreeze(nested, seen)
  Object.freeze(value)
}

describe('planScriptSceneMaterialization output', () => {
  test('creates approved scenes only and preserves Artifact order', () => {
    const planned = plan({
      approvedScenes: [approve(SECOND_SCENE)],
    })

    assert.deepEqual(planned.create.map(({ resultId }) => resultId), ['scene-002'])
    assert.deepEqual(planned.duplicates, [])

    const reversed = plan({
      approvedScenes: [approve(SECOND_SCENE), approve(FIRST_SCENE)],
    })
    assert.deepEqual(reversed.create.map(({ resultId }) => resultId), [
      'scene-001',
      'scene-002',
    ])
  })

  test('preserves edited text exactly and trims a nonempty edited heading for title', () => {
    const editedText = '  Wind tears the map.\nMaya does not move.  '
    const planned = plan({
      approvedScenes: [approve(FIRST_SCENE, {
        heading: '  EXT. RADIO TOWER - DAWN  ',
        sourceText: editedText,
      })],
    })

    assert.equal(planned.create[0]!.title, 'EXT. RADIO TOWER - DAWN')
    assert.equal(planned.create[0]!.prompt, editedText)
  })

  test('uses a Chinese scene-order title when the edited heading is blank', () => {
    const planned = plan({
      approvedScenes: [approve(SECOND_SCENE, { heading: ' \t ' })],
    })

    assert.equal(planned.create[0]!.title, '场景 2')
  })

  test('attaches exact metadata and only source-and-range-matching evidence', () => {
    const planned = plan({ approvedScenes: [approve(FIRST_SCENE)] })
    const expectedEvidence = [evidence('ev-first', FIRST_SCENE)]

    assert.deepEqual(planned.create[0], {
      resultId: 'scene-001',
      title: 'EXT. ROOFTOP - NIGHT',
      prompt: FIRST_SCENE.sourceText,
      metadataJson: {
        creatorSkill: {
          skillId: 'script-segmentation',
          skillVersion: '1.0.0',
          runFingerprint: RUN_FINGERPRINT,
          sourceNodeIds: [SOURCE_NODE_ID],
          sourceArtifactIds: ['scene-breakdown-001'],
          resultType: 'scene',
          resultId: 'scene-001',
          reviewStatus: 'approved',
          evidence: expectedEvidence,
        },
      },
      evidence: expectedEvidence,
    })
  })

  test('reports duplicates in Artifact order and omits them from create', () => {
    const duplicateMetadata = (resultId: string) => ({
      creatorSkill: {
        skillId: 'script-segmentation',
        runFingerprint: RUN_FINGERPRINT,
        resultId,
      },
    })
    const planned = plan({
      existingNodes: [
        { metadataJson: duplicateMetadata('scene-002') },
        { metadataJson: duplicateMetadata('scene-001') },
      ],
    })

    assert.deepEqual(planned.create, [])
    assert.deepEqual(planned.duplicates, ['scene-001', 'scene-002'])
  })

  test('ignores malformed and unrelated existing metadata', () => {
    const throwingMetadata = Object.create(null, {
      creatorSkill: { get() { throw new Error('unreadable metadata') } },
    })
    const planned = plan({
      approvedScenes: [approve(FIRST_SCENE)],
      existingNodes: [
        {},
        { metadataJson: null },
        { metadataJson: [] },
        { metadataJson: { creatorSkill: 'bad' } },
        { metadataJson: { creatorSkill: { skillId: 'other-skill', runFingerprint: RUN_FINGERPRINT, resultId: 'scene-001' } } },
        { metadataJson: { creatorSkill: { skillId: 'script-segmentation', runFingerprint: 'csf1_aaaaaaaa', resultId: 'scene-001' } } },
        { metadataJson: throwingMetadata },
      ],
    })

    assert.deepEqual(planned.create.map(({ resultId }) => resultId), ['scene-001'])
    assert.deepEqual(planned.duplicates, [])
  })
})

describe('planScriptSceneMaterialization validation', () => {
  test('rejects blank, padded, and non-string source node IDs with TypeError', () => {
    for (const sourceNodeId of ['', '   ', ' script-1 ', 42]) {
      assert.throws(
        () => plan({ sourceNodeId: sourceNodeId as string }),
        TypeError,
      )
    }
  })

  test('rejects blocked, wrong-skill, wrong-version, and invalid-fingerprint results', () => {
    const invalidResults: CreatorSkillRunResult[] = [
      resultFixture({ status: 'blocked' }),
      resultFixture({ skillId: 'other-skill' }),
      resultFixture({ skillVersion: '1.0.1' }),
      resultFixture({ runFingerprint: 'csf1_12AB34CD' }),
      resultFixture({ runFingerprint: 'bad_12ab34cd' }),
    ]

    for (const result of invalidResults) {
      assert.throws(() => plan({ result }), TypeError)
    }
  })

  test('requires exactly one valid scene-breakdown Artifact v1 for the supplied source', () => {
    const base = resultFixture().artifacts[0]!
    const invalidArtifacts = [
      [],
      [{ ...base, artifactType: 'other-artifact' }],
      [{ ...base, artifactVersion: 2 }],
      [{ ...base, sourceNodeIds: ['script-2'] }],
      [{ ...base, sourceNodeIds: [SOURCE_NODE_ID, 'script-2'] }],
      [base, { ...clone(base), artifactId: 'scene-breakdown-002' }],
    ]

    for (const artifacts of invalidArtifacts) {
      assert.throws(
        () => plan({ result: resultFixture({ artifacts }) }),
        TypeError,
      )
    }
  })

  test('rejects structurally invalid payloads and sparse scene arrays', () => {
    const base = resultFixture().artifacts[0]!
    const sparseScenes = Array<ScriptSceneDraft>(2)
    sparseScenes[0] = FIRST_SCENE
    const invalidPayloads: unknown[] = [
      null,
      { format: 'unknown', scenes: [FIRST_SCENE] },
      { format: 'headed-script', scenes: [] },
      { format: 'headed-script', scenes: sparseScenes },
      { format: 'headed-script', scenes: [{ ...FIRST_SCENE, order: 0 }] },
      { format: 'headed-script', scenes: [{ ...FIRST_SCENE, sceneId: ' ' }] },
      { format: 'headed-script', scenes: [{ ...FIRST_SCENE, reviewStatus: 'approved' }] },
    ]

    for (const payload of invalidPayloads) {
      const artifact = { ...base, payload }
      assert.throws(
        () => plan({ result: resultFixture({ artifacts: [artifact] }) }),
        TypeError,
      )
    }
  })

  test('rejects unknown or repeated approvals and non-approved drafts', () => {
    const unknown = approve(FIRST_SCENE, { sceneId: 'scene-999' })
    const repeated = [approve(FIRST_SCENE), approve(FIRST_SCENE)]
    const pending = { ...FIRST_SCENE } as unknown as ApprovedSceneDraft

    assert.throws(() => plan({ approvedScenes: [unknown] }), TypeError)
    assert.throws(() => plan({ approvedScenes: repeated }), TypeError)
    assert.throws(() => plan({ approvedScenes: [pending] }), TypeError)
  })

  test('rejects approved scenes with empty edited source text', () => {
    for (const sourceText of ['', '  \n\t ']) {
      assert.throws(
        () => plan({ approvedScenes: [approve(FIRST_SCENE, { sourceText })] }),
        TypeError,
      )
    }
  })
})

describe('planScriptSceneMaterialization purity', () => {
  test('does not mutate frozen inputs or alias inputs and output evidence', () => {
    const result = resultFixture()
    const approvedScenes = [approve(FIRST_SCENE)]
    const existingNodes = [{ metadataJson: { creatorSkill: { note: 'keep' } } }]
    const before = clone({ result, approvedScenes, existingNodes })
    deepFreeze(result)
    deepFreeze(approvedScenes)
    deepFreeze(existingNodes)

    const planned = planScriptSceneMaterialization({
      sourceNodeId: SOURCE_NODE_ID,
      result,
      approvedScenes,
      existingNodes,
    })

    assert.deepEqual({ result, approvedScenes, existingNodes }, before)
    assert.notStrictEqual(planned.create[0]!.evidence, result.evidence)
    assert.notStrictEqual(
      planned.create[0]!.evidence,
      planned.create[0]!.metadataJson.creatorSkill.evidence,
    )
    assert.notStrictEqual(planned.create[0]!.evidence[0], result.evidence[0])
    assert.notStrictEqual(
      planned.create[0]!.evidence[0],
      planned.create[0]!.metadataJson.creatorSkill.evidence[0],
    )

    planned.create[0]!.evidence[0]!.excerpt = 'changed output'
    planned.create[0]!.metadataJson.creatorSkill.sourceNodeIds.push('changed-output')
    assert.deepEqual({ result, approvedScenes, existingNodes }, before)
    assert.equal(
      planned.create[0]!.metadataJson.creatorSkill.evidence[0]!.excerpt,
      FIRST_SCENE.sourceText,
    )
  })

  test('returns deterministic equal values with fresh object graphs', () => {
    const input = {
      sourceNodeId: SOURCE_NODE_ID,
      result: resultFixture(),
      approvedScenes: [approve(SECOND_SCENE), approve(FIRST_SCENE)],
      existingNodes: [],
    }

    const first = planScriptSceneMaterialization(input)
    const second = planScriptSceneMaterialization(input)

    assert.deepEqual(first, second)
    assert.notStrictEqual(first, second)
    assert.notStrictEqual(first.create, second.create)
    assert.notStrictEqual(first.create[0], second.create[0])
  })

  test('has no React, network, UUID, time, random, or browser-global dependencies', () => {
    const source = readFileSync(
      new URL('./scriptSegmentationMaterialization.ts', import.meta.url),
      'utf8',
    )

    assert.doesNotMatch(source, /from ['"]react['"]|\bfetch\b|randomUUID|\bDate\b|Math\.random|\bwindow\b|\bdocument\b/)
  })
})
