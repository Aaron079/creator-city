/**
 * Public contract tests for approved grouped Creator Skill materialization.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/skills/groupedSkillMaterialization.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type {
  CreatorSkillArtifact,
  CreatorSkillEvidence,
  CreatorSkillRunResult,
} from '../../../../lib/skills'
import { cloneCreatorSkillArtifact } from '../../../../lib/skills'
import {
  planNarrativeBeatMaterialization,
  planShotPlanMaterialization,
  shotPlanApplyMatchesCurrentSource,
  type ApprovedNarrativeBeatScene,
  type ApprovedShotPlanScene,
} from './groupedSkillMaterialization'

const SOURCE_NODE_ID = 'script-1'
const RUN_FINGERPRINT = 'csf1_12ab34cd'

function evidence(
  evidenceId: string,
  ruleId: string,
  lineStart: number,
  excerpt: string,
): CreatorSkillEvidence {
  return {
    evidenceId,
    ruleId,
    sourceNodeId: SOURCE_NODE_ID,
    lineStart,
    lineEnd: lineStart,
    excerpt,
    explanation: `Evidence for ${evidenceId}`,
  }
}

const NARRATIVE_ARTIFACT_ID = 'narrative-beat-map-001'
const NARRATIVE_SCENES = [{
  sceneId: 'scene-001',
  order: 1,
  heading: 'EXT. ROOFTOP - NIGHT',
  beats: [{
    beatId: 'scene-001-beat-001',
    sceneId: 'scene-001',
    order: 1,
    type: 'setup' as const,
    sourceText: 'Maya reaches the roof.',
    summary: 'Maya arrives.',
    lineStart: 2,
    lineEnd: 2,
    reviewStatus: 'pending' as const,
  }, {
    beatId: 'scene-001-beat-002',
    sceneId: 'scene-001',
    order: 2,
    type: 'turn' as const,
    sourceText: 'The lights suddenly fail.',
    summary: 'The power fails.',
    lineStart: 3,
    lineEnd: 3,
    reviewStatus: 'pending' as const,
  }],
}, {
  sceneId: 'scene-002',
  order: 2,
  heading: 'INT. STATION - DAY',
  beats: [{
    beatId: 'scene-002-beat-001',
    sceneId: 'scene-002',
    order: 1,
    type: 'action' as const,
    sourceText: 'Maya boards the train.',
    summary: 'Maya boards.',
    lineStart: 6,
    lineEnd: 6,
    reviewStatus: 'pending' as const,
  }],
}]

const NARRATIVE_EVIDENCE = [
  evidence('narrative-beat-evidence-001-001', 'NARRATIVE_SETUP', 2, 'Maya reaches the roof.'),
  evidence('narrative-beat-evidence-001-002', 'NARRATIVE_TURN', 3, 'The lights suddenly fail.'),
  evidence('narrative-beat-evidence-002-001', 'NARRATIVE_ACTION', 6, 'Maya boards the train.'),
]

function narrativeResult(overrides: Partial<CreatorSkillRunResult> = {}): CreatorSkillRunResult {
  return {
    skillId: 'narrative-beat-analysis',
    skillVersion: '1.0.0',
    runFingerprint: RUN_FINGERPRINT,
    status: 'ready',
    artifacts: [{
      artifactId: NARRATIVE_ARTIFACT_ID,
      artifactType: 'narrative-beat-map',
      artifactVersion: 1,
      sourceNodeIds: [SOURCE_NODE_ID],
      sourceArtifactIds: ['scene-breakdown-001'],
      payload: { scenes: structuredClone(NARRATIVE_SCENES) },
    }],
    evidence: structuredClone(NARRATIVE_EVIDENCE),
    warnings: [],
    blockers: [],
    ...overrides,
  }
}

function approvedNarrativeScene(
  sceneIndex: number,
  beatIndexes: number[],
): ApprovedNarrativeBeatScene {
  const source = NARRATIVE_SCENES[sceneIndex]!
  return {
    sceneId: source.sceneId,
    order: source.order,
    heading: source.heading,
    beats: beatIndexes.map((index) => ({
      ...structuredClone(source.beats[index]!),
      reviewStatus: 'approved' as const,
    })),
  }
}

function narrativePlan(overrides: Record<string, unknown> = {}) {
  return planNarrativeBeatMaterialization({
    result: narrativeResult(),
    approvalContext: {
      runFingerprint: RUN_FINGERPRINT,
      sourceArtifactId: NARRATIVE_ARTIFACT_ID,
    },
    approvedScenes: [approvedNarrativeScene(0, [1, 0]), approvedNarrativeScene(1, [0])],
    existingNodes: [],
    ...overrides,
  } as Parameters<typeof planNarrativeBeatMaterialization>[0])
}

function approvedNarrativeSceneFromResult(
  result: CreatorSkillRunResult,
  sceneIndex: number,
  beatIndexes?: number[],
): ApprovedNarrativeBeatScene {
  const payload = result.artifacts[0]!.payload as { scenes: typeof NARRATIVE_SCENES }
  const source = payload.scenes[sceneIndex]!
  const indexes = beatIndexes ?? source.beats.map((_, index) => index)
  return {
    ...structuredClone(source),
    beats: indexes.map((index) => ({
      ...structuredClone(source.beats[index]!),
      reviewStatus: 'approved' as const,
    })),
  }
}

function syncNarrativeEvidence(result: CreatorSkillRunResult) {
  const payload = result.artifacts[0]!.payload as { scenes: typeof NARRATIVE_SCENES }
  result.evidence = payload.scenes.flatMap((scene) => scene.beats.map((beat) => evidence(
    `narrative-beat-evidence-${String(scene.order).padStart(3, '0')}-${String(beat.order).padStart(3, '0')}`,
    'NARRATIVE_BEAT',
    beat.lineStart,
    beat.sourceText,
  )).map((item, index) => ({
    ...item,
    lineEnd: scene.beats[index]!.lineEnd,
  })))
}

const SHOT_ARTIFACT_ID = 'shot-plan-001'
const SHOT_SCENES = [{
  sceneId: 'scene-001',
  order: 1,
  heading: 'EXT. ROOFTOP - NIGHT',
  shots: [{
    shotId: 'scene-001-shot-001',
    sceneId: 'scene-001',
    beatId: 'scene-001-beat-001',
    order: 1,
    objective: 'Establish the rooftop.',
    subject: 'Maya',
    action: 'reaches the roof',
    suggestedShotSize: 'wide' as const,
    sourceText: 'Maya reaches the roof.',
    lineStart: 2,
    lineEnd: 2,
    outputKind: 'image' as const,
    duration: 5 as const,
    reviewStatus: 'pending' as const,
  }, {
    shotId: 'scene-001-shot-002',
    sceneId: 'scene-001',
    beatId: 'scene-001-beat-002',
    order: 2,
    objective: 'Capture the turn.',
    subject: 'The rooftop lights',
    action: 'fail',
    suggestedShotSize: 'close' as const,
    sourceText: 'The lights suddenly fail.',
    lineStart: 3,
    lineEnd: 3,
    outputKind: 'video' as const,
    duration: 10 as const,
    reviewStatus: 'pending' as const,
  }],
}]

const SHOT_EVIDENCE = [
  evidence('shot-plan-evidence-001-001', 'SHOT_PRIMARY_SOURCE_UNIT', 2, 'Maya reaches the roof.'),
  evidence('shot-plan-evidence-001-002', 'SHOT_PRIMARY_SOURCE_UNIT', 3, 'The lights suddenly fail.'),
]

function shotResult(overrides: Partial<CreatorSkillRunResult> = {}): CreatorSkillRunResult {
  return {
    skillId: 'shot-planning',
    skillVersion: '1.0.0',
    runFingerprint: RUN_FINGERPRINT,
    status: 'needs-review',
    artifacts: [{
      artifactId: SHOT_ARTIFACT_ID,
      artifactType: 'shot-plan',
      artifactVersion: 1,
      sourceNodeIds: [SOURCE_NODE_ID],
      sourceArtifactIds: [NARRATIVE_ARTIFACT_ID],
      payload: { scenes: structuredClone(SHOT_SCENES) },
    }],
    evidence: structuredClone(SHOT_EVIDENCE),
    warnings: [],
    blockers: [],
    ...overrides,
  }
}

function approvedShotScene(indexes: number[]): ApprovedShotPlanScene {
  const source = SHOT_SCENES[0]!
  return {
    sceneId: source.sceneId,
    order: source.order,
    heading: source.heading,
    shots: indexes.map((index) => ({
      ...structuredClone(source.shots[index]!),
      reviewStatus: 'approved' as const,
    })),
  }
}

function shotPlan(overrides: Record<string, unknown> = {}) {
  return planShotPlanMaterialization({
    result: shotResult(),
    approvalContext: {
      runFingerprint: RUN_FINGERPRINT,
      sourceArtifactId: SHOT_ARTIFACT_ID,
    },
    approvedScenes: [approvedShotScene([1, 0])],
    existingNodes: [],
    ...overrides,
  } as Parameters<typeof planShotPlanMaterialization>[0])
}

function approvedShotSceneFromResult(
  result: CreatorSkillRunResult,
  indexes?: number[],
): ApprovedShotPlanScene {
  const payload = result.artifacts[0]!.payload as { scenes: typeof SHOT_SCENES }
  const source = payload.scenes[0]!
  const reviewedIndexes = indexes ?? source.shots.map((_, index) => index)
  return {
    ...structuredClone(source),
    shots: reviewedIndexes.map((index) => ({
      ...structuredClone(source.shots[index]!),
      reviewStatus: 'approved' as const,
    })),
  }
}

function syncShotEvidence(result: CreatorSkillRunResult) {
  const payload = result.artifacts[0]!.payload as { scenes: typeof SHOT_SCENES }
  result.evidence = payload.scenes.flatMap((scene) => scene.shots.map((shot) => evidence(
    `shot-plan-evidence-${String(scene.order).padStart(3, '0')}-${String(shot.order).padStart(3, '0')}`,
    'SHOT_PRIMARY_SOURCE_UNIT',
    shot.lineStart,
    shot.sourceText,
  )).map((item, index) => ({
    ...item,
    lineEnd: scene.shots[index]!.lineEnd,
  })))
}

function narrativeResultWithShape(
  sceneCount: number,
  beatsPerScene: number,
): CreatorSkillRunResult {
  let line = 1
  const scenes = Array.from({ length: sceneCount }, (_, sceneIndex) => {
    const order = sceneIndex + 1
    const sceneId = `scene-${String(order).padStart(3, '0')}`
    const beats = Array.from({ length: beatsPerScene }, (_, beatIndex) => {
      const beatOrder = beatIndex + 1
      const sourceText = `Action ${order}.${beatOrder}.`
      const beat = {
        beatId: `${sceneId}-beat-${String(beatOrder).padStart(3, '0')}`,
        sceneId,
        order: beatOrder,
        type: 'action' as const,
        sourceText,
        summary: sourceText,
        lineStart: line,
        lineEnd: line,
        reviewStatus: 'pending' as const,
      }
      line += 1
      return beat
    })
    return { sceneId, order, heading: `Scene ${order}`, beats }
  })
  return {
    skillId: 'narrative-beat-analysis',
    skillVersion: '1.0.0',
    runFingerprint: RUN_FINGERPRINT,
    status: 'ready',
    artifacts: [{
      artifactId: NARRATIVE_ARTIFACT_ID,
      artifactType: 'narrative-beat-map',
      artifactVersion: 1,
      sourceNodeIds: [SOURCE_NODE_ID],
      sourceArtifactIds: ['scene-breakdown-001'],
      payload: { scenes },
    }],
    evidence: scenes.flatMap((scene) => scene.beats.map((beat) => evidence(
      `narrative-beat-evidence-${String(scene.order).padStart(3, '0')}-${String(beat.order).padStart(3, '0')}`,
      'NARRATIVE_BEAT',
      beat.lineStart,
      beat.sourceText,
    ))),
    warnings: [],
    blockers: [],
  }
}

function approvedNarrativeScenesFromResult(
  result: CreatorSkillRunResult,
): ApprovedNarrativeBeatScene[] {
  const payload = result.artifacts[0]!.payload as {
    scenes: Array<ApprovedNarrativeBeatScene>
  }
  return payload.scenes.map((scene) => ({
    ...structuredClone(scene),
    beats: scene.beats.map((beat) => ({
      ...structuredClone(beat),
      reviewStatus: 'approved' as const,
    })),
  }))
}

function shotResultWithCount(shotCount: number): CreatorSkillRunResult {
  const sceneId = 'scene-001'
  const shots = Array.from({ length: shotCount }, (_, index) => {
    const order = index + 1
    const sourceText = `Shot source ${order}.`
    return {
      shotId: `${sceneId}-shot-${String(order).padStart(3, '0')}`,
      sceneId,
      beatId: `${sceneId}-beat-${String(order).padStart(3, '0')}`,
      order,
      objective: `Objective ${order}`,
      subject: 'Maya',
      action: `acts ${order}`,
      suggestedShotSize: 'medium' as const,
      sourceText,
      lineStart: order,
      lineEnd: order,
      outputKind: 'image' as const,
      duration: 5 as const,
      reviewStatus: 'pending' as const,
    }
  })
  return {
    skillId: 'shot-planning',
    skillVersion: '1.0.0',
    runFingerprint: RUN_FINGERPRINT,
    status: 'ready',
    artifacts: [{
      artifactId: SHOT_ARTIFACT_ID,
      artifactType: 'shot-plan',
      artifactVersion: 1,
      sourceNodeIds: [SOURCE_NODE_ID],
      sourceArtifactIds: [NARRATIVE_ARTIFACT_ID],
      payload: { scenes: [{ sceneId, order: 1, heading: 'Scene 1', shots }] },
    }],
    evidence: shots.map((shot) => evidence(
      `shot-plan-evidence-001-${String(shot.order).padStart(3, '0')}`,
      'SHOT_PRIMARY_SOURCE_UNIT',
      shot.lineStart,
      shot.sourceText,
    )),
    warnings: [],
    blockers: [],
  }
}

function deepFreeze(value: unknown, seen = new Set<object>()): void {
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor && 'value' in descriptor) deepFreeze(descriptor.value, seen)
  }
  Object.freeze(value)
}

describe('grouped narrative beat materialization', () => {
  test('creates one approved plan per nonempty scene in Artifact scene order', () => {
    const planned = narrativePlan()

    assert.deepEqual(planned.create.map(({ resultId }) => resultId), ['scene-001', 'scene-002'])
    assert.deepEqual(planned.duplicates, [])
    assert.equal(planned.create[0]!.title, 'EXT. ROOFTOP - NIGHT · Narrative Beats')
    assert.equal(planned.create[0]!.prompt, [
      'Scene: EXT. ROOFTOP - NIGHT',
      '',
      'Beat 1',
      'Type: turn',
      'Summary: The power fails.',
      'Source: The lights suddenly fail.',
      '',
      'Beat 2',
      'Type: setup',
      'Summary: Maya arrives.',
      'Source: Maya reaches the roof.',
    ].join('\n'))
    const approvedPayload = planned.create[0]!.metadataJson.creatorSkill
      .approvedArtifact.payload as { scenes: Array<{ beats: Array<{ beatId: string }> }> }
    assert.deepEqual(
      approvedPayload.scenes[0]!.beats.map(({ beatId }) => beatId),
      ['scene-001-beat-002', 'scene-001-beat-001'],
    )
  })

  test('persists only approved edited beats in exact reviewed order with immutable provenance', () => {
    const approved = approvedNarrativeScene(0, [1])
    approved.beats[0] = {
      ...approved.beats[0]!,
      type: 'closure',
      summary: 'Edited founder summary.',
    }
    const planned = narrativePlan({ approvedScenes: [approved] })
    const metadata = planned.create[0]!.metadataJson.creatorSkill

    assert.deepEqual(metadata, {
      skillId: 'narrative-beat-analysis',
      skillVersion: '1.0.0',
      runFingerprint: RUN_FINGERPRINT,
      sourceNodeIds: [SOURCE_NODE_ID],
      sourceArtifactIds: [NARRATIVE_ARTIFACT_ID],
      resultType: 'narrative-beat-map',
      resultId: 'scene-001',
      reviewStatus: 'approved',
      evidence: [NARRATIVE_EVIDENCE[1]],
      approvedArtifact: {
        artifactId: 'narrative-beat-map-scene-001-approved',
        artifactType: 'narrative-beat-map',
        artifactVersion: 1,
        sourceNodeIds: [SOURCE_NODE_ID],
        sourceArtifactIds: [NARRATIVE_ARTIFACT_ID],
        payload: {
          scenes: [{
            sceneId: 'scene-001',
            order: 1,
            heading: 'EXT. ROOFTOP - NIGHT',
            beats: [{
              ...NARRATIVE_SCENES[0]!.beats[1]!,
              type: 'closure',
              summary: 'Edited founder summary.',
            }],
          }],
        },
      },
    })
  })

  test('omits deleted and empty scenes and deduplicates by skill, fingerprint, and result', () => {
    const planned = narrativePlan({
      approvedScenes: [approvedNarrativeScene(0, [0])],
      existingNodes: [{ metadataJson: { creatorSkill: {
        skillId: 'narrative-beat-analysis',
        runFingerprint: RUN_FINGERPRINT,
        resultId: 'scene-001',
      } } }],
    })

    assert.deepEqual(planned.create, [])
    assert.deepEqual(planned.duplicates, ['scene-001'])
  })
})

describe('grouped shot-plan materialization', () => {
  test('apply guard compares the live carrier with the reviewed source snapshot', () => {
    const planned = shotPlan().create
    const reviewedSource = {
      sourceNodeId: SOURCE_NODE_ID,
      sourceText: 'Scene: Scene 1\n\nBeat 1\nSource: Maya reaches the roof.',
    }
    const currentSource = {
      id: SOURCE_NODE_ID,
      kind: 'text',
      prompt: reviewedSource.sourceText,
    }

    assert.equal(
      shotPlanApplyMatchesCurrentSource(planned, reviewedSource, currentSource),
      true,
    )
    assert.equal(
      shotPlanApplyMatchesCurrentSource(planned, reviewedSource, {
        ...currentSource,
        prompt: `${reviewedSource.sourceText} changed`,
      }),
      false,
    )
    assert.equal(
      shotPlanApplyMatchesCurrentSource(planned, {
        ...reviewedSource,
        sourceNodeId: 'different-node',
      }, currentSource),
      false,
    )
  })

  test('persists edited approved shots in reviewed order without changing identity or evidence', () => {
    const approved = approvedShotScene([1, 0])
    approved.shots[0] = {
      ...approved.shots[0]!,
      objective: 'Edited turn objective.',
      suggestedShotSize: 'extreme-close',
      outputKind: 'image',
      duration: 5,
    }
    const planned = shotPlan({ approvedScenes: [approved] })
    const metadata = planned.create[0]!.metadataJson.creatorSkill
    const artifact = metadata.approvedArtifact as CreatorSkillArtifact

    assert.equal(planned.create[0]!.title, 'EXT. ROOFTOP - NIGHT · Shot Plan')
    assert.match(planned.create[0]!.prompt, /Shot 1\nObjective: Edited turn objective\./)
    assert.deepEqual(metadata.evidence, [SHOT_EVIDENCE[1], SHOT_EVIDENCE[0]])
    assert.deepEqual(artifact.sourceArtifactIds, [SHOT_ARTIFACT_ID])
    assert.deepEqual(
      (artifact.payload as { scenes: typeof SHOT_SCENES }).scenes[0]!.shots.map(({ shotId }) => shotId),
      ['scene-001-shot-002', 'scene-001-shot-001'],
    )
    assert.equal(
      (artifact.payload as { scenes: typeof SHOT_SCENES }).scenes[0]!.shots[0]!.reviewStatus,
      'pending',
    )
  })

  test('does not create a node when no shot is approved', () => {
    const planned = shotPlan({ approvedScenes: [] })
    assert.deepEqual(planned, { create: [], duplicates: [] })
  })
})

describe('grouped materialization validation and purity', () => {
  test('binds approval to the analyzed fingerprint and Artifact identity', () => {
    assert.throws(() => narrativePlan({
      approvalContext: { runFingerprint: 'csf1_deadbeef', sourceArtifactId: NARRATIVE_ARTIFACT_ID },
    }), TypeError)
    assert.throws(() => shotPlan({
      approvalContext: { runFingerprint: RUN_FINGERPRINT, sourceArtifactId: 'shot-plan-002' },
    }), TypeError)
  })

  test('rejects malformed, duplicate, and immutably changed reviewed entries', () => {
    const duplicate = approvedNarrativeScene(0, [0, 0])
    const changedRange = approvedNarrativeScene(0, [0])
    changedRange.beats[0] = { ...changedRange.beats[0]!, lineStart: 99 }
    const changedShotId = approvedShotScene([0])
    changedShotId.shots[0] = { ...changedShotId.shots[0]!, shotId: 'forged-shot' }

    assert.throws(() => narrativePlan({ approvedScenes: [duplicate] }), TypeError)
    assert.throws(() => narrativePlan({ approvedScenes: [changedRange] }), TypeError)
    assert.throws(() => shotPlan({ approvedScenes: [changedShotId] }), TypeError)
    assert.throws(() => narrativePlan({ result: narrativeResult({ status: 'blocked' }) }), TypeError)
  })

  test('validates evidence and item ordering for the complete analyzed Artifact', () => {
    const missingUnapprovedEvidence = narrativeResult({
      evidence: NARRATIVE_EVIDENCE.slice(0, 2),
    })
    const extraEvidence = narrativeResult({
      evidence: [
        ...NARRATIVE_EVIDENCE,
        evidence('narrative-beat-evidence-999-999', 'FORGED', 9, 'Forged.'),
      ],
    })
    const duplicateOrders = narrativeResult()
    const payload = duplicateOrders.artifacts[0]!.payload as {
      scenes: typeof NARRATIVE_SCENES
    }
    payload.scenes[0]!.beats[1]!.order = 1

    assert.throws(() => narrativePlan({
      result: missingUnapprovedEvidence,
      approvedScenes: [approvedNarrativeScene(0, [0])],
    }), TypeError)
    assert.throws(() => narrativePlan({ result: extraEvidence }), TypeError)
    assert.throws(() => narrativePlan({ result: duplicateOrders }), TypeError)
  })

  test('rejects noncanonical scene, beat, and shot identities before persistence', () => {
    const malformedScene = narrativeResult()
    const malformedScenePayload = malformedScene.artifacts[0]!.payload as {
      scenes: typeof NARRATIVE_SCENES
    }
    malformedScenePayload.scenes[0]!.sceneId = 'scene-009'
    for (const beat of malformedScenePayload.scenes[0]!.beats) {
      beat.sceneId = 'scene-009'
      beat.beatId = `scene-009-beat-${String(beat.order).padStart(3, '0')}`
    }

    const malformedBeat = narrativeResult()
    const malformedBeatPayload = malformedBeat.artifacts[0]!.payload as {
      scenes: typeof NARRATIVE_SCENES
    }
    malformedBeatPayload.scenes[0]!.beats[0]!.beatId = 'scene-001-beat-999'

    const malformedShot = shotResult()
    const malformedShotPayload = malformedShot.artifacts[0]!.payload as {
      scenes: typeof SHOT_SCENES
    }
    malformedShotPayload.scenes[0]!.shots[0]!.shotId = 'scene-001-shot-999'

    assert.throws(() => narrativePlan({
      result: malformedScene,
      approvedScenes: [approvedNarrativeSceneFromResult(malformedScene, 0)],
    }), TypeError)
    assert.throws(() => narrativePlan({
      result: malformedBeat,
      approvedScenes: [approvedNarrativeSceneFromResult(malformedBeat, 0)],
    }), TypeError)
    assert.throws(() => shotPlan({
      result: malformedShot,
      approvedScenes: [approvedShotSceneFromResult(malformedShot)],
    }), TypeError)
  })

  test('rejects reversed, partial-overlap, and cross-scene narrative provenance', () => {
    const reversed = narrativeResult()
    const reversedPayload = reversed.artifacts[0]!.payload as { scenes: typeof NARRATIVE_SCENES }
    reversedPayload.scenes[0]!.beats[0]!.lineStart = 4
    reversedPayload.scenes[0]!.beats[0]!.lineEnd = 4
    reversedPayload.scenes[0]!.beats[1]!.lineStart = 3
    reversedPayload.scenes[0]!.beats[1]!.lineEnd = 3
    syncNarrativeEvidence(reversed)

    const partialOverlap = narrativeResult()
    const overlapPayload = partialOverlap.artifacts[0]!.payload as { scenes: typeof NARRATIVE_SCENES }
    overlapPayload.scenes[0]!.beats[0]!.lineStart = 2
    overlapPayload.scenes[0]!.beats[0]!.lineEnd = 3
    overlapPayload.scenes[0]!.beats[1]!.lineStart = 3
    overlapPayload.scenes[0]!.beats[1]!.lineEnd = 4
    syncNarrativeEvidence(partialOverlap)

    const crossSceneOverlap = narrativeResult()
    const crossPayload = crossSceneOverlap.artifacts[0]!.payload as { scenes: typeof NARRATIVE_SCENES }
    crossPayload.scenes[1]!.beats[0]!.lineStart = 3
    crossPayload.scenes[1]!.beats[0]!.lineEnd = 3
    syncNarrativeEvidence(crossSceneOverlap)

    assert.throws(() => narrativePlan({
      result: reversed,
      approvedScenes: [approvedNarrativeSceneFromResult(reversed, 0)],
    }), TypeError)
    assert.throws(() => narrativePlan({
      result: partialOverlap,
      approvedScenes: [approvedNarrativeSceneFromResult(partialOverlap, 0)],
    }), TypeError)
    assert.throws(() => narrativePlan({
      result: crossSceneOverlap,
      approvedScenes: [approvedNarrativeSceneFromResult(crossSceneOverlap, 1)],
    }), TypeError)
  })

  test('rejects reversed shot provenance in immutable shot order', () => {
    const result = shotResult()
    const payload = result.artifacts[0]!.payload as { scenes: typeof SHOT_SCENES }
    payload.scenes[0]!.shots[0]!.lineStart = 4
    payload.scenes[0]!.shots[0]!.lineEnd = 4
    payload.scenes[0]!.shots[1]!.lineStart = 3
    payload.scenes[0]!.shots[1]!.lineEnd = 3
    syncShotEvidence(result)

    assert.throws(() => shotPlan({
      result,
      approvedScenes: [approvedShotSceneFromResult(result, [1, 0])],
    }), TypeError)
  })

  test('validates optional shot beat identity when present', () => {
    const invalidBeatIds = [
      '',
      ' scene-001-beat-001 ',
      'scene-002-beat-001',
      'scene-001-beat-1',
      'scene-001-beat-000',
    ]
    for (const beatId of invalidBeatIds) {
      const result = shotResult()
      const payload = result.artifacts[0]!.payload as { scenes: typeof SHOT_SCENES }
      payload.scenes[0]!.shots[0]!.beatId = beatId
      assert.throws(() => shotPlan({
        result,
        approvedScenes: [approvedShotSceneFromResult(result)],
      }), TypeError)
    }

    const undefinedBeat = shotResult()
    const undefinedBeatPayload = undefinedBeat.artifacts[0]!.payload as {
      scenes: Array<{ shots: Array<{ beatId?: string }> }>
    }
    undefinedBeatPayload.scenes[0]!.shots[0]!.beatId = undefined
    assert.throws(() => shotPlan({
      result: undefinedBeat,
      approvedScenes: [approvedShotSceneFromResult(undefinedBeat)],
    }), TypeError)

    const withoutBeat = shotResult()
    const withoutBeatPayload = withoutBeat.artifacts[0]!.payload as {
      scenes: typeof SHOT_SCENES
    }
    const shotWithoutBeat = withoutBeatPayload.scenes[0]!.shots[0]! as {
      beatId?: string
    }
    delete shotWithoutBeat.beatId
    assert.equal(shotPlan({
      result: withoutBeat,
      approvedScenes: [approvedShotSceneFromResult(withoutBeat)],
    }).create.length, 1)
  })

  test('rejects scene, item, and evidence collections beyond hard limits', () => {
    const fortyOneScenes = narrativeResultWithShape(41, 1)
    const oneHundredTwentyOneBeats = narrativeResultWithShape(1, 121)
    const oneHundredTwentyOneShots = shotResultWithCount(121)

    assert.throws(() => narrativePlan({
      result: fortyOneScenes,
      approvedScenes: [],
    }), /limit/i)
    assert.throws(() => narrativePlan({
      result: oneHundredTwentyOneBeats,
      approvedScenes: [],
    }), /limit/i)
    assert.throws(() => shotPlan({
      result: oneHundredTwentyOneShots,
      approvedScenes: [],
    }), /limit/i)

    const oversizedEvidence = narrativeResult()
    oversizedEvidence.evidence.length = 1_000_000
    assert.throws(() => narrativePlan({
      result: oversizedEvidence,
      approvedScenes: [],
    }), /limit/i)

    const hostileSceneLength = narrativeResult()
    const hostilePayload = hostileSceneLength.artifacts[0]!.payload as {
      scenes: typeof NARRATIVE_SCENES
    }
    hostilePayload.scenes.length = 1_000_000
    assert.throws(() => narrativePlan({
      result: hostileSceneLength,
      approvedScenes: [],
    }), /limit/i)
  })

  test('preserves valid 40-scene and 120-item boundaries', () => {
    const narrative = narrativeResultWithShape(40, 3)
    const shots = shotResultWithCount(120)

    const narrativePlanned = narrativePlan({
      result: narrative,
      approvedScenes: approvedNarrativeScenesFromResult(narrative),
    })
    const shotPlanned = shotPlan({
      result: shots,
      approvedScenes: [approvedShotSceneFromResult(shots)],
    })

    assert.equal(narrativePlanned.create.length, 40)
    assert.equal(shotPlanned.create.length, 1)
    const approvedShots = shotPlanned.create[0]!.metadataJson.creatorSkill
      .approvedArtifact.payload as { scenes: Array<{ shots: unknown[] }> }
    assert.equal(approvedShots.scenes[0]!.shots.length, 120)
  })

  test('allows exact shared source ranges while preserving reviewed payload order', () => {
    const narrative = narrativeResult()
    const narrativePayload = narrative.artifacts[0]!.payload as { scenes: typeof NARRATIVE_SCENES }
    const narrativeBeats = narrativePayload.scenes[0]!.beats
    narrativeBeats[1]!.lineStart = narrativeBeats[0]!.lineStart
    narrativeBeats[1]!.lineEnd = narrativeBeats[0]!.lineEnd
    narrativeBeats[1]!.sourceText = narrativeBeats[0]!.sourceText
    syncNarrativeEvidence(narrative)

    const shot = shotResult()
    const shotPayload = shot.artifacts[0]!.payload as { scenes: typeof SHOT_SCENES }
    const shots = shotPayload.scenes[0]!.shots
    shots[1]!.lineStart = shots[0]!.lineStart
    shots[1]!.lineEnd = shots[0]!.lineEnd
    shots[1]!.sourceText = shots[0]!.sourceText
    syncShotEvidence(shot)

    const narrativePlanned = narrativePlan({
      result: narrative,
      approvedScenes: [approvedNarrativeSceneFromResult(narrative, 0, [1, 0])],
    })
    const shotPlanned = shotPlan({
      result: shot,
      approvedScenes: [approvedShotSceneFromResult(shot, [1, 0])],
    })

    const approvedBeats = narrativePlanned.create[0]!.metadataJson.creatorSkill
      .approvedArtifact.payload as { scenes: Array<{ beats: Array<{ beatId: string }> }> }
    const approvedShots = shotPlanned.create[0]!.metadataJson.creatorSkill
      .approvedArtifact.payload as { scenes: Array<{ shots: Array<{ shotId: string }> }> }
    assert.deepEqual(approvedBeats.scenes[0]!.beats.map(({ beatId }) => beatId), [
      'scene-001-beat-002',
      'scene-001-beat-001',
    ])
    assert.deepEqual(approvedShots.scenes[0]!.shots.map(({ shotId }) => shotId), [
      'scene-001-shot-002',
      'scene-001-shot-001',
    ])
  })

  test('omits own undefined optional values from canonical approved Artifacts', () => {
    const result = narrativeResult()
    const payload = result.artifacts[0]!.payload as { scenes: typeof NARRATIVE_SCENES }
    const sourceBeat = payload.scenes[0]!.beats[0]! as typeof payload.scenes[0]['beats'][number] & {
      needsReviewReason?: string
    }
    sourceBeat.needsReviewReason = undefined
    const approved = structuredClone(payload.scenes[0]) as unknown as ApprovedNarrativeBeatScene
    approved.beats = [approved.beats[0]!]
    approved.beats[0]!.reviewStatus = 'approved'
    delete approved.beats[0]!.needsReviewReason

    const planned = narrativePlan({ result, approvedScenes: [approved] })
    const artifact = planned.create[0]!.metadataJson.creatorSkill.approvedArtifact
    const approvedPayload = artifact.payload as { scenes: Array<{ beats: unknown[] }> }

    assert.doesNotThrow(() => cloneCreatorSkillArtifact(artifact))
    assert.equal(
      Object.prototype.hasOwnProperty.call(approvedPayload.scenes[0]!.beats[0], 'needsReviewReason'),
      false,
    )
  })

  test('rejects inherited properties, accessors, sparse arrays, and hostile indexed slots', () => {
    const inherited = approvedNarrativeScene(0, [0]) as ApprovedNarrativeBeatScene & Record<string, unknown>
    Reflect.deleteProperty(inherited, 'sceneId')
    Object.setPrototypeOf(inherited, { sceneId: 'scene-001' })

    const accessor = approvedShotScene([0])
    let reads = 0
    Object.defineProperty(accessor.shots[0]!, 'objective', {
      get() { reads += 1; return 'forged' },
    })

    const sparse = Array<ApprovedNarrativeBeatScene>(2)
    sparse[0] = approvedNarrativeScene(0, [0])
    const hostile = [approvedShotScene([0])]
    Object.defineProperty(hostile, 0, { get() { throw new Error('hostile slot') } })

    assert.throws(() => narrativePlan({ approvedScenes: [inherited] }), TypeError)
    assert.throws(() => shotPlan({ approvedScenes: [accessor] }), TypeError)
    assert.equal(reads, 0)
    assert.throws(() => narrativePlan({ approvedScenes: sparse }), TypeError)
    assert.throws(() => shotPlan({ approvedScenes: hostile }), TypeError)
  })

  test('does not mutate or alias frozen caller-owned values and is deterministic', () => {
    const result = narrativeResult()
    const approvedScenes = [approvedNarrativeScene(0, [1, 0])]
    const existingNodes: Array<{ metadataJson?: unknown }> = []
    const before = structuredClone({ result, approvedScenes, existingNodes })
    deepFreeze(result)
    deepFreeze(approvedScenes)
    deepFreeze(existingNodes)

    const first = narrativePlan({ result, approvedScenes, existingNodes })
    const second = narrativePlan({ result, approvedScenes, existingNodes })

    assert.deepEqual(first, second)
    assert.deepEqual({ result, approvedScenes, existingNodes }, before)
    assert.notStrictEqual(first.create[0]!.metadataJson.creatorSkill.evidence, result.evidence)
    assert.notStrictEqual(
      first.create[0]!.metadataJson.creatorSkill.approvedArtifact.payload,
      result.artifacts[0]!.payload,
    )
  })

  test('succeeds without time, randomness, or network access', () => {
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
      assert.equal(narrativePlan().create.length, 2)
      assert.equal(shotPlan().create.length, 1)
    } finally {
      Date.now = originalNow
      Math.random = originalRandom
      if (fetchDescriptor) Object.defineProperty(globalThis, 'fetch', fetchDescriptor)
      else delete (globalThis as { fetch?: unknown }).fetch
    }
  })
})
