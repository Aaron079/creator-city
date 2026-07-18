/**
 * Public contract tests for the deterministic narrative-beat-analysis Skill.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/skills/narrative-beat-analysis/narrativeBeatAnalysis.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import * as skillExports from '..'
import { createCreatorSkillArtifact } from '../artifacts'
import {
  createCreatorExecutableSkillRegistry,
  getExecutableCreatorSkillFromRegistry,
} from '../executable-registry'
import { createCreatorSkillFingerprint } from '../fingerprint'
import { runCreatorSkillFromRegistry } from '../runtime'
import type {
  CreatorExecutableSkill,
  CreatorSkillArtifact,
  CreatorSkillRunInput,
  CreatorSkillRunResult,
  CreatorSkillSourceNode,
} from '../types'

type NarrativeBeatType =
  | 'setup'
  | 'goal'
  | 'action'
  | 'reaction'
  | 'turn'
  | 'closure'
  | 'unclassified'

type NarrativeBeatDraft = {
  beatId: string
  sceneId: string
  order: number
  type: NarrativeBeatType
  sourceText: string
  summary: string
  lineStart: number
  lineEnd: number
  reviewStatus: 'pending'
  needsReviewReason?: string
}

type NarrativeBeatMapPayload = {
  scenes: Array<{
    sceneId: string
    order: number
    heading: string
    beats: NarrativeBeatDraft[]
  }>
}

type ScriptSceneDraft = {
  sceneId: string
  order: number
  heading: string
  location?: string
  timeOfDay?: string
  characters: string[]
  actionSummary: string
  sourceText: string
  lineStart: number
  lineEnd: number
  reviewStatus: 'pending'
}

type SceneBreakdownPayload = {
  format: 'headed-script' | 'paragraph-fallback'
  scenes: ScriptSceneDraft[]
}

function narrativeSkill() {
  const skill = (skillExports as Record<string, unknown>)
    .NARRATIVE_BEAT_ANALYSIS_SKILL as CreatorExecutableSkill | undefined
  assert.ok(skill, 'NARRATIVE_BEAT_ANALYSIS_SKILL must be publicly exported')
  return skill
}

function registry() {
  return createCreatorExecutableSkillRegistry([narrativeSkill()])
}

function textNode(
  prompt: string,
  overrides: Partial<CreatorSkillSourceNode> = {},
): CreatorSkillSourceNode {
  return {
    id: 'text-1',
    kind: 'text',
    title: 'Narrative source',
    prompt,
    ...overrides,
  }
}

function run(input: CreatorSkillRunInput) {
  return runCreatorSkillFromRegistry(registry(), 'narrative-beat-analysis', input)
}

function runText(
  prompt: string,
  overrides: Partial<CreatorSkillSourceNode> = {},
) {
  return run({ sourceNodes: [textNode(prompt, overrides)] })
}

// Artifact-only runs must use the executable boundary because the current runtime
// requires evidence sourceNodeIds to appear in input.sourceNodes.
function runExecutableBoundary(input: CreatorSkillRunInput) {
  const isolatedRegistry = registry()
  const skill = getExecutableCreatorSkillFromRegistry(
    isolatedRegistry,
    'narrative-beat-analysis',
  )
  assert.ok(skill)
  const fingerprint = createCreatorSkillFingerprint(
    skill.manifest.id,
    skill.manifest.version,
    input,
  )
  return skill.run(input, fingerprint)
}

function payloadOf(result: CreatorSkillRunResult) {
  assert.equal(result.artifacts.length, 1)
  return result.artifacts[0]!.payload as NarrativeBeatMapPayload
}

function assertBlockedWithoutOutput(
  result: CreatorSkillRunResult,
  expectedCode?: string,
) {
  assert.equal(result.status, 'blocked')
  assert.deepEqual(result.artifacts, [])
  assert.deepEqual(result.evidence, [])
  assert.equal(result.blockers.length, 1)
  assert.ok(result.blockers[0]!.message.trim())
  if (expectedCode) assert.equal(result.blockers[0]!.code, expectedCode)
}

function sceneBreakdownArtifact(
  source: string,
  options: {
    sourceNodeId?: string
    artifactId?: string
    artifactVersion?: number
    sourceArtifactIds?: string[]
    scenes?: ScriptSceneDraft[]
  } = {},
): CreatorSkillArtifact<SceneBreakdownPayload> {
  const lines = source.replaceAll('\r\n', '\n').split('\n')
  const sourceNodeId = options.sourceNodeId ?? 'text-1'
  const defaultScene: ScriptSceneDraft = {
    sceneId: 'scene-001',
    order: 1,
    heading: lines[0] ?? '',
    characters: [],
    actionSummary: lines[1] ?? '',
    sourceText: lines.join('\n'),
    lineStart: 1,
    lineEnd: lines.length,
    reviewStatus: 'pending',
  }

  return createCreatorSkillArtifact({
    artifactId: options.artifactId ?? 'scene-breakdown-001',
    artifactType: 'scene-breakdown',
    artifactVersion: options.artifactVersion ?? 1,
    sourceNodeIds: [sourceNodeId],
    sourceArtifactIds: options.sourceArtifactIds ?? [],
    payload: {
      format: 'headed-script',
      scenes: options.scenes ?? [defaultScene],
    },
  })
}

function approvedSceneTwoArtifact() {
  const source = [
    'EXT. ROOFTOP - NIGHT',
    'Maya wants to repair the antenna.',
    'However, the power suddenly fades.',
  ].join('\n')
  return sceneBreakdownArtifact(source, {
    sourceNodeId: 'original-script-node',
    artifactId: 'approved-scene-breakdown-002',
    sourceArtifactIds: ['scene-breakdown-001'],
    scenes: [{
      sceneId: 'scene-002',
      order: 2,
      heading: 'EXT. ROOFTOP - NIGHT',
      location: 'ROOFTOP',
      timeOfDay: 'NIGHT',
      characters: ['MAYA'],
      actionSummary: 'Maya wants to repair the antenna.',
      sourceText: source,
      lineStart: 14,
      lineEnd: 16,
      reviewStatus: 'pending',
    }],
  })
}

function allBeats(result: CreatorSkillRunResult) {
  return payloadOf(result).scenes.flatMap((scene) => scene.beats)
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const item of Object.values(value as Record<string, unknown>)) {
      deepFreeze(item)
    }
  }
  return value
}

describe('narrative-beat-analysis manifest', () => {
  test('exports the exact independently callable manifest', () => {
    const skill = narrativeSkill()
    const isolatedRegistry = createCreatorExecutableSkillRegistry([skill])

    assert.deepEqual(
      isolatedRegistry.get('narrative-beat-analysis@1.0.0')?.manifest,
      {
        id: 'narrative-beat-analysis',
        version: '1.0.0',
        name: '叙事节拍分析',
        description: '识别可审核的建立、目标、行动、反应、转折与收束',
        category: 'story',
        executionPolicy: 'deterministic-local',
        acceptedNodeKinds: ['text'],
        acceptedArtifactTypes: ['scene-breakdown'],
        outputArtifactTypes: ['narrative-beat-map'],
        independentlyCallable: true,
      },
    )
  })
})

describe('narrative beat parsing', () => {
  test('projects the required Chinese fixture to setup, goal, and turn', () => {
    const sourceLines = [
      '外景 天台 夜',
      '林夏想要在暴雨前修好天线。',
      '然而电源突然熄灭。',
    ]
    const result = runText(sourceLines.join('\n'))
    const payload = payloadOf(result)

    assert.equal(result.status, 'ready')
    assert.equal(payload.scenes.length, 1)
    assert.equal(payload.scenes[0]!.sceneId, 'scene-001')
    assert.equal(payload.scenes[0]!.heading, sourceLines[0])
    assert.deepEqual(payload.scenes[0]!.beats.map((beat) => ({
      beatId: beat.beatId,
      order: beat.order,
      type: beat.type,
      sourceText: beat.sourceText,
      summary: beat.summary,
      lineStart: beat.lineStart,
      lineEnd: beat.lineEnd,
      reviewStatus: beat.reviewStatus,
    })), [
      {
        beatId: 'scene-001-beat-001',
        order: 1,
        type: 'setup',
        sourceText: sourceLines[0],
        summary: sourceLines[0],
        lineStart: 1,
        lineEnd: 1,
        reviewStatus: 'pending',
      },
      {
        beatId: 'scene-001-beat-002',
        order: 2,
        type: 'goal',
        sourceText: sourceLines[1],
        summary: sourceLines[1],
        lineStart: 2,
        lineEnd: 2,
        reviewStatus: 'pending',
      },
      {
        beatId: 'scene-001-beat-003',
        order: 3,
        type: 'turn',
        sourceText: sourceLines[2],
        summary: sourceLines[2],
        lineStart: 3,
        lineEnd: 3,
        reviewStatus: 'pending',
      },
    ])
  })

  test('classifies English and mixed units in stable priority order', () => {
    const result = runText([
      'INT. LAB - NIGHT',
      'Maya wants to leave. She opens the door.',
      'But Leo suddenly gasps!',
      '最终 Maya leaves.',
    ].join('\n'))
    const beats = allBeats(result)

    assert.equal(result.status, 'ready')
    assert.deepEqual(beats.map((beat) => beat.type), [
      'setup',
      'goal',
      'action',
      'turn',
      'closure',
    ])
    assert.deepEqual(beats.map((beat) => beat.sourceText), [
      'INT. LAB - NIGHT',
      'Maya wants to leave.',
      'She opens the door.',
      'But Leo suddenly gasps!',
      '最终 Maya leaves.',
    ])
    assert.deepEqual(beats.map((beat) => beat.lineStart), [1, 2, 2, 3, 4])
  })

  test('classifies reaction, closure, action, and unclassified without inventing text', () => {
    const source = [
      'EXT. ROAD - DAY',
      '林夏沉默。',
      'Maya runs toward the gate.',
      '终于灯光消失。',
      'Blue arithmetic beyond.',
    ].join('\n')
    const result = runText(source)
    const beats = allBeats(result)

    assert.equal(result.status, 'needs-review')
    assert.deepEqual(beats.map((beat) => beat.type), [
      'setup',
      'reaction',
      'action',
      'closure',
      'unclassified',
    ])
    assert.ok(beats.every((beat) => beat.summary === beat.sourceText))
    assert.ok(beats.every((beat) => source.includes(beat.sourceText)))
    assert.equal(beats[4]!.needsReviewReason, 'No deterministic V1 narrative beat rule matched.')
    assert.deepEqual(result.warnings.map((warning) => warning.code), [
      'NARRATIVE_BEAT_UNCLASSIFIED',
    ])
  })

  test('uses setup only for an explicit first contextual unit', () => {
    const result = runText('Blue arithmetic beyond.\nThe station is empty.')
    const beats = allBeats(result)

    assert.deepEqual(beats.map((beat) => beat.type), ['unclassified', 'unclassified'])
  })

  test('splits only at explicit line and sentence boundaries', () => {
    const result = runText([
      'INT. ROOM - NIGHT',
      'Maya opens the box; a red key gleams',
      '',
      'She takes it? Yes',
    ].join('\n'))
    const beats = allBeats(result)

    assert.deepEqual(beats.map((beat) => beat.sourceText), [
      'INT. ROOM - NIGHT',
      'Maya opens the box; a red key gleams',
      'She takes it?',
      'Yes',
    ])
    assert.deepEqual(beats.map((beat) => beat.lineStart), [1, 2, 4, 4])
  })
})

describe('narrative beat inputs', () => {
  const source = [
    'EXT. ROOFTOP - NIGHT',
    'Maya wants to repair the antenna.',
    'However, the power suddenly fades.',
  ].join('\n')

  test('accepts a canonical scene-breakdown Artifact without a Text node', () => {
    const artifact = sceneBreakdownArtifact(source, { sourceNodeId: 'approved-text-7' })
    const result = runExecutableBoundary({ sourceNodes: [], artifacts: [artifact] })

    assert.equal(result.status, 'ready')
    assert.deepEqual(result.artifacts[0]?.sourceNodeIds, ['approved-text-7'])
    assert.deepEqual(result.artifacts[0]?.sourceArtifactIds, ['scene-breakdown-001'])
    assert.ok(result.evidence.every((evidence) => evidence.sourceNodeId === 'approved-text-7'))
  })

  test('accepts the exact approved single-scene Artifact provenance and identity', () => {
    const artifact = approvedSceneTwoArtifact()
    const result = runExecutableBoundary({ sourceNodes: [], artifacts: [artifact] })

    assert.equal(result.status, 'ready')
    assert.deepEqual(artifact.sourceArtifactIds, ['scene-breakdown-001'])
    assert.deepEqual(payloadOf(result).scenes.map((scene) => ({
      sceneId: scene.sceneId,
      order: scene.order,
      beatIds: scene.beats.map((beat) => beat.beatId),
    })), [{
      sceneId: 'scene-002',
      order: 2,
      beatIds: [
        'scene-002-beat-001',
        'scene-002-beat-002',
        'scene-002-beat-003',
      ],
    }])
    assert.deepEqual(result.artifacts[0]?.sourceArtifactIds, [
      'approved-scene-breakdown-002',
    ])
  })

  test('accepts one Text node with its matching scene-breakdown Artifact', () => {
    const artifact = sceneBreakdownArtifact(source)
    const result = run({
      sourceNodes: [textNode(source)],
      artifacts: [artifact],
    })

    assert.equal(result.status, 'ready')
    assert.deepEqual(result.artifacts[0]?.sourceArtifactIds, ['scene-breakdown-001'])
    assert.deepEqual(allBeats(result).map((beat) => beat.type), ['setup', 'goal', 'turn'])
  })

  test('accepts a materialized scene Text with different identity and absolute Artifact lines', () => {
    const artifact = approvedSceneTwoArtifact()
    const sceneText = artifact.payload.scenes[0]!.sourceText
    const result = run({
      sourceNodes: [textNode(sceneText, { id: 'materialized-scene-node' })],
      artifacts: [artifact],
    })

    assert.equal(result.status, 'ready')
    assert.deepEqual(result.artifacts[0]?.sourceNodeIds, ['materialized-scene-node'])
    assert.deepEqual(allBeats(result).map((beat) => beat.lineStart), [14, 15, 16])
    assert.ok(result.evidence.every((item) => (
      item.sourceNodeId === 'materialized-scene-node'
    )))
  })

  test('rejects materialized scene content conflicts and invalid absolute ranges', () => {
    const artifact = approvedSceneTwoArtifact()
    const sceneText = artifact.payload.scenes[0]!.sourceText
    const conflicting = run({
      sourceNodes: [textNode(sceneText.replace('Maya', 'Nora'), {
        id: 'materialized-scene-node',
      })],
      artifacts: [artifact],
    })
    assertBlockedWithoutOutput(conflicting, 'NARRATIVE_SOURCE_CONFLICT')

    const invalidRange = {
      ...artifact,
      payload: {
        ...artifact.payload,
        scenes: [{ ...artifact.payload.scenes[0]!, lineEnd: 17 }],
      },
    }
    assertBlockedWithoutOutput(
      runExecutableBoundary({ sourceNodes: [], artifacts: [invalidRange] }),
      'NARRATIVE_SCENE_ARTIFACT_INVALID',
    )
  })

  test('rejects multiple nodes, multiple artifacts, and missing inputs', () => {
    const cases: CreatorSkillRunInput[] = [
      { sourceNodes: [] },
      { sourceNodes: [textNode(source), textNode(source, { id: 'text-2' })] },
      {
        sourceNodes: [textNode(source)],
        artifacts: [
          sceneBreakdownArtifact(source),
          sceneBreakdownArtifact(source, { artifactId: 'scene-breakdown-002' }),
        ],
      },
    ]

    for (const input of cases) assertBlockedWithoutOutput(run(input))
  })

  test('rejects wrong Artifact type and version', () => {
    const wrongType = {
      ...sceneBreakdownArtifact(source),
      artifactType: 'other-breakdown',
    }
    assertBlockedWithoutOutput(run({ sourceNodes: [], artifacts: [wrongType] }))

    const wrongVersion = sceneBreakdownArtifact(source, { artifactVersion: 2 })
    assertBlockedWithoutOutput(
      runExecutableBoundary({ sourceNodes: [], artifacts: [wrongVersion] }),
      'NARRATIVE_SCENE_ARTIFACT_INVALID',
    )
  })

  test('rejects malformed scene payloads at the Skill boundary', () => {
    const malformedPayloads: unknown[] = [
      null,
      { format: 'headed-script', scenes: null },
      { format: 'unknown', scenes: [] },
      {
        format: 'headed-script',
        scenes: [{
          sceneId: 'scene-001',
          order: 1,
          heading: 'EXT. ROOF - NIGHT',
          characters: [],
          actionSummary: '',
          sourceText: 'EXT. ROOF - NIGHT',
          lineStart: 1,
          lineEnd: 1,
        }],
      },
    ]

    for (const payload of malformedPayloads) {
      const artifact = { ...sceneBreakdownArtifact(source), payload }
      assertBlockedWithoutOutput(
        runExecutableBoundary({ sourceNodes: [], artifacts: [artifact] }),
        'NARRATIVE_SCENE_ARTIFACT_INVALID',
      )
    }
  })

  test('rejects conflicting source content and ranges', () => {
    const mismatchedContent = sceneBreakdownArtifact(source, {
      scenes: [{
        ...(sceneBreakdownArtifact(source).payload.scenes[0]!),
        sourceText: source.replace('Maya', 'Nora'),
      }],
    })
    const incompleteCoverage = sceneBreakdownArtifact(source, {
      scenes: [{
        ...(sceneBreakdownArtifact(source).payload.scenes[0]!),
        sourceText: source.split('\n').slice(0, 2).join('\n'),
        lineEnd: 2,
      }],
    })

    for (const artifact of [
      mismatchedContent,
      incompleteCoverage,
    ]) {
      assertBlockedWithoutOutput(run({
        sourceNodes: [textNode(source)],
        artifacts: [artifact],
      }))
    }
  })

  test('normalizes CRLF and prefers nonblank resultText over prompt', () => {
    const resultText = [
      'EXT. RIVER - NIGHT',
      'Maya wants the signal.',
      'But the lamp fades.',
    ].join('\r\n')
    const result = runText('INT. UNUSED - DAY\nThis prompt must not appear.', { resultText })

    assert.deepEqual(allBeats(result).map((beat) => beat.sourceText), [
      'EXT. RIVER - NIGHT',
      'Maya wants the signal.',
      'But the lamp fades.',
    ])
    assert.deepEqual(allBeats(result).map((beat) => beat.lineStart), [1, 2, 3])
  })

  test('falls back to prompt when resultText is blank', () => {
    const result = runText('EXT. FIELD - DAY\nMaya runs home.', {
      resultText: ' \r\n\t ',
    })

    assert.equal(payloadOf(result).scenes[0]?.heading, 'EXT. FIELD - DAY')
  })

  test('blocks empty and too-short effective text without output', () => {
    for (const sourceText of ['', ' \n\t ']) {
      assertBlockedWithoutOutput(runText(sourceText), 'NARRATIVE_SOURCE_EMPTY')
    }
    assertBlockedWithoutOutput(runText('1 2 3 4 5 6 7'), 'NARRATIVE_SOURCE_TOO_SHORT')

    const shortArtifact = sceneBreakdownArtifact('外景')
    assertBlockedWithoutOutput(
      runExecutableBoundary({ sourceNodes: [], artifacts: [shortArtifact] }),
      'NARRATIVE_SOURCE_TOO_SHORT',
    )
  })
})

describe('narrative beat output contract', () => {
  test('emits one stable evidence item per beat with exact source provenance', () => {
    const source = [
      'EXT. ROOF - NIGHT',
      'Maya wants to leave.',
      'But the gate closes.',
    ].join('\n')
    const result = runText(source, { id: 'source-node-7' })
    const beats = allBeats(result)

    assert.deepEqual(result.artifacts[0], {
      artifactId: 'narrative-beat-map-001',
      artifactType: 'narrative-beat-map',
      artifactVersion: 1,
      sourceNodeIds: ['source-node-7'],
      sourceArtifactIds: [],
      payload: result.artifacts[0]!.payload,
    })
    assert.equal(result.evidence.length, beats.length)
    assert.deepEqual(result.evidence.map((evidence) => evidence.evidenceId), [
      'narrative-beat-evidence-001-001',
      'narrative-beat-evidence-001-002',
      'narrative-beat-evidence-001-003',
    ])
    for (const [index, evidence] of result.evidence.entries()) {
      const beat = beats[index]!
      assert.equal(evidence.sourceNodeId, 'source-node-7')
      assert.equal(evidence.lineStart, beat.lineStart)
      assert.equal(evidence.lineEnd, beat.lineEnd)
      assert.equal(evidence.excerpt, beat.sourceText)
      assert.ok(evidence.ruleId.trim())
      assert.ok(evidence.explanation.trim())
    }
  })

  test('is ready only when every beat is classified', () => {
    const ready = runText('EXT. HALL - DAY\nMaya opens the door.')
    const review = runText('EXT. HALL - DAY\nQuartz remembers nothing.')

    assert.equal(ready.status, 'ready')
    assert.deepEqual(ready.warnings, [])
    assert.equal(review.status, 'needs-review')
    assert.equal(review.warnings.length, 1)
    assert.equal(review.warnings[0]?.code, 'NARRATIVE_BEAT_UNCLASSIFIED')
  })

  test('passes the 40-scene and 120-beat boundary', () => {
    const source = Array.from({ length: 40 }, (_, index) => [
      `INT. ROOM ${index + 1} - DAY`,
      'Maya opens the door. Maya closes the door.',
    ].join('\n')).join('\n')
    const result = runText(source)

    assert.equal(result.status, 'ready')
    assert.equal(payloadOf(result).scenes.length, 40)
    assert.equal(allBeats(result).length, 120)
    assert.equal(result.evidence.length, 120)
  })

  test('blocks more than 40 scenes without truncation output', () => {
    const source = Array.from({ length: 41 }, (_, index) => (
      `INT. ROOM ${index + 1} - DAY\nMaya opens the door.`
    )).join('\n')
    assertBlockedWithoutOutput(runText(source), 'NARRATIVE_BEAT_LIMIT_EXCEEDED')
  })

  test('blocks more than 120 beats without truncation output', () => {
    const sentences = Array.from({ length: 120 }, () => 'Maya opens the door.').join(' ')
    const source = `INT. HALL - DAY\n${sentences}`
    assertBlockedWithoutOutput(runText(source), 'NARRATIVE_BEAT_LIMIT_EXCEEDED')
  })

  test('is deeply deterministic without clock, randomness, or network access', () => {
    const input: CreatorSkillRunInput = {
      sourceNodes: [textNode('EXT. ROOF - NIGHT\nMaya wants to run.\nBut the gate closes.')],
    }
    const originalDateNow = Date.now
    const originalRandom = Math.random
    const originalFetch = globalThis.fetch
    Date.now = () => { throw new Error('Clock access is forbidden') }
    Math.random = () => { throw new Error('Randomness is forbidden') }
    globalThis.fetch = async () => { throw new Error('Network access is forbidden') }

    try {
      assert.deepEqual(run(input), run(input))
    } finally {
      Date.now = originalDateNow
      Math.random = originalRandom
      globalThis.fetch = originalFetch
    }
  })

  test('accepts frozen inputs without mutating them', () => {
    const input = deepFreeze<CreatorSkillRunInput>({
      sourceNodes: [textNode('EXT. ROOF - NIGHT\nMaya opens the hatch.')],
    })
    const snapshot = JSON.stringify(input)
    const result = run(input)

    assert.equal(result.status, 'ready')
    assert.equal(JSON.stringify(input), snapshot)
  })
})

describe('hostile and sparse input validation', () => {
  test('runtime blocks a sparse sourceNodes array', () => {
    const sparse = new Array<CreatorSkillSourceNode>(1)
    const result = run({ sourceNodes: sparse })

    assertBlockedWithoutOutput(result, 'INVALID_SKILL_INPUT')
  })

  test('runtime blocks a sparse Artifact payload array', () => {
    const artifact = sceneBreakdownArtifact('EXT. ROOF - NIGHT\nMaya opens the hatch.')
    const sparseScenes = new Array<ScriptSceneDraft>(1)
    const sparseArtifact = {
      ...artifact,
      payload: { format: 'headed-script', scenes: sparseScenes },
    }
    const result = run({ sourceNodes: [], artifacts: [sparseArtifact] })

    assertBlockedWithoutOutput(result, 'INVALID_SKILL_ARTIFACT')
  })

  test('runtime blocks hostile Artifact payload property access', () => {
    const artifact = sceneBreakdownArtifact('EXT. ROOF - NIGHT\nMaya opens the hatch.')
    const hostilePayload = new Proxy(artifact.payload, {
      ownKeys() {
        throw new Error('hostile payload')
      },
    })
    const hostileArtifact = { ...artifact, payload: hostilePayload }
    const result = run({ sourceNodes: [], artifacts: [hostileArtifact] })

    assertBlockedWithoutOutput(result, 'INVALID_SKILL_ARTIFACT')
  })
})
