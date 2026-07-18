/**
 * Public contract tests for pure script-scene materialization planning.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/skills/scriptSegmentationMaterialization.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type {
  CreatorSkillEvidence,
  CreatorSkillRunResult,
} from '../../../../lib/skills'
import { cloneCreatorSkillArtifact } from '../../../../lib/skills'
import type { ScriptSceneDraft } from '../../../../lib/skills/script-segmentation'
import { readSceneBreakdownPayload } from '../../../../lib/skills/narrative-beat-analysis/parser'
import {
  planScriptSceneMaterialization,
  type ApprovedSceneDraft,
} from './scriptSegmentationMaterialization'

const SOURCE_NODE_ID = 'script-1'
const RUN_FINGERPRINT = 'csf1_12ab34cd'
const SOURCE_ARTIFACT_ID = 'scene-breakdown-001'

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
    ruleId: 'HEADED_SCENE_BOUNDARY',
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
      artifactId: SOURCE_ARTIFACT_ID,
      artifactType: 'scene-breakdown',
      artifactVersion: 1,
      sourceNodeIds: [SOURCE_NODE_ID],
      sourceArtifactIds: [],
      payload: {
        format: 'headed-script',
        scenes: [clone(FIRST_SCENE), clone(SECOND_SCENE)],
      },
    }],
    evidence: [
      evidence('scene-evidence-001', FIRST_SCENE),
      evidence('scene-evidence-002', SECOND_SCENE),
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

type PlannerInput = Parameters<typeof planScriptSceneMaterialization>[0] & {
  approvalContext: {
    runFingerprint: string
    sourceArtifactId: string
  }
}

function approvalContext(overrides: Partial<PlannerInput['approvalContext']> = {}) {
  return {
    runFingerprint: RUN_FINGERPRINT,
    sourceArtifactId: SOURCE_ARTIFACT_ID,
    ...overrides,
  }
}

function plan(overrides: Partial<PlannerInput> = {}) {
  return planScriptSceneMaterialization({
    sourceNodeId: SOURCE_NODE_ID,
    result: resultFixture(),
    approvalContext: approvalContext(),
    approvedScenes: [approve(FIRST_SCENE), approve(SECOND_SCENE)],
    existingNodes: [],
    ...overrides,
  } as PlannerInput)
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

function defineOwnArrayMethod(
  array: unknown[],
  key: 'filter' | 'map' | 'every' | typeof Symbol.iterator,
  value: (...args: never[]) => unknown,
) {
  Object.defineProperty(array, key, {
    configurable: true,
    value,
  })
}

function throwingArraySlot<T>(entries: T[], index = 0): T[] {
  const array = entries.slice()
  Object.defineProperty(array, index, {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error('caller-controlled slot getter')
    },
  })
  return array
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

  test('keeps edited scene Artifacts valid for downstream handoff', () => {
    const editedText = 'Wind tears the map.\nMaya does not move.\nA siren sounds.'
    const planned = plan({
      approvedScenes: [approve(FIRST_SCENE, {
        heading: 'EXT. RADIO TOWER - DAWN',
        sourceText: editedText,
      })],
    })
    const artifact = planned.create[0]!.metadataJson.creatorSkill.approvedArtifact
    const payload = artifact.payload as {
      format: string
      scenes: Array<{ heading: string; sourceText: string; lineStart: number; lineEnd: number }>
    }

    assert.deepEqual(readSceneBreakdownPayload(artifact.payload).valid, true)
    assert.equal(payload.format, 'paragraph-fallback')
    assert.equal(payload.scenes[0]!.heading, '')
    assert.equal(payload.scenes[0]!.sourceText, editedText)
    assert.deepEqual(
      [payload.scenes[0]!.lineStart, payload.scenes[0]!.lineEnd],
      [1, 3],
    )
  })

  test('uses a Chinese scene-order title when the edited heading is blank', () => {
    const planned = plan({
      approvedScenes: [approve(SECOND_SCENE, { heading: ' \t ' })],
    })

    assert.equal(planned.create[0]!.title, '场景 2')
  })

  test('attaches exact metadata and only source-and-range-matching evidence', () => {
    const planned = plan({ approvedScenes: [approve(FIRST_SCENE)] })
    const expectedEvidence = [evidence('scene-evidence-001', FIRST_SCENE)]

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
          approvedArtifact: {
            artifactId: 'scene-breakdown-scene-001-approved',
            artifactType: 'scene-breakdown',
            artifactVersion: 1,
            sourceNodeIds: [SOURCE_NODE_ID],
            sourceArtifactIds: [SOURCE_ARTIFACT_ID],
            payload: {
              format: 'headed-script',
              scenes: [{
                sceneId: 'scene-001',
                order: 1,
                heading: 'EXT. ROOFTOP - NIGHT',
                characters: [],
                actionSummary: FIRST_SCENE.sourceText,
                sourceText: FIRST_SCENE.sourceText,
                lineStart: 1,
                lineEnd: 2,
                reviewStatus: 'pending',
              }],
            },
          },
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
        { metadataJson: Object.create({
          creatorSkill: {
            skillId: 'script-segmentation',
            runFingerprint: RUN_FINGERPRINT,
            resultId: 'scene-001',
          },
        }) },
        { metadataJson: {
          creatorSkill: Object.create({
            skillId: 'script-segmentation',
            runFingerprint: RUN_FINGERPRINT,
            resultId: 'scene-001',
          }),
        } },
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

  test('binds approvals to the exact run fingerprint and source Artifact', () => {
    const rerun = resultFixture({ runFingerprint: 'csf1_deadbeef' })
    const changedArtifactResult = resultFixture()
    changedArtifactResult.artifacts[0] = {
      ...changedArtifactResult.artifacts[0]!,
      artifactId: 'scene-breakdown-002',
    }

    assert.throws(() => plan({ result: rerun }), TypeError)
    assert.throws(() => plan({ result: changedArtifactResult }), TypeError)
    assert.throws(() => plan({
      approvalContext: approvalContext({ runFingerprint: 'csf1_deadbeef' }),
    }), TypeError)
    assert.throws(() => plan({
      approvalContext: approvalContext({ sourceArtifactId: 'scene-breakdown-002' }),
    }), TypeError)
  })

  test('rejects approvals whose immutable scene fields differ from the Artifact', () => {
    const changedDrafts: ApprovedSceneDraft[] = [
      approve(FIRST_SCENE, { order: 2 }),
      approve(FIRST_SCENE, { location: 'Different place' }),
      approve(FIRST_SCENE, { timeOfDay: 'DAY' }),
      approve(FIRST_SCENE, { characters: ['Someone else'] }),
      approve(FIRST_SCENE, { actionSummary: 'Changed summary' }),
      approve(FIRST_SCENE, { lineStart: 2 }),
      approve(FIRST_SCENE, { lineEnd: 3 }),
    ]

    for (const changed of changedDrafts) {
      assert.throws(() => plan({ approvedScenes: [changed] }), TypeError)
    }
  })

  test('treats absent and own undefined optional scene fields as equivalent', () => {
    const approvalWithUndefined = approve(FIRST_SCENE, {
      location: undefined,
      timeOfDay: undefined,
    })
    const artifactWithUndefined = resultFixture()
    const payload = artifactWithUndefined.artifacts[0]!.payload as {
      format: 'headed-script'
      scenes: ScriptSceneDraft[]
    }
    payload.scenes[0]!.location = undefined
    payload.scenes[0]!.timeOfDay = undefined

    const fromUndefinedApproval = plan({
      approvedScenes: [approvalWithUndefined],
    })
    const fromUndefinedArtifact = plan({
      result: artifactWithUndefined,
      approvedScenes: [approve(FIRST_SCENE)],
    })

    assert.deepEqual(
      fromUndefinedApproval.create.map(({ resultId }) => resultId),
      ['scene-001'],
    )
    assert.deepEqual(
      fromUndefinedArtifact.create.map(({ resultId }) => resultId),
      ['scene-001'],
    )
    const approvedArtifact = fromUndefinedApproval.create[0]!
      .metadataJson.creatorSkill.approvedArtifact
    const approvedScene = (approvedArtifact.payload as {
      scenes: Array<Record<string, unknown>>
    }).scenes[0]!
    assert.doesNotThrow(() => cloneCreatorSkillArtifact(approvedArtifact))
    assert.equal(Object.prototype.hasOwnProperty.call(approvedScene, 'location'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(approvedScene, 'timeOfDay'), false)
  })

  test('rejects inherited required values in results, Artifacts, scenes, and approvals', () => {
    const inheritedResult = resultFixture() as CreatorSkillRunResult & Record<string, unknown>
    Reflect.deleteProperty(inheritedResult, 'skillId')
    Object.setPrototypeOf(inheritedResult, { skillId: 'script-segmentation' })

    const inheritedArtifactResult = resultFixture()
    const artifact = inheritedArtifactResult.artifacts[0]! as typeof inheritedArtifactResult.artifacts[number] & Record<string, unknown>
    Reflect.deleteProperty(artifact, 'artifactId')
    Object.setPrototypeOf(artifact, { artifactId: SOURCE_ARTIFACT_ID })

    const inheritedSceneResult = resultFixture()
    const payload = inheritedSceneResult.artifacts[0]!.payload as {
      format: 'headed-script'
      scenes: Array<ScriptSceneDraft & Record<string, unknown>>
    }
    Reflect.deleteProperty(payload.scenes[0]!, 'order')
    Object.setPrototypeOf(payload.scenes[0]!, { order: 1 })

    const inheritedApproval = approve(FIRST_SCENE) as ApprovedSceneDraft & Record<string, unknown>
    Reflect.deleteProperty(inheritedApproval, 'actionSummary')
    Object.setPrototypeOf(inheritedApproval, { actionSummary: FIRST_SCENE.actionSummary })

    assert.throws(() => plan({ result: inheritedResult }), TypeError)
    assert.throws(() => plan({ result: inheritedArtifactResult }), TypeError)
    assert.throws(() => plan({ result: inheritedSceneResult }), TypeError)
    assert.throws(() => plan({ approvedScenes: [inheritedApproval] }), TypeError)
  })

  test('rejects required accessor properties without invoking changing getters', () => {
    let contextReads = 0
    const context = approvalContext()
    Object.defineProperty(context, 'runFingerprint', {
      enumerable: true,
      get() {
        contextReads += 1
        return contextReads === 1 ? RUN_FINGERPRINT : 'csf1_deadbeef'
      },
    })

    let headingReads = 0
    const approved = approve(FIRST_SCENE)
    Object.defineProperty(approved, 'heading', {
      enumerable: true,
      get() {
        headingReads += 1
        return headingReads === 1 ? FIRST_SCENE.heading : 'Changed heading'
      },
    })

    assert.throws(() => plan({ approvalContext: context }), TypeError)
    assert.throws(() => plan({ approvedScenes: [approved] }), TypeError)
    assert.equal(contextReads, 0)
    assert.equal(headingReads, 0)
  })
})

describe('planScriptSceneMaterialization evidence integrity', () => {
  test('rejects malformed evidence even when it belongs to an unapproved scene', () => {
    const result = resultFixture()
    result.evidence[1] = {
      ...result.evidence[1]!,
      ruleId: '',
    }

    assert.throws(() => plan({
      result,
      approvedScenes: [approve(FIRST_SCENE)],
    }), TypeError)
  })

  test('rejects missing evidence before materializing any approved scene', () => {
    const result = resultFixture({
      evidence: [evidence('scene-evidence-001', FIRST_SCENE)],
    })

    assert.throws(() => plan({
      result,
      approvedScenes: [approve(FIRST_SCENE)],
    }), TypeError)
  })

  test('rejects duplicate evidence IDs and ambiguous scene ranges', () => {
    const duplicateIds = resultFixture()
    duplicateIds.evidence[1] = {
      ...duplicateIds.evidence[1]!,
      evidenceId: 'scene-evidence-001',
    }
    const ambiguousRanges = resultFixture()
    ambiguousRanges.evidence[1] = {
      ...ambiguousRanges.evidence[1]!,
      sourceNodeId: SOURCE_NODE_ID,
      lineStart: FIRST_SCENE.lineStart,
      lineEnd: FIRST_SCENE.lineEnd,
      excerpt: FIRST_SCENE.sourceText,
    }

    assert.throws(() => plan({ result: duplicateIds }), TypeError)
    assert.throws(() => plan({ result: ambiguousRanges }), TypeError)
  })

  test('rejects unstable IDs and evidence that does not match scene source identity', () => {
    const unstableId = resultFixture()
    unstableId.evidence[0] = {
      ...unstableId.evidence[0]!,
      evidenceId: 'other-evidence-id',
    }
    const wrongExcerpt = resultFixture()
    wrongExcerpt.evidence[0] = {
      ...wrongExcerpt.evidence[0]!,
      excerpt: 'Different source excerpt',
    }
    const wrongSource = resultFixture()
    wrongSource.evidence[0] = {
      ...wrongSource.evidence[0]!,
      sourceNodeId: 'script-2',
    }

    assert.throws(() => plan({ result: unstableId }), TypeError)
    assert.throws(() => plan({ result: wrongExcerpt }), TypeError)
    assert.throws(() => plan({ result: wrongSource }), TypeError)
  })

  test('rejects inherited and accessor-backed evidence fields without invoking getters', () => {
    const inherited = resultFixture()
    const inheritedEvidence = inherited.evidence[0]! as CreatorSkillEvidence & Record<string, unknown>
    Reflect.deleteProperty(inheritedEvidence, 'excerpt')
    Object.setPrototypeOf(inheritedEvidence, { excerpt: FIRST_SCENE.sourceText })

    let excerptReads = 0
    const accessor = resultFixture()
    Object.defineProperty(accessor.evidence[0]!, 'excerpt', {
      enumerable: true,
      get() {
        excerptReads += 1
        return excerptReads === 1 ? FIRST_SCENE.sourceText : 'Changed excerpt'
      },
    })

    assert.throws(() => plan({ result: inherited }), TypeError)
    assert.throws(() => plan({ result: accessor }), TypeError)
    assert.equal(excerptReads, 0)
  })
})

describe('planScriptSceneMaterialization hostile arrays', () => {
  test('rejects two indexed Artifacts when an own filter tries to hide one', () => {
    const firstArtifact = resultFixture().artifacts[0]!
    const artifacts = [
      firstArtifact,
      { ...clone(firstArtifact), artifactId: 'scene-breakdown-002' },
    ]
    defineOwnArrayMethod(artifacts, 'filter', () => [artifacts[0]!])
    defineOwnArrayMethod(artifacts, 'map', () => { throw new Error('must not call map') })
    defineOwnArrayMethod(artifacts, 'every', () => { throw new Error('must not call every') })
    defineOwnArrayMethod(artifacts, Symbol.iterator, () => { throw new Error('must not iterate') })

    assert.throws(
      () => plan({ result: resultFixture({ artifacts }) }),
      TypeError,
    )
  })

  test('preserves indexed Artifact scene order despite a reversing iterator', () => {
    const result = resultFixture()
    const payload = result.artifacts[0]!.payload as {
      format: 'headed-script'
      scenes: ScriptSceneDraft[]
    }
    defineOwnArrayMethod(payload.scenes, Symbol.iterator, function* () {
      yield payload.scenes[1]!
      yield payload.scenes[0]!
    })

    const planned = plan({ result })

    assert.deepEqual(planned.create.map(({ resultId }) => resultId), [
      'scene-001',
      'scene-002',
    ])
  })

  test('ignores an own scenes map that tries to hide indexed scene IDs', () => {
    const result = resultFixture()
    const payload = result.artifacts[0]!.payload as {
      format: 'headed-script'
      scenes: ScriptSceneDraft[]
    }
    defineOwnArrayMethod(payload.scenes, 'map', () => [])
    defineOwnArrayMethod(payload.scenes, 'filter', () => { throw new Error('must not call filter') })
    defineOwnArrayMethod(payload.scenes, 'every', () => { throw new Error('must not call every') })

    const planned = plan({ result })

    assert.deepEqual(planned.create.map(({ resultId }) => resultId), [
      'scene-001',
      'scene-002',
    ])
  })

  test('rejects invalid indexed characters when an own every lies about them', () => {
    const result = resultFixture()
    const payload = result.artifacts[0]!.payload as {
      format: 'headed-script'
      scenes: ScriptSceneDraft[]
    }
    const characters = [42] as unknown as string[]
    defineOwnArrayMethod(characters, 'every', () => true)
    defineOwnArrayMethod(characters, 'filter', () => { throw new Error('must not call filter') })
    defineOwnArrayMethod(characters, 'map', () => { throw new Error('must not call map') })
    defineOwnArrayMethod(characters, Symbol.iterator, () => { throw new Error('must not iterate') })
    payload.scenes[0] = { ...payload.scenes[0]!, characters }

    assert.throws(() => plan({ result }), TypeError)
  })

  test('does not let an approval iterator skip an invalid indexed approval', () => {
    const approvedScenes = [
      approve(FIRST_SCENE),
      approve(SECOND_SCENE, { sceneId: 'scene-999' }),
    ]
    defineOwnArrayMethod(approvedScenes, 'filter', () => { throw new Error('must not call filter') })
    defineOwnArrayMethod(approvedScenes, 'map', () => { throw new Error('must not call map') })
    defineOwnArrayMethod(approvedScenes, 'every', () => { throw new Error('must not call every') })
    defineOwnArrayMethod(approvedScenes, Symbol.iterator, function* () {
      yield approvedScenes[0]!
    })

    assert.throws(() => plan({ approvedScenes }), TypeError)
  })

  test('reads evidence by indexed slots despite a hiding iterator', () => {
    const result = resultFixture()
    defineOwnArrayMethod(result.evidence, 'filter', () => { throw new Error('must not call filter') })
    defineOwnArrayMethod(result.evidence, 'map', () => { throw new Error('must not call map') })
    defineOwnArrayMethod(result.evidence, 'every', () => { throw new Error('must not call every') })
    defineOwnArrayMethod(result.evidence, Symbol.iterator, function* () {
      yield result.evidence[1]!
    })

    const planned = plan({
      result,
      approvedScenes: [approve(FIRST_SCENE)],
    })

    assert.deepEqual(
      planned.create[0]!.evidence.map(({ evidenceId }) => evidenceId),
      ['scene-evidence-001'],
    )
  })

  test('detects duplicate existing nodes without invoking own array methods', () => {
    const existingNodes = [{
      metadataJson: {
        creatorSkill: {
          skillId: 'script-segmentation',
          runFingerprint: RUN_FINGERPRINT,
          resultId: 'scene-001',
        },
      },
    }]
    defineOwnArrayMethod(existingNodes, 'filter', () => { throw new Error('must not call filter') })
    defineOwnArrayMethod(existingNodes, 'map', () => { throw new Error('must not call map') })
    defineOwnArrayMethod(existingNodes, 'every', () => { throw new Error('must not call every') })
    defineOwnArrayMethod(existingNodes, Symbol.iterator, () => { throw new Error('must not iterate') })

    const planned = plan({
      approvedScenes: [approve(FIRST_SCENE)],
      existingNodes,
    })

    assert.deepEqual(planned.create, [])
    assert.deepEqual(planned.duplicates, ['scene-001'])
  })

  test('contains caller-controlled collection slot getters as TypeError', () => {
    const artifact = resultFixture().artifacts[0]!
    const sceneWithThrowingCharacters = {
      ...FIRST_SCENE,
      characters: throwingArraySlot(['Maya']),
    }
    const cases: Array<() => unknown> = [
      () => plan({
        result: resultFixture({ artifacts: throwingArraySlot([artifact]) }),
      }),
      () => plan({
        result: resultFixture({
          artifacts: [{
            ...artifact,
            payload: {
              format: 'headed-script',
              scenes: throwingArraySlot([FIRST_SCENE]),
            },
          }],
        }),
      }),
      () => plan({
        result: resultFixture({
          artifacts: [{
            ...artifact,
            payload: {
              format: 'headed-script',
              scenes: [sceneWithThrowingCharacters],
            },
          }],
        }),
      }),
      () => plan({ approvedScenes: throwingArraySlot([approve(FIRST_SCENE)]) }),
      () => plan({
        result: resultFixture({
          evidence: throwingArraySlot([evidence('ev-first', FIRST_SCENE)]),
        }),
        approvedScenes: [approve(FIRST_SCENE)],
      }),
      () => plan({
        approvedScenes: [approve(FIRST_SCENE)],
        existingNodes: throwingArraySlot([{ metadataJson: {} }]),
      }),
    ]

    for (const run of cases) assert.throws(run, TypeError)
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
      approvalContext: approvalContext(),
      approvedScenes,
      existingNodes,
    } as PlannerInput)

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
      approvalContext: approvalContext(),
      approvedScenes: [approve(SECOND_SCENE), approve(FIRST_SCENE)],
      existingNodes: [],
    } as PlannerInput

    const first = planScriptSceneMaterialization(input)
    const second = planScriptSceneMaterialization(input)

    assert.deepEqual(first, second)
    assert.notStrictEqual(first, second)
    assert.notStrictEqual(first.create, second.create)
    assert.notStrictEqual(first.create[0], second.create[0])
  })

  test('succeeds when time, randomness, and network globals throw', () => {
    const originalNow = Date.now
    const originalRandom = Math.random
    const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
    Date.now = () => { throw new Error('must not read time') }
    Math.random = () => { throw new Error('must not read randomness') }
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: () => { throw new Error('must not access network') },
    })

    try {
      const planned = plan({ approvedScenes: [approve(FIRST_SCENE)] })
      assert.deepEqual(planned.create.map(({ resultId }) => resultId), ['scene-001'])
    } finally {
      Date.now = originalNow
      Math.random = originalRandom
      if (fetchDescriptor) {
        Object.defineProperty(globalThis, 'fetch', fetchDescriptor)
      } else {
        delete (globalThis as { fetch?: unknown }).fetch
      }
    }
  })
})
