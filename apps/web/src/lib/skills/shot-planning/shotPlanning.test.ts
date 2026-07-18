/**
 * Public contract tests for the deterministic shot-planning Skill.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/skills/shot-planning/shotPlanning.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import * as skillExports from '..'
import { createCreatorSkillArtifact } from '../artifacts'
import { createCreatorSkillFingerprint } from '../fingerprint'
import type {
  CreatorExecutableSkill,
  CreatorSkillArtifact,
  CreatorSkillRunInput,
  CreatorSkillRunResult,
  CreatorSkillSourceNode,
} from '../types'

type PlannedShotSize = 'wide' | 'full' | 'medium' | 'close' | 'extreme-close'
type ShotPlanDraft = {
  shotId: string
  sceneId: string
  beatId?: string
  order: number
  objective: string
  subject: string
  action: string
  suggestedShotSize: PlannedShotSize
  sourceText: string
  lineStart: number
  lineEnd: number
  outputKind: 'image' | 'video'
  duration: 5 | 10
  reviewStatus: 'pending'
  needsReviewReason?: string
}
type ShotPlanPayload = {
  scenes: Array<{
    sceneId: string
    order: number
    heading: string
    shots: ShotPlanDraft[]
  }>
}

const OLD_FILLERS = [
  '建立场景环境，交代时间与地点',
  '主体人物或物品进入画面，展示关键行动',
  '关键情节展开，叙事推进',
  '细节特写，强调关键物品或情感',
  '人物情绪反应，内心世界呈现',
  '场景过渡或环境切换',
  '悬念或留白结尾，引发想象',
]

function shotSkill() {
  const skill = (skillExports as Record<string, unknown>)
    .SHOT_PLANNING_SKILL as CreatorExecutableSkill | undefined
  assert.ok(skill, 'SHOT_PLANNING_SKILL must be publicly exported')
  return skill
}

function textNode(
  prompt: string,
  overrides: Partial<CreatorSkillSourceNode> = {},
): CreatorSkillSourceNode {
  return {
    id: 'text-1',
    kind: 'text',
    title: 'Shot source',
    prompt,
    ...overrides,
  }
}

function run(input: CreatorSkillRunInput) {
  const skill = shotSkill()
  return skill.run(
    input,
    createCreatorSkillFingerprint(skill.manifest.id, skill.manifest.version, input),
  )
}

function runRaw(input: CreatorSkillRunInput) {
  return shotSkill().run(input, 'csf1_boundary_test')
}

function runText(source: string, options: Record<string, unknown> = {}) {
  return run({ sourceNodes: [textNode(source)], options })
}

function payloadOf(result: CreatorSkillRunResult) {
  assert.equal(result.artifacts.length, 1)
  return result.artifacts[0]!.payload as ShotPlanPayload
}

function allShots(result: CreatorSkillRunResult) {
  return payloadOf(result).scenes.flatMap((scene) => scene.shots)
}

function assertBlocked(result: CreatorSkillRunResult, code: string) {
  assert.equal(result.status, 'blocked')
  assert.deepEqual(result.artifacts, [])
  assert.deepEqual(result.evidence, [])
  assert.equal(result.blockers[0]?.code, code)
}

function sceneBreakdownArtifact(): CreatorSkillArtifact {
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
    sourceArtifactIds: ['scene-breakdown-001'],
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

function narrativeArtifact(count = 3): CreatorSkillArtifact {
  const beats = Array.from({ length: count }, (_, index) => ({
    beatId: `scene-002-beat-${String(index + 1).padStart(3, '0')}`,
    sceneId: 'scene-002',
    order: index + 1,
    type: index === 1 ? 'reaction' : 'action',
    sourceText: index === 1
      ? `Leo gasps at signal ${index + 1}.`
      : `Maya opens panel ${index + 1}.`,
    summary: index === 1
      ? `Leo gasps at signal ${index + 1}.`
      : `Maya opens panel ${index + 1}.`,
    lineStart: 20 + index,
    lineEnd: 20 + index,
    reviewStatus: 'pending',
  }))
  return createCreatorSkillArtifact({
    artifactId: 'approved-narrative-beat-map-002',
    artifactType: 'narrative-beat-map',
    artifactVersion: 1,
    sourceNodeIds: ['original-script-node'],
    sourceArtifactIds: ['narrative-beat-map-001'],
    payload: {
      scenes: [{
        sceneId: 'scene-002',
        order: 2,
        heading: 'EXT. ROOFTOP - NIGHT',
        beats,
      }],
    },
  })
}

describe('shot-planning manifest and options', () => {
  test('exports the exact independently callable manifest', () => {
    assert.deepEqual(shotSkill().manifest, {
      id: 'shot-planning',
      version: '1.0.0',
      name: '分镜清单生成器',
      description: '根据明确叙事证据规划可审核镜头',
      category: 'camera',
      executionPolicy: 'deterministic-local',
      acceptedNodeKinds: ['text'],
      acceptedArtifactTypes: ['scene-breakdown', 'narrative-beat-map'],
      outputArtifactTypes: ['shot-plan'],
      independentlyCallable: true,
    })
  })

  test('normalizes and clamps only plain option values', () => {
    const normalize = (skillExports as Record<string, unknown>)
      .normalizeShotPlanningOptions as ((value?: Record<string, unknown>) => unknown) | undefined
    assert.ok(normalize)
    assert.deepEqual(normalize({
      requestedShotCount: 999,
      outputMode: 'video',
      pacing: 'fast_social',
      shotSizeStrategy: 'close_heavy',
      userInstruction: '  hold on expressions  ',
    }), {
      requestedShotCount: 120,
      outputMode: 'video',
      pacing: 'fast_social',
      shotSizeStrategy: 'close_heavy',
      userInstruction: 'hold on expressions',
    })
    assert.deepEqual(normalize({ requestedShotCount: 2.5, outputMode: 'bad' }), {
      requestedShotCount: 5,
      outputMode: 'mixed',
      pacing: 'standard',
      shotSizeStrategy: 'auto',
      userInstruction: '',
    })
    assert.deepEqual(normalize({ requestedShotCount: Symbol('invalid') }), {
      requestedShotCount: 5,
      outputMode: 'mixed',
      pacing: 'standard',
      shotSizeStrategy: 'auto',
      userInstruction: '',
    })
    assert.deepEqual(normalize({ requestedShotCount: null }), {
      requestedShotCount: 5,
      outputMode: 'mixed',
      pacing: 'standard',
      shotSizeStrategy: 'auto',
      userInstruction: '',
    })
    assert.deepEqual(normalize({ requestedShotCount: '12' }), {
      requestedShotCount: 12,
      outputMode: 'mixed',
      pacing: 'standard',
      shotSizeStrategy: 'auto',
      userInstruction: '',
    })
    let coercionCalls = 0
    const hostileCount = {
      valueOf() {
        coercionCalls += 1
        throw new Error('must not coerce arbitrary option objects')
      },
      toString() {
        coercionCalls += 1
        return '9'
      },
    }
    for (const requestedShotCount of [hostileCount, BigInt(9), true, Symbol('count')]) {
      assert.equal(
        (normalize({ requestedShotCount }) as { requestedShotCount: number })
          .requestedShotCount,
        5,
      )
    }
    assert.equal(coercionCalls, 0)
    assert.deepEqual(normalize(
      Object.assign(new Date(), { requestedShotCount: 9 }) as unknown as Record<string, unknown>,
    ), {
      requestedShotCount: 5,
      outputMode: 'mixed',
      pacing: 'standard',
      shotSizeStrategy: 'auto',
      userInstruction: '',
    })
  })
})

describe('evidence-backed shot assembly', () => {
  test('creates one primary shot per explicit beat with stable evidence and IDs', () => {
    const result = run({
      sourceNodes: [],
      artifacts: [narrativeArtifact(3)],
      options: { requestedShotCount: 3, outputMode: 'image' },
    })
    const shots = allShots(result)

    assert.equal(result.status, 'ready')
    assert.deepEqual(shots.map((shot) => shot.shotId), [
      'scene-002-shot-001',
      'scene-002-shot-002',
      'scene-002-shot-003',
    ])
    assert.deepEqual(shots.map((shot) => shot.beatId), [
      'scene-002-beat-001',
      'scene-002-beat-002',
      'scene-002-beat-003',
    ])
    assert.deepEqual(result.evidence.map((item) => ({
      evidenceId: item.evidenceId,
      ruleId: item.ruleId,
      sourceNodeId: item.sourceNodeId,
      lineStart: item.lineStart,
      lineEnd: item.lineEnd,
      excerpt: item.excerpt,
    })), [
      {
        evidenceId: 'shot-plan-evidence-002-001',
        ruleId: 'SHOT_PRIMARY_SOURCE_UNIT',
        sourceNodeId: 'original-script-node',
        lineStart: 20,
        lineEnd: 20,
        excerpt: 'Maya opens panel 1.',
      },
      {
        evidenceId: 'shot-plan-evidence-002-002',
        ruleId: 'SHOT_PRIMARY_SOURCE_UNIT',
        sourceNodeId: 'original-script-node',
        lineStart: 21,
        lineEnd: 21,
        excerpt: 'Leo gasps at signal 2.',
      },
      {
        evidenceId: 'shot-plan-evidence-002-003',
        ruleId: 'SHOT_PRIMARY_SOURCE_UNIT',
        sourceNodeId: 'original-script-node',
        lineStart: 22,
        lineEnd: 22,
        excerpt: 'Maya opens panel 3.',
      },
    ])
    assert.ok(result.evidence.every((item) => item.explanation.trim()))
    assert.deepEqual(result.artifacts[0]?.sourceArtifactIds, [
      'approved-narrative-beat-map-002',
    ])
  })

  test('adds one supplemental shot only for an explicit reaction clause', () => {
    const result = runText(
      'Maya opens the door, and Leo gasps in reaction.',
      { requestedShotCount: 2 },
    )
    const shots = allShots(result)

    assert.equal(shots.length, 2)
    assert.equal(shots[0]?.sourceText, shots[1]?.sourceText)
    assert.equal(shots[0]?.lineStart, shots[1]?.lineStart)
    assert.match(shots[1]?.objective ?? '', /gasps|reaction/iu)
    assert.deepEqual(result.evidence.map((item) => ({
      evidenceId: item.evidenceId,
      ruleId: item.ruleId,
      sourceNodeId: item.sourceNodeId,
      lineStart: item.lineStart,
      lineEnd: item.lineEnd,
      excerpt: item.excerpt,
    })), [
      {
        evidenceId: 'shot-plan-evidence-001-001',
        ruleId: 'SHOT_PRIMARY_SOURCE_UNIT',
        sourceNodeId: 'text-1',
        lineStart: 1,
        lineEnd: 1,
        excerpt: 'Maya opens the door, and Leo gasps in reaction.',
      },
      {
        evidenceId: 'shot-plan-evidence-001-002',
        ruleId: 'SHOT_EXPLICIT_SUPPLEMENTAL_CLAUSE',
        sourceNodeId: 'text-1',
        lineStart: 1,
        lineEnd: 1,
        excerpt: 'Maya opens the door, and Leo gasps in reaction.',
      },
    ])
    assert.ok(result.evidence.every((item) => item.explanation.trim()))
  })

  test('adds evidence-backed supplemental shots for explicit turn and spatial clauses', () => {
    const fixtures = [
      'Maya opens the door, but Leo closes it.',
      'Maya crosses the street.',
    ]

    for (const source of fixtures) {
      const result = runText(source, { requestedShotCount: 2 })
      assert.equal(allShots(result).length, 2)
      assert.deepEqual(result.evidence.map((item) => ({
        evidenceId: item.evidenceId,
        ruleId: item.ruleId,
        sourceNodeId: item.sourceNodeId,
        lineStart: item.lineStart,
        lineEnd: item.lineEnd,
        excerpt: item.excerpt,
      })), [
        {
          evidenceId: 'shot-plan-evidence-001-001',
          ruleId: 'SHOT_PRIMARY_SOURCE_UNIT',
          sourceNodeId: 'text-1',
          lineStart: 1,
          lineEnd: 1,
          excerpt: source,
        },
        {
          evidenceId: 'shot-plan-evidence-001-002',
          ruleId: 'SHOT_EXPLICIT_SUPPLEMENTAL_CLAUSE',
          sourceNodeId: 'text-1',
          lineStart: 1,
          lineEnd: 1,
          excerpt: source,
        },
      ])
      assert.ok(result.evidence.every((item) => item.explanation.trim()))
    }
  })

  test('does not add a supplemental shot without reaction, turn, or spatial evidence', () => {
    const result = runText('Maya opens the door.', { requestedShotCount: 8 })
    assert.equal(allShots(result).length, 1)
    assert.deepEqual(result.warnings.map((warning) => warning.code), [
      'SHOT_COUNT_TARGET_UNDERSUPPLIED',
    ])
    assert.deepEqual(result.evidence.map((item) => ({
      evidenceId: item.evidenceId,
      ruleId: item.ruleId,
      sourceNodeId: item.sourceNodeId,
      lineStart: item.lineStart,
      lineEnd: item.lineEnd,
      excerpt: item.excerpt,
    })), [{
      evidenceId: 'shot-plan-evidence-001-001',
      ruleId: 'SHOT_PRIMARY_SOURCE_UNIT',
      sourceNodeId: 'text-1',
      lineStart: 1,
      lineEnd: 1,
      excerpt: 'Maya opens the door.',
    }])
  })

  test('preserves every primary beat when requested count is lower', () => {
    const result = run({
      sourceNodes: [],
      artifacts: [narrativeArtifact(3)],
      options: { requestedShotCount: 1 },
    })
    assert.equal(allShots(result).length, 3)
    assert.deepEqual(result.warnings.map((warning) => warning.code), [
      'SHOT_COUNT_TARGET_EXCEEDED',
    ])
  })

  test('never emits legacy filler descriptions and flags unreliable extraction', () => {
    const result = runText('Blue arithmetic beyond.', { requestedShotCount: 10 })
    const shots = allShots(result)
    assert.equal(result.status, 'needs-review')
    assert.equal(shots.length, 1)
    assert.equal(shots[0]?.subject, '')
    assert.equal(shots[0]?.action, 'Blue arithmetic beyond.')
    assert.ok(shots[0]?.needsReviewReason)
    assert.ok(shots.every((shot) => !OLD_FILLERS.includes(shot.objective)))
  })

  test('uses exact cue priority and lets strategy change only shot size', () => {
    const source = 'Extreme close on Maya as she runs through the room.'
    const auto = allShots(runText(source, {
      requestedShotCount: 1,
      shotSizeStrategy: 'auto',
    }))[0]!
    const wide = allShots(runText(source, {
      requestedShotCount: 1,
      shotSizeStrategy: 'wide_heavy',
    }))[0]!
    assert.equal(auto.suggestedShotSize, 'extreme-close')
    assert.equal(wide.suggestedShotSize, 'wide')
    assert.deepEqual({
      shotId: wide.shotId,
      sceneId: wide.sceneId,
      beatId: wide.beatId,
      order: wide.order,
      objective: wide.objective,
      subject: wide.subject,
      action: wide.action,
      sourceText: wide.sourceText,
      lineStart: wide.lineStart,
      lineEnd: wide.lineEnd,
      outputKind: wide.outputKind,
      reviewStatus: wide.reviewStatus,
      needsReviewReason: wide.needsReviewReason,
    }, {
      shotId: auto.shotId,
      sceneId: auto.sceneId,
      beatId: auto.beatId,
      order: auto.order,
      objective: auto.objective,
      subject: auto.subject,
      action: auto.action,
      sourceText: auto.sourceText,
      lineStart: auto.lineStart,
      lineEnd: auto.lineEnd,
      outputKind: auto.outputKind,
      reviewStatus: auto.reviewStatus,
      needsReviewReason: auto.needsReviewReason,
    })

    const choose = (skillExports as Record<string, unknown>)
      .chooseShotSize as ((unit: { text: string }) => PlannedShotSize) | undefined
    assert.ok(choose)
    const unit = { sceneId: 'scene-001', sceneOrder: 1, heading: '', lineStart: 1, lineEnd: 1 }
    assert.equal(choose({ ...unit, text: 'reaction in a room while she walks' }), 'close')
    assert.equal(choose({ ...unit, text: 'room view while Maya walks' }), 'wide')
    assert.equal(choose({ ...unit, text: 'Maya walks onward' }), 'full')
    assert.equal(choose({ ...unit, text: 'Maya opens the panel' }), 'medium')
  })

  test('maps output mode and pacing without changing evidence content', () => {
    const image = allShots(runText('Maya walks across the street.', {
      requestedShotCount: 1,
      outputMode: 'image',
      pacing: 'slow_cinematic',
    }))[0]!
    const video = allShots(runText('Maya walks across the street.', {
      requestedShotCount: 1,
      outputMode: 'video',
      pacing: 'fast_social',
    }))[0]!
    assert.equal(image.outputKind, 'image')
    assert.equal(video.outputKind, 'video')
    assert.equal(image.duration, 10)
    assert.equal(video.duration, 5)
    assert.equal(image.sourceText, video.sourceText)
    assert.equal(image.action, video.action)
  })
})

describe('independent input contracts', () => {
  test('accepts direct Text independently', () => {
    const result = runText('Maya opens the panel. Leo smiles.')
    assert.notEqual(result.status, 'blocked')
    assert.equal(result.artifacts[0]?.artifactId, 'shot-plan-001')
    assert.deepEqual(result.artifacts[0]?.sourceNodeIds, ['text-1'])
  })

  test('accepts approved scene-breakdown with preserved scene identity and ranges', () => {
    const result = run({ sourceNodes: [], artifacts: [sceneBreakdownArtifact()] })
    const scene = payloadOf(result).scenes[0]!
    assert.equal(scene.sceneId, 'scene-002')
    assert.equal(scene.order, 2)
    assert.equal(scene.shots[0]?.lineStart, 14)
    assert.deepEqual(result.artifacts[0]?.sourceNodeIds, ['original-script-node'])
    assert.deepEqual(result.artifacts[0]?.sourceArtifactIds, [
      'approved-scene-breakdown-002',
    ])
  })

  test('accepts approved narrative-beat-map independently', () => {
    const result = run({ sourceNodes: [], artifacts: [narrativeArtifact()] })
    assert.notEqual(result.status, 'blocked')
    assert.equal(payloadOf(result).scenes[0]?.sceneId, 'scene-002')
    assert.equal(allShots(result)[0]?.lineStart, 20)
  })

  test('accepts a reviewed beat subset without rewriting immutable identity or order', () => {
    const artifact = narrativeArtifact() as CreatorSkillArtifact<{
      scenes: Array<{ beats: Array<Record<string, unknown>> }>
    }>
    const beatTwo = artifact.payload.scenes[0]!.beats[1]!
    artifact.payload.scenes[0]!.beats = [beatTwo]

    const result = run({
      sourceNodes: [],
      artifacts: [artifact],
      options: { requestedShotCount: 1 },
    })

    assert.notEqual(result.status, 'blocked')
    assert.deepEqual(allShots(result).map((shot) => ({
      beatId: shot.beatId,
      lineStart: shot.lineStart,
    })), [{
      beatId: 'scene-002-beat-002',
      lineStart: 21,
    }])
    assert.equal(beatTwo.order, 2)

    const paired = run({
      sourceNodes: [textNode([
        'Maya opens panel 1.',
        'Leo gasps at signal 2.',
        'Maya opens panel 3.',
      ].join('\n'), { id: 'materialized-scene-node' })],
      artifacts: [artifact],
      options: { requestedShotCount: 1 },
    })
    assert.notEqual(paired.status, 'blocked')
    assert.deepEqual(paired.artifacts[0]?.sourceNodeIds, ['materialized-scene-node'])
  })

  test('accepts reviewed beat reordering and plans by preserved original order', () => {
    const artifact = narrativeArtifact() as CreatorSkillArtifact<{
      scenes: Array<{ beats: Array<Record<string, unknown>> }>
    }>
    const beats = artifact.payload.scenes[0]!.beats
    artifact.payload.scenes[0]!.beats = [beats[2]!, beats[0]!]

    const result = run({
      sourceNodes: [],
      artifacts: [artifact],
      options: { requestedShotCount: 2 },
    })

    assert.notEqual(result.status, 'blocked')
    assert.deepEqual(allShots(result).map((shot) => shot.beatId), [
      'scene-002-beat-001',
      'scene-002-beat-003',
    ])
    assert.deepEqual(
      artifact.payload.scenes[0]!.beats.map((beat) => beat.order),
      [3, 1],
      'planning must not mutate or rewrite the reviewed Artifact',
    )
  })

  test('accepts a materialized matching Text plus Artifact and rejects conflict', () => {
    const artifact = sceneBreakdownArtifact()
    const source = (artifact.payload as { scenes: Array<{ sourceText: string }> })
      .scenes[0]!.sourceText
    const matching = run({
      sourceNodes: [textNode(source, { id: 'materialized-node' })],
      artifacts: [artifact],
    })
    assert.notEqual(matching.status, 'blocked')
    assert.deepEqual(matching.artifacts[0]?.sourceNodeIds, ['materialized-node'])
    assert.equal(allShots(matching)[0]?.lineStart, 14)

    const conflict = run({
      sourceNodes: [textNode(source.replace('Maya', 'Nora'))],
      artifacts: [artifact],
    })
    assertBlocked(conflict, 'SHOT_SOURCE_CONFLICT')
  })

  test('preserves meaningful token boundaries when matching narrative evidence', () => {
    const artifact = narrativeArtifact(1) as CreatorSkillArtifact<{
      scenes: Array<{ beats: Array<Record<string, unknown>> }>
    }>
    artifact.payload.scenes[0]!.beats[0] = {
      ...artifact.payload.scenes[0]!.beats[0],
      sourceText: 'Maya is now here.',
      summary: 'Maya is now here.',
    }

    const collision = run({
      sourceNodes: [textNode('Maya is nowhere.')],
      artifacts: [artifact],
      options: { requestedShotCount: 1 },
    })
    assertBlocked(collision, 'SHOT_SOURCE_CONFLICT')

    artifact.payload.scenes[0]!.beats[0] = {
      ...artifact.payload.scenes[0]!.beats[0],
      sourceText: 'now',
      summary: 'now',
    }
    const partialToken = run({
      sourceNodes: [textNode('Maya is nowhere today.')],
      artifacts: [artifact],
      options: { requestedShotCount: 1 },
    })
    assertBlocked(partialToken, 'SHOT_SOURCE_CONFLICT')

    artifact.payload.scenes[0]!.beats[0] = {
      ...artifact.payload.scenes[0]!.beats[0],
      sourceText: 'Maya is now here.',
      summary: 'Maya is now here.',
    }
    const whitespaceOnly = run({
      sourceNodes: [textNode('  Maya   is now\r\n here.  ')],
      artifacts: [artifact],
      options: { requestedShotCount: 1 },
    })
    assert.notEqual(whitespaceOnly.status, 'blocked')
  })

  test('blocks malformed, mixed, missing, and conflicting inputs', () => {
    assertBlocked(run({ sourceNodes: [] }), 'SHOT_SOURCE_COUNT_INVALID')
    assertBlocked(run({
      sourceNodes: [textNode('Maya opens the door.')],
      artifacts: [sceneBreakdownArtifact(), narrativeArtifact()],
    }), 'SHOT_SOURCE_COUNT_INVALID')
    assertBlocked(run({
      sourceNodes: [],
      artifacts: [{ ...narrativeArtifact(), artifactVersion: 2 }],
    }), 'SHOT_ARTIFACT_INVALID')
    assertBlocked(run({
      sourceNodes: [],
      artifacts: [{ ...sceneBreakdownArtifact(), artifactId: ' bad ' }],
    }), 'SHOT_ARTIFACT_INVALID')

    const reversedLines = narrativeArtifact() as CreatorSkillArtifact<{
      scenes: Array<{ beats: Array<Record<string, unknown>> }>
    }>
    reversedLines.payload.scenes[0]!.beats[1] = {
      ...reversedLines.payload.scenes[0]!.beats[1],
      lineStart: 19,
      lineEnd: 19,
    }
    assertBlocked(run({
      sourceNodes: [],
      artifacts: [reversedLines],
    }), 'SHOT_ARTIFACT_INVALID')
  })

  test('blocks duplicate or invalid immutable beat identity, order, scene, and ranges', () => {
    const mutateSecondBeat = (
      patch: Record<string, unknown>,
    ): CreatorSkillArtifact => {
      const artifact = narrativeArtifact() as CreatorSkillArtifact<{
        scenes: Array<{ beats: Array<Record<string, unknown>> }>
      }>
      artifact.payload.scenes[0]!.beats[1] = {
        ...artifact.payload.scenes[0]!.beats[1],
        ...patch,
      }
      return artifact
    }
    const cases = [
      mutateSecondBeat({ beatId: 'scene-002-beat-001' }),
      mutateSecondBeat({ order: 1 }),
      mutateSecondBeat({ beatId: 'scene-002-beat-000', order: 0 }),
      mutateSecondBeat({ beatId: 'scene-003-beat-002', sceneId: 'scene-003' }),
      mutateSecondBeat({ lineStart: 0, lineEnd: 0 }),
    ]

    for (const artifact of cases) {
      assertBlocked(run({ sourceNodes: [], artifacts: [artifact] }), 'SHOT_ARTIFACT_INVALID')
    }

    const endpointOverlap = narrativeArtifact(2) as CreatorSkillArtifact<{
      scenes: Array<{ beats: Array<Record<string, unknown>> }>
    }>
    endpointOverlap.payload.scenes[0]!.beats[0] = {
      ...endpointOverlap.payload.scenes[0]!.beats[0],
      lineStart: 20,
      lineEnd: 21,
    }
    endpointOverlap.payload.scenes[0]!.beats[1] = {
      ...endpointOverlap.payload.scenes[0]!.beats[1],
      lineStart: 21,
      lineEnd: 22,
    }
    assertBlocked(
      run({ sourceNodes: [], artifacts: [endpointOverlap] }),
      'SHOT_ARTIFACT_INVALID',
    )

    const sameSourceLine = narrativeArtifact(2) as CreatorSkillArtifact<{
      scenes: Array<{ beats: Array<Record<string, unknown>> }>
    }>
    sameSourceLine.payload.scenes[0]!.beats[0] = {
      ...sameSourceLine.payload.scenes[0]!.beats[0],
      lineStart: 20,
      lineEnd: 20,
    }
    sameSourceLine.payload.scenes[0]!.beats[1] = {
      ...sameSourceLine.payload.scenes[0]!.beats[1],
      lineStart: 20,
      lineEnd: 20,
    }
    assert.notEqual(
      run({ sourceNodes: [], artifacts: [sameSourceLine] }).status,
      'blocked',
      'multiple sentence beats may share one exact source-line range',
    )
  })

  test('returns controlled blockers for malformed direct Text source fields', () => {
    const valid = textNode('Maya opens the panel.')
    const accessorResultText = { ...valid }
    Object.defineProperty(accessorResultText, 'resultText', {
      get() {
        throw new Error('must not read source accessors')
      },
      enumerable: true,
    })
    const malformed = [
      { ...valid, id: '' },
      { ...valid, id: '   ' },
      { ...valid, id: ' text-1 ' },
      { ...valid, title: 42 },
      { ...valid, prompt: 42 },
      { ...valid, resultText: 42 },
      accessorResultText,
    ]

    for (const sourceNode of malformed) {
      const result = runRaw({
        sourceNodes: [sourceNode as unknown as CreatorSkillSourceNode],
      })
      assertBlocked(result, 'SHOT_SOURCE_INVALID')
    }
  })

  test('contains a Proxy Text node whose data descriptors hide a throwing get trap', () => {
    const target = textNode('Maya opens the panel.')
    const hostile = new Proxy(target, {
      getOwnPropertyDescriptor(current, key) {
        return Reflect.getOwnPropertyDescriptor(current, key)
      },
      getPrototypeOf(current) {
        return Reflect.getPrototypeOf(current)
      },
      get() {
        throw new Error('must contain hostile source get trap')
      },
    })

    const result = runRaw({ sourceNodes: [hostile] })
    assertBlocked(result, 'SHOT_SOURCE_INVALID')
    assert.equal(result.runFingerprint, 'csf1_boundary_test')
  })

  test('contains hostile outer input and collection access at the executable boundary', () => {
    const validInput: CreatorSkillRunInput = {
      sourceNodes: [textNode('Maya opens the panel.')],
    }
    const outerProxy = new Proxy(validInput, {
      getOwnPropertyDescriptor(current, key) {
        return Reflect.getOwnPropertyDescriptor(current, key)
      },
      getPrototypeOf(current) {
        return Reflect.getPrototypeOf(current)
      },
      get() {
        throw new Error('must contain hostile outer input get trap')
      },
    })

    const sourceGetter = {} as CreatorSkillRunInput
    Object.defineProperty(sourceGetter, 'sourceNodes', {
      get() {
        throw new Error('must contain sourceNodes getter')
      },
      enumerable: true,
    })
    const artifactGetter = { sourceNodes: [] } as unknown as CreatorSkillRunInput
    Object.defineProperty(artifactGetter, 'artifacts', {
      get() {
        throw new Error('must contain artifacts getter')
      },
      enumerable: true,
    })
    const optionTarget = { requestedShotCount: 1 }
    const hostileOptions = new Proxy(optionTarget, {
      getOwnPropertyDescriptor(current, key) {
        return Reflect.getOwnPropertyDescriptor(current, key)
      },
      getPrototypeOf(current) {
        return Reflect.getPrototypeOf(current)
      },
      get() {
        throw new Error('must contain hostile options get trap')
      },
    })

    assertBlocked(runRaw(outerProxy), 'SHOT_SOURCE_INVALID')
    assertBlocked(runRaw(sourceGetter), 'SHOT_SOURCE_INVALID')
    assertBlocked(runRaw(artifactGetter), 'SHOT_ARTIFACT_INVALID')
    assertBlocked(runRaw({
      sourceNodes: [textNode('Maya opens the panel.')],
      options: hostileOptions,
    }), 'SHOT_SOURCE_INVALID')
  })

  test('contains sparse and throwing sourceNodes and artifacts slots', () => {
    const sparseSources = new Array<CreatorSkillSourceNode>(1)
    const sparseArtifacts = new Array<CreatorSkillArtifact>(1)
    const throwingSources = new Array<CreatorSkillSourceNode>(1)
    const throwingArtifacts = new Array<CreatorSkillArtifact>(1)
    Object.defineProperty(throwingSources, '0', {
      get() {
        throw new Error('must contain source slot')
      },
      enumerable: true,
    })
    Object.defineProperty(throwingArtifacts, '0', {
      get() {
        throw new Error('must contain artifact slot')
      },
      enumerable: true,
    })

    assertBlocked(runRaw({ sourceNodes: sparseSources }), 'SHOT_SOURCE_INVALID')
    assertBlocked(runRaw({ sourceNodes: [], artifacts: sparseArtifacts }), 'SHOT_ARTIFACT_INVALID')
    assertBlocked(runRaw({ sourceNodes: throwingSources }), 'SHOT_SOURCE_INVALID')
    assertBlocked(
      runRaw({ sourceNodes: [], artifacts: throwingArtifacts }),
      'SHOT_ARTIFACT_INVALID',
    )
  })
})

describe('limits and determinism', () => {
  test('allows 120 primary shots and blocks 121 without partial output', () => {
    const atLimit = run({
      sourceNodes: [],
      artifacts: [narrativeArtifact(120)],
      options: { requestedShotCount: 120 },
    })
    assert.equal(allShots(atLimit).length, 120)

    const overLimit = run({
      sourceNodes: [],
      artifacts: [narrativeArtifact(121)],
      options: { requestedShotCount: 120 },
    })
    assertBlocked(overLimit, 'SHOT_LIMIT_EXCEEDED')
  })

  test('returns deeply equal output for repeated normalized input', () => {
    const input: CreatorSkillRunInput = {
      sourceNodes: [textNode('Maya opens the door. Leo smiles.')],
      options: {
        requestedShotCount: '2',
        outputMode: 'mixed',
        pacing: 'standard',
        shotSizeStrategy: 'wide_to_close',
        userInstruction: '  Preserve the action.  ',
      },
    }
    assert.deepEqual(run(input), run(structuredClone(input)))
  })
})
