/**
 * Unit tests for deterministic Storyboard Director Recipe intelligence.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/storyboard/recipe/intelligence.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type {
  CreatorSkillEvidence,
  NarrativeBeatDraft,
  ScriptSceneDraft,
  ShotPlanDraft,
} from '../../skills'
import {
  createRecipeMaterializationIdentity,
} from './identity'
import type { RecipeReviewItem, StoryboardDirectorRecipe } from './types'
import {
  analyzeStoryboardDirectorRecipe,
  isStoryboardRecipeMaterializationReady,
  summarizeStoryboardDirectorRecipe,
} from './intelligence'
import {
  approveBeatStage,
  approveSceneStage,
  approveShotStage,
  createStoryboardDirectorRecipe,
  moveRecipeDraft,
  setRecipeDecision,
  updateRecipeDraft,
} from './state-machine'

const context = { projectId: 'project-1', workflowId: 'workflow-1' }
const source = {
  id: 'source-1',
  kind: 'text' as const,
  title: 'Pilot',
  prompt: [
    'INT. LAB - NIGHT',
    'Jose opens the case and watches Mara recoil.',
    'EXT. ROOF - DAWN',
    'Mara runs to the antenna and stops the alarm.',
    'The city falls quiet.',
    'Mara looks back at the lab.',
  ].join('\n'),
}

function shot(
  shotId: string,
  sceneId: string,
  beatId: string | undefined,
  order: number,
  overrides: Partial<RecipeReviewItem<ShotPlanDraft>> = {},
): RecipeReviewItem<ShotPlanDraft> {
  const line = sceneId === 'scene-001' ? 2 : 4
  return {
    shotId,
    sceneId,
    ...(beatId ? { beatId } : {}),
    order,
    objective: `Objective ${shotId}`,
    subject: sceneId === 'scene-001' ? 'Jose' : 'Mara',
    action: `Action ${shotId}`,
    suggestedShotSize: 'medium',
    sourceText: source.prompt.split('\n')[line - 1]!,
    lineStart: line,
    lineEnd: line,
    outputKind: 'video',
    duration: 5,
    reviewStatus: 'pending',
    decision: 'approved',
    ...overrides,
  }
}

function evidence(
  evidenceId: string,
  lineStart: number,
  ruleId = 'shot-source',
  excerpt = 'Explicit source evidence.',
): CreatorSkillEvidence {
  return {
    evidenceId,
    ruleId,
    sourceNodeId: source.id,
    lineStart,
    lineEnd: lineStart,
    excerpt,
    explanation: excerpt,
  }
}

function approvedRecipe(overrides: Partial<StoryboardDirectorRecipe> = {}): StoryboardDirectorRecipe {
  return { ...canonicalRecipe(), ...overrides }
}

function recipeWithCoverageGaps() {
  let recipe = createStoryboardDirectorRecipe(context, canonicalSource, ISO_TIME)
  recipe = approveSceneStage(decideEveryDraft(recipe, 'scene-review'), ISO_TIME)
  for (const item of recipe.beat.drafts) {
    recipe = setRecipeDecision(
      recipe,
      'beat-review',
      item.beatId,
      item.sceneId === 'scene-001' ? 'approved' : 'rejected',
      ISO_TIME,
    )
  }
  recipe = approveBeatStage(recipe, ISO_TIME)
  for (const item of recipe.shot.drafts) {
    if (!item.subject.trim()) {
      recipe = updateRecipeDraft(recipe, 'shot-review', item.shotId, { subject: 'Jose' }, ISO_TIME)
    }
    recipe = setRecipeDecision(
      recipe,
      'shot-review',
      item.shotId,
      item.beatId === 'scene-001-beat-002' ? 'rejected' : 'approved',
      ISO_TIME,
    )
  }
  return approveShotStage(recipe, ISO_TIME)
}

function corruptLineageRecipe() {
  const recipe = approvedRecipe()
  const corruptShot = shot('shot-corrupt', 'scene-missing', 'beat-missing', 1, {
    objective: '',
    subject: '',
    action: '',
    sourceText: '',
    lineStart: 6,
    lineEnd: 6,
  })
  return {
    ...recipe,
    sourceNode: { ...recipe.sourceNode, prompt: 'Changed source text.' },
    beat: {
      ...recipe.beat,
      result: {
        ...recipe.beat.result!,
        artifacts: [{
          ...recipe.beat.result!.artifacts[0]!,
          sourceArtifactIds: ['wrong-scene-artifact'],
        }],
      },
    },
    shot: {
      ...recipe.shot,
      drafts: [corruptShot],
      result: { ...recipe.shot.result!, evidence: [] },
    },
  }
}

function advisoryFixture() {
  const recipe = canonicalRecipe({
    pacing: 'fast_social',
    scenePatch: (item) => item.sceneId === 'scene-001'
      ? { characters: ['José', 'Mara'] }
      : {},
    shotPatch: (item) => {
      if (item.shotId === 'scene-001-shot-001') return { subject: 'Jose' }
      if (item.shotId === 'scene-001-shot-002') return { subject: 'Mara' }
      if (item.sceneId !== 'scene-002') return {}
      const suffix = item.shotId.split('-').at(-1)
      if (suffix === '001' || suffix === '002') return {
        objective: 'Follow Mara opening the sealed case now',
        subject: 'Mara',
        action: 'Mara opens the sealed case very slowly',
        suggestedShotSize: 'medium',
      }
      if (suffix === '003') return {
        objective: 'Hold on the alarm panel',
        subject: 'Mara',
        action: 'A runner keeps moving through the long corridor',
        suggestedShotSize: 'medium',
        outputKind: 'image',
      }
      return {
        objective: 'Reveal the final choice',
        subject: 'Mara',
        action: 'The antenna locks shut',
        suggestedShotSize: 'medium',
        duration: 10,
      }
    },
  })
  recipe.shot.result!.evidence = recipe.shot.result!.evidence.map((item) => (
    item.evidenceId === 'shot-plan-evidence-002-003'
      ? { ...item, ruleId: 'SUSTAINED_MOVEMENT' }
      : item
  ))
  return recipe
}

const ISO_TIME = '2026-07-19T01:00:00.000Z'
const canonicalSource = {
  id: 'source-1',
  kind: 'text' as const,
  title: 'Pilot',
  prompt: [
    'INT. LAB - NIGHT',
    'Jose opens the sealed case.',
    'EXT. ROOF - DAWN',
    'Mara runs to the antenna, then smiles.',
    'The city falls quiet.',
  ].join('\n'),
}

function decideEveryDraft(
  recipe: StoryboardDirectorRecipe,
  stageId: 'scene-review' | 'beat-review' | 'shot-review',
) {
  const drafts = stageId === 'scene-review'
    ? recipe.scene.drafts
    : stageId === 'beat-review'
      ? recipe.beat.drafts
      : recipe.shot.drafts
  return drafts.reduce((next, item) => setRecipeDecision(
    next,
    stageId,
    stageId === 'scene-review'
      ? item.sceneId
      : stageId === 'beat-review'
        ? (item as RecipeReviewItem<NarrativeBeatDraft>).beatId
        : (item as RecipeReviewItem<ShotPlanDraft>).shotId,
    'approved',
    ISO_TIME,
  ), recipe)
}

function canonicalRecipe(options: {
  pacing?: 'standard' | 'fast_social' | 'slow_cinematic'
  scenePatch?: (scene: RecipeReviewItem<ScriptSceneDraft>) => Partial<ScriptSceneDraft>
  beatPatch?: (beat: RecipeReviewItem<NarrativeBeatDraft>) => Partial<NarrativeBeatDraft>
  shotPatch?: (
    shot: RecipeReviewItem<ShotPlanDraft>,
    index: number,
  ) => Partial<ShotPlanDraft>
} = {}) {
  let recipe = createStoryboardDirectorRecipe(context, canonicalSource, ISO_TIME)
  for (const item of recipe.scene.drafts) {
    recipe = updateRecipeDraft(recipe, 'scene-review', item.sceneId, {
      characters: item.sceneId === 'scene-001' ? ['Jose'] : ['Mara'],
      ...options.scenePatch?.(item),
    }, ISO_TIME)
  }
  recipe = approveSceneStage(decideEveryDraft(recipe, 'scene-review'), ISO_TIME)
  for (const item of recipe.beat.drafts) {
    const patch = options.beatPatch?.(item)
    if (patch && Object.keys(patch).length > 0) {
      recipe = updateRecipeDraft(recipe, 'beat-review', item.beatId, patch, ISO_TIME)
    }
  }
  recipe = decideEveryDraft(recipe, 'beat-review')
  recipe = {
    ...recipe,
    shot: {
      ...recipe.shot,
      options: {
        ...recipe.shot.options,
        requestedShotCount: 6,
        pacing: options.pacing ?? 'standard',
      },
    },
  }
  recipe = approveBeatStage(recipe, ISO_TIME)
  for (const [index, item] of recipe.shot.drafts.entries()) {
    const patch: Partial<ShotPlanDraft> = {
      ...(!item.subject.trim()
        ? { subject: item.sceneId === 'scene-001' ? 'Jose' : 'Mara' }
        : {}),
      ...(item.shotId === 'scene-001-shot-001' ? { suggestedShotSize: 'wide' as const } : {}),
      ...options.shotPatch?.(item, index),
    }
    if (Object.keys(patch).length > 0) {
      recipe = updateRecipeDraft(recipe, 'shot-review', item.shotId, patch, ISO_TIME)
    }
  }
  return approveShotStage(decideEveryDraft(recipe, 'shot-review'), ISO_TIME)
}

function orderIntegrationRecipe() {
  const orderSource = {
    ...canonicalSource,
    prompt: [
      'INT. LAB - NIGHT',
      'Jose opens the case.',
      'Mara closes the door.',
      'Jose watches the monitor.',
      'Mara turns off the alarm.',
    ].join('\n'),
  }
  let recipe = createStoryboardDirectorRecipe(context, orderSource, ISO_TIME)
  recipe = approveSceneStage(decideEveryDraft(recipe, 'scene-review'), ISO_TIME)
  recipe = decideEveryDraft(recipe, 'beat-review')
  recipe = {
    ...recipe,
    shot: {
      ...recipe.shot,
      options: { ...recipe.shot.options, pacing: 'slow_cinematic' },
    },
  }
  recipe = approveBeatStage(recipe, ISO_TIME)
  for (const [index, item] of recipe.shot.drafts.entries()) {
    const breaker = index === 2
    recipe = updateRecipeDraft(recipe, 'shot-review', item.shotId, {
      objective: breaker ? 'Break the visual sequence' : 'Hold on the repeated action',
      subject: 'Mara',
      action: breaker ? 'A distinct interruption occurs' : 'The repeated action continues',
      suggestedShotSize: breaker ? 'wide' : 'medium',
      duration: breaker ? 10 : 5,
    }, ISO_TIME)
  }
  return decideEveryDraft(recipe, 'shot-review')
}

describe('Storyboard Director intelligence', () => {
  test('blocks uncovered scenes and beats with stable item identities', () => {
    const findings = analyzeStoryboardDirectorRecipe(recipeWithCoverageGaps())
    assert.deepEqual(findings.filter((item) => item.severity === 'blocking').map((item) => ({
      code: item.code,
      sceneId: item.sceneId,
      beatId: item.beatId,
    })), [
      { code: 'SCENE_WITHOUT_APPROVED_BEAT', sceneId: 'scene-002', beatId: undefined },
      { code: 'BEAT_WITHOUT_APPROVED_SHOT', sceneId: 'scene-001', beatId: 'scene-001-beat-002' },
    ])
    assert.equal(new Set(findings.map((item) => item.findingId)).size, findings.length)
  })

  test('blocks lineage mismatch, stale source, orphan references, and missing shot fields', () => {
    const findings = analyzeStoryboardDirectorRecipe(corruptLineageRecipe())
    const codes = findings.map((item) => item.code)
    assert.ok(codes.includes('RECIPE_SOURCE_STALE'))
    assert.ok(codes.includes('ARTIFACT_LINEAGE_MISMATCH'))
    assert.ok(codes.includes('SHOT_SCENE_REFERENCE_MISSING'))
    assert.ok(codes.includes('SHOT_BEAT_REFERENCE_MISSING'))
    assert.ok(codes.includes('SHOT_SUBJECT_MISSING'))
    assert.ok(codes.includes('SHOT_ACTION_MISSING'))
    assert.ok(codes.includes('SHOT_EVIDENCE_MISSING'))
    assert.equal(isStoryboardRecipeMaterializationReady(corruptLineageRecipe()), false)
  })

  test('advises on repetition, establishing coverage, reaction coverage, pacing, and naming', () => {
    const findings = analyzeStoryboardDirectorRecipe(advisoryFixture())
    assert.deepEqual(findings.map((item) => item.code), [
      'SCENE_ESTABLISHING_SHOT_MISSING',
      'ADJACENT_SHOT_DUPLICATE',
      'SHOT_SIZE_REPETITION',
      'OUTPUT_KIND_MOTION_MISMATCH',
      'PACING_DURATION_MISMATCH',
      'CHARACTER_NAME_INCONSISTENT',
    ])
    assert.ok(findings.every((item) => item.findingId.startsWith('sdrf1_')))
  })

  test('reports exact coverage counts without opaque confidence', () => {
    const summary = summarizeStoryboardDirectorRecipe(approvedRecipe())
    assert.deepEqual(summary, {
      approvedScenes: 2,
      approvedBeats: 5,
      approvedShots: 6,
      coveredBeats: 5,
      blockingCount: 0,
      advisoryCount: 1,
      sourceFresh: true,
      ready: true,
    })
    assert.equal('confidence' in summary, false)
  })

  test('keeps finding order and identities stable across timestamps and evidence insertion order', () => {
    const first = advisoryFixture()
    const second = advisoryFixture()
    const duplicateRuleEvidence = [
      evidence('duplicate-rule-evidence', 2, 'visual-response'),
      evidence('duplicate-rule-evidence', 2, 'shot-source'),
    ]
    first.shot = {
      ...first.shot,
      result: {
        ...first.shot.result!,
        evidence: [...first.shot.result!.evidence, ...duplicateRuleEvidence],
      },
    }
    second.audit = {
      createdAt: '2099-01-01T00:00:00.000Z',
      updatedAt: '2099-01-02T00:00:00.000Z',
    }
    second.storyboard = { ...second.storyboard, updatedAt: '2099-01-03T00:00:00.000Z' }
    second.shot = {
      ...second.shot,
      result: {
        ...second.shot.result!,
        evidence: [
          ...second.shot.result!.evidence,
          ...duplicateRuleEvidence,
        ].reverse(),
      },
    }
    assert.deepEqual(
      analyzeStoryboardDirectorRecipe(second),
      analyzeStoryboardDirectorRecipe(first),
    )
  })

  test('propagates exact deduplicated evidence IDs and emits one finding per affected identity', () => {
    const recipe = approvedRecipe()
    const duplicate = recipe.shot.result!.evidence[0]!
    recipe.shot = {
      ...recipe.shot,
      drafts: recipe.shot.drafts.map((item) => item.shotId === 'scene-001-shot-001'
        ? { ...item, subject: '' }
        : item),
      result: {
        ...recipe.shot.result!,
        evidence: [duplicate, ...recipe.shot.result!.evidence, { ...duplicate }],
      },
    }
    const subjectFindings = analyzeStoryboardDirectorRecipe(recipe).filter(
      (item) => item.code === 'SHOT_SUBJECT_MISSING',
    )
    assert.equal(subjectFindings.length, 1)
    assert.deepEqual(subjectFindings[0]?.evidenceIds, ['shot-plan-evidence-001-001'])
  })

  test('does not satisfy shot evidence from an upstream stage sharing the same source range', () => {
    const recipe = approvedRecipe()
    recipe.beat = {
      ...recipe.beat,
      result: {
        ...recipe.beat.result!,
        evidence: [evidence('upstream-only-evidence', 2)],
      },
    }
    recipe.shot = {
      ...recipe.shot,
      result: {
        ...recipe.shot.result!,
        evidence: recipe.shot.result!.evidence.filter((item) => item.lineStart !== 2),
      },
    }
    assert.deepEqual(analyzeStoryboardDirectorRecipe(recipe).filter(
      (item) => item.code === 'SHOT_EVIDENCE_MISSING',
    ).map((item) => item.shotId), ['scene-001-shot-002'])
  })

  test('allows advisory-only findings but never lets them override a blocker', () => {
    assert.equal(isStoryboardRecipeMaterializationReady(advisoryFixture()), true)
    const blocked = advisoryFixture()
    blocked.shot = {
      ...blocked.shot,
      drafts: blocked.shot.drafts.map((item) => item.shotId === 'scene-001-shot-001'
        ? { ...item, action: '' }
        : item),
    }
    assert.ok(analyzeStoryboardDirectorRecipe(blocked).some((item) => item.severity === 'advisory'))
    assert.equal(isStoryboardRecipeMaterializationReady(blocked), false)
  })

  test('reports exactly one stable advisory for an approved reaction or turn with zero linked shots', () => {
    for (const type of ['reaction', 'turn'] as const) {
      const recipe = approvedRecipe()
      recipe.beat = {
        ...recipe.beat,
        drafts: recipe.beat.drafts.map((item) => item.beatId === 'scene-001-beat-002'
          ? { ...item, type }
          : item),
      }
      recipe.shot = {
        ...recipe.shot,
        drafts: recipe.shot.drafts.filter((item) => item.beatId !== 'scene-001-beat-002'),
      }
      const first = analyzeStoryboardDirectorRecipe(recipe).filter(
        (item) => item.code === 'REACTION_VISUAL_RESPONSE_MISSING',
      )
      recipe.audit = { ...recipe.audit, updatedAt: '2099-01-01T00:00:00.000Z' }
      const second = analyzeStoryboardDirectorRecipe(recipe).filter(
        (item) => item.code === 'REACTION_VISUAL_RESPONSE_MISSING',
      )
      assert.equal(first.length, 1)
      assert.equal(first[0]?.beatId, 'scene-001-beat-002')
      assert.ok(first[0]?.findingId.startsWith('sdrf1_'))
      assert.equal(second[0]?.findingId, first[0]?.findingId)
    }
  })

  test('does not advise when approved shots are linked regardless of evidence markers', () => {
    for (const { beatId, preserveMarker } of [
      { beatId: 'scene-001-beat-002', preserveMarker: false },
      { beatId: 'scene-002-beat-002', preserveMarker: true },
    ]) {
      const recipe = approvedRecipe()
      recipe.beat = {
        ...recipe.beat,
        drafts: recipe.beat.drafts.map((item) => item.beatId === beatId
          ? { ...item, type: 'reaction' as const }
          : item),
      }
      recipe.shot = {
        ...recipe.shot,
        result: {
          ...recipe.shot.result!,
          evidence: preserveMarker
            ? recipe.shot.result!.evidence
            : recipe.shot.result!.evidence.map((item) => ({
              ...item,
              ruleId: 'SHOT_PRIMARY_SOURCE_UNIT',
            })),
        },
      }
      assert.equal(analyzeStoryboardDirectorRecipe(recipe).some(
        (item) => item.code === 'REACTION_VISUAL_RESPONSE_MISSING',
      ), false)
    }
  })

  test('does not count rejected or pending shots as linked reaction coverage', () => {
    for (const decision of ['rejected', 'pending'] as const) {
      const recipe = approvedRecipe()
      const unapproved = {
        ...recipe.shot.drafts.find((item) => item.shotId === 'scene-001-shot-002')!,
        shotId: `shot-${decision}`,
        decision,
      }
      recipe.beat = {
        ...recipe.beat,
        drafts: recipe.beat.drafts.map((item) => item.beatId === 'scene-001-beat-002'
          ? { ...item, type: 'reaction' as const }
          : item),
      }
      recipe.shot = {
        ...recipe.shot,
        drafts: [
          ...recipe.shot.drafts.filter((item) => item.beatId !== 'scene-001-beat-002'),
          unapproved,
        ],
      }
      const findings = analyzeStoryboardDirectorRecipe(recipe).filter(
        (item) => item.code === 'REACTION_VISUAL_RESPONSE_MISSING',
      )
      assert.equal(findings.length, 1)
      assert.equal(findings[0]?.beatId, 'scene-001-beat-002')
    }
  })

  test('blocks unresolved decisions and non-final stage statuses', () => {
    const pending = approvedRecipe()
    pending.shot = {
      ...pending.shot,
      status: 'needs-review',
      drafts: pending.shot.drafts.map((item, index) => (
        index === 0 ? { ...item, decision: 'pending' as const } : item
      )),
    }
    const findings = analyzeStoryboardDirectorRecipe(pending).filter(
      (item) => item.code === 'REVIEW_ITEMS_UNRESOLVED',
    )
    assert.equal(findings.length, 1)
    assert.equal(isStoryboardRecipeMaterializationReady(pending), false)
    assert.equal(summarizeStoryboardDirectorRecipe(pending).ready, false)

    const persistedBlocker = approvedRecipe()
    persistedBlocker.findings = [{
      findingId: 'source-node-missing',
      severity: 'blocking',
      code: 'SOURCE_NODE_MISSING',
      message: 'The source node is missing.',
      evidenceIds: [],
    }]
    assert.equal(analyzeStoryboardDirectorRecipe(persistedBlocker).filter(
      (item) => item.code === 'REVIEW_ITEMS_UNRESOLVED',
    ).length, 1)
    assert.equal(isStoryboardRecipeMaterializationReady(persistedBlocker), false)

    const persistedAdvisory = approvedRecipe()
    persistedAdvisory.findings = [{
      findingId: 'continuity-advisory',
      severity: 'advisory',
      code: 'CASE_CONTINUITY',
      message: 'Keep the case orientation consistent.',
      evidenceIds: [],
    }]
    assert.equal(isStoryboardRecipeMaterializationReady(persistedAdvisory), true)
  })

  test('blocks malformed and duplicate current materialization receipts', () => {
    const recipe = approvedRecipe()
    const artifactId = recipe.shot.approvedArtifact!.artifactId
    const resultId = 'shot-plan-result-1'
    const identity = createRecipeMaterializationIdentity(
      recipe.recipeId,
      'shot-plan',
      artifactId,
      resultId,
    )
    recipe.receipts = [
      { identity, kind: 'shot-plan', resultId, targetId: 'node-1' },
      { identity, kind: 'shot-plan', resultId, targetId: 'node-2' },
      { identity: 'sdrm1_wrong', kind: 'shot-plan', resultId: 'other', targetId: 'node-3' },
    ]
    const conflicts = analyzeStoryboardDirectorRecipe(recipe).filter(
      (item) => item.code === 'MATERIALIZATION_RECEIPT_CONFLICT',
    )
    assert.equal(conflicts.length, 1)
    assert.equal(isStoryboardRecipeMaterializationReady(recipe), false)
  })

  test('uses inclusive duplicate overlap boundaries, ignores empty text, and isolates scenes', () => {
    const recipe = approvedRecipe()
    recipe.scene = { ...recipe.scene, drafts: recipe.scene.drafts.map((item) => ({ ...item, location: '' })) }
    recipe.beat = { ...recipe.beat, drafts: recipe.beat.drafts.filter((item) => item.type !== 'reaction') }
    recipe.shot = {
      ...recipe.shot,
      drafts: [
        shot('overlap-a', 'scene-001', 'scene-001-beat-001', 1, {
          objective: 'one two three four five',
          action: '',
        }),
        shot('overlap-b', 'scene-001', 'scene-001-beat-002', 2, {
          objective: 'one two three four six',
          action: '',
        }),
        shot('empty-a', 'scene-001', 'scene-001-beat-001', 3, { objective: '', action: '' }),
        shot('cross-scene', 'scene-002', 'scene-002-beat-001', 1, { objective: '', action: '' }),
        shot('scene-two-cover', 'scene-002', 'scene-002-beat-002', 2),
      ],
      result: {
        ...recipe.shot.result!,
        evidence: [evidence('all-shot-evidence', 2), evidence('scene-two-evidence', 4)],
      },
    }
    const duplicates = analyzeStoryboardDirectorRecipe(recipe).filter(
      (item) => item.code === 'ADJACENT_SHOT_DUPLICATE',
    )
    assert.deepEqual(duplicates.map((item) => item.shotId), ['overlap-b'])
  })

  test('requires four repeated sizes and handles longer runs as one affected sequence', () => {
    const three = advisoryFixture()
    three.shot = { ...three.shot, drafts: three.shot.drafts.slice(0, 3) }
    assert.equal(analyzeStoryboardDirectorRecipe(three).some(
      (item) => item.code === 'SHOT_SIZE_REPETITION',
    ), false)
    const five = advisoryFixture()
    five.shot = {
      ...five.shot,
      drafts: [
        ...five.shot.drafts,
        shot('shot-e', 'scene-001', 'scene-001-beat-003', 5),
      ],
      result: {
        ...five.shot.result!,
        evidence: [...five.shot.result!.evidence, evidence('shot-e-evidence', 2)],
      },
    }
    assert.equal(analyzeStoryboardDirectorRecipe(five).filter(
      (item) => item.code === 'SHOT_SIZE_REPETITION',
    ).length, 1)
  })

  test('applies exact fast and slow pacing duration thresholds', () => {
    const fast = canonicalRecipe({ pacing: 'fast_social' })
    assert.equal(analyzeStoryboardDirectorRecipe(fast).some(
      (item) => item.code === 'PACING_DURATION_MISMATCH',
    ), false)
    const fastAtBoundary = canonicalRecipe({
      pacing: 'fast_social',
      shotPatch: (_item, index) => index === 0 ? { duration: 10 } : {},
    })
    assert.equal(analyzeStoryboardDirectorRecipe(fastAtBoundary).filter(
      (item) => item.code === 'PACING_DURATION_MISMATCH',
    ).length, 1)

    const slow = canonicalRecipe({
      pacing: 'slow_cinematic',
      shotPatch: (item) => item.sceneId === 'scene-002'
        ? { duration: item.shotId === 'scene-002-shot-003' ? 5 : 10 }
        : {},
    })
    assert.equal(analyzeStoryboardDirectorRecipe(slow).some(
      (item) => item.code === 'PACING_DURATION_MISMATCH',
    ), false)
    const slowAtBoundary = canonicalRecipe({
      pacing: 'slow_cinematic',
      shotPatch: (item) => item.sceneId === 'scene-002'
        ? { duration: item.shotId === 'scene-002-shot-004' ? 10 : 5 }
        : {},
    })
    assert.equal(analyzeStoryboardDirectorRecipe(slowAtBoundary).filter(
      (item) => item.code === 'PACING_DURATION_MISMATCH',
    ).length, 1)
  })

  test('normalizes Unicode names canonically and reports only genuine variants', () => {
    const recipe = approvedRecipe()
    recipe.scene = {
      ...recipe.scene,
      drafts: recipe.scene.drafts.map((item) => ({
        ...item,
        characters: item.sceneId === 'scene-001' ? ['Élodie'] : ['李雷'],
      })),
    }
    recipe.shot = {
      ...recipe.shot,
      drafts: recipe.shot.drafts.map((item, index) => {
        if (index === 0) return { ...item, subject: 'E\u0301LODIE' }
        if (index === 1) return { ...item, subject: 'Elodie' }
        if (index === 2) return { ...item, subject: '李雷' }
        return item
      }),
    }
    const naming = analyzeStoryboardDirectorRecipe(recipe).filter(
      (item) => item.code === 'CHARACTER_NAME_INCONSISTENT',
    )
    assert.deepEqual(naming.map((item) => item.shotId), ['scene-001-shot-002'])
    assert.ok(naming.every((item) => !/replace|rename|use instead/iu.test(item.message)))
  })

  test('blocks two-scene shots whose existing beat references are swapped across scenes', () => {
    const recipe = canonicalRecipe()
    recipe.shot = {
      ...recipe.shot,
      drafts: recipe.shot.drafts.map((item) => {
        if (item.beatId === 'scene-001-beat-002') {
          return { ...item, beatId: 'scene-002-beat-002' }
        }
        if (item.beatId === 'scene-002-beat-002') {
          return { ...item, beatId: 'scene-001-beat-002' }
        }
        return item
      }),
    }
    const findings = analyzeStoryboardDirectorRecipe(recipe)
    assert.equal(findings.filter(
      (item) => item.code === 'SHOT_BEAT_REFERENCE_MISSING',
    ).length, 3)
    assert.ok(findings.some((item) => item.code === 'ARTIFACT_LINEAGE_MISMATCH'))
    assert.equal(summarizeStoryboardDirectorRecipe(recipe).coveredBeats, 3)
    assert.equal(isStoryboardRecipeMaterializationReady(recipe), false)
  })

  test('blocks two-scene beats whose approved scene ownership is swapped', () => {
    const recipe = canonicalRecipe()
    recipe.beat = {
      ...recipe.beat,
      drafts: recipe.beat.drafts.map((item) => {
        if (item.beatId === 'scene-001-beat-001') return { ...item, sceneId: 'scene-002' }
        if (item.beatId === 'scene-002-beat-001') return { ...item, sceneId: 'scene-001' }
        return item
      }),
    }
    const findings = analyzeStoryboardDirectorRecipe(recipe)
    assert.ok(findings.some((item) => item.code === 'ARTIFACT_LINEAGE_MISMATCH'))
    assert.equal(findings.filter(
      (item) => item.code === 'SHOT_BEAT_REFERENCE_MISSING',
    ).length, 2)
    assert.equal(summarizeStoryboardDirectorRecipe(recipe).coveredBeats, 3)
    assert.equal(isStoryboardRecipeMaterializationReady(recipe), false)
  })

  test('rejects semantically invalid retained stage results and payloads', () => {
    const probes: Array<{
      name: string
      mutate: (recipe: StoryboardDirectorRecipe) => void
    }> = [
      {
        name: 'blocked status with retained output',
        mutate: (recipe) => { recipe.shot.result!.status = 'blocked' },
      },
      {
        name: 'ready status with a blocker',
        mutate: (recipe) => {
          recipe.shot.result!.blockers = [{ code: 'BLOCKED', message: 'Blocked output.' }]
        },
      },
      {
        name: 'needs-review status without a warning',
        mutate: (recipe) => {
          recipe.shot.result!.status = 'needs-review'
          recipe.shot.result!.warnings = []
        },
      },
      {
        name: 'wrong skill',
        mutate: (recipe) => { recipe.shot.result!.skillId = 'script-segmentation' },
      },
      {
        name: 'wrong version',
        mutate: (recipe) => { recipe.shot.result!.skillVersion = '9.9.9' },
      },
      {
        name: 'wrong fingerprint',
        mutate: (recipe) => { recipe.shot.result!.runFingerprint = 'csf1_wrong' },
      },
      {
        name: 'wrong source lineage',
        mutate: (recipe) => {
          recipe.shot.result!.artifacts[0]!.sourceArtifactIds = ['wrong-beat-artifact']
        },
      },
      {
        name: 'malformed payload',
        mutate: (recipe) => { recipe.shot.result!.artifacts[0]!.payload = { scenes: [] } },
      },
    ]
    for (const probe of probes) {
      const recipe = canonicalRecipe()
      probe.mutate(recipe)
      const findings = analyzeStoryboardDirectorRecipe(recipe)
      assert.ok(
        findings.some((item) => item.code === 'ARTIFACT_LINEAGE_MISMATCH'),
        probe.name,
      )
      assert.equal(isStoryboardRecipeMaterializationReady(recipe), false, probe.name)
    }
  })

  test('treats Unicode whitespace and format controls as missing required shot text', () => {
    const invisible = '\u200B\u2060\u00A0\t\n'
    const subjectMissing = canonicalRecipe({
      shotPatch: (_item, index) => index === 1 ? { subject: invisible } : {},
    })
    const actionMissing = canonicalRecipe({
      shotPatch: (_item, index) => index === 1 ? { action: invisible } : {},
    })
    const meaningful = canonicalRecipe({
      shotPatch: (_item, index) => index === 1
        ? { subject: '李雷', action: '走向门口' }
        : {},
    })
    assert.equal(analyzeStoryboardDirectorRecipe(subjectMissing).filter(
      (item) => item.code === 'SHOT_SUBJECT_MISSING',
    ).length, 1)
    assert.equal(analyzeStoryboardDirectorRecipe(actionMissing).filter(
      (item) => item.code === 'SHOT_ACTION_MISSING',
    ).length, 1)
    assert.equal(analyzeStoryboardDirectorRecipe(meaningful).some(
      (item) => item.code === 'SHOT_SUBJECT_MISSING' || item.code === 'SHOT_ACTION_MISSING',
    ), false)
  })

  test('uses Unicode-aware required text for explicit scene locations', () => {
    const fixture = (location: string) => canonicalRecipe({
      scenePatch: (item) => item.sceneId === 'scene-001' ? { location } : {},
      beatPatch: (item) => item.sceneId === 'scene-001' && item.type === 'setup'
        ? { type: 'action' }
        : {},
      shotPatch: (item) => item.sceneId === 'scene-001'
        ? { suggestedShotSize: 'medium' }
        : {},
    })
    const absent = fixture('')
    const formatOnly = fixture('\u200B\u2060\u00A0\t\n')
    const meaningful = fixture('摄影棚')
    const establishingForFirstScene = (recipe: StoryboardDirectorRecipe) => (
      analyzeStoryboardDirectorRecipe(recipe).filter((item) => (
        item.code === 'SCENE_ESTABLISHING_SHOT_MISSING'
        && item.sceneId === 'scene-001'
      ))
    )

    assert.equal(establishingForFirstScene(formatOnly).length, 0)
    assert.equal(
      summarizeStoryboardDirectorRecipe(formatOnly).advisoryCount,
      summarizeStoryboardDirectorRecipe(absent).advisoryCount,
    )
    assert.equal(establishingForFirstScene(meaningful).length, 1)
  })

  test('uses reviewed moveRecipeDraft order for adjacency, repetition, and slow pacing', () => {
    const before = orderIntegrationRecipe()
    const beforeFindings = analyzeStoryboardDirectorRecipe(before)
    const beforeDuplicates = beforeFindings.filter(
      (item) => item.code === 'ADJACENT_SHOT_DUPLICATE',
    ).length
    assert.equal(beforeFindings.some((item) => item.code === 'SHOT_SIZE_REPETITION'), false)
    assert.equal(beforeFindings.some((item) => item.code === 'PACING_DURATION_MISMATCH'), false)

    let after = moveRecipeDraft(
      before,
      'shot-review',
      'scene-001-shot-003',
      1,
      ISO_TIME,
    )
    after = moveRecipeDraft(after, 'shot-review', 'scene-001-shot-003', 1, ISO_TIME)
    const afterFindings = analyzeStoryboardDirectorRecipe(after)
    assert.ok(afterFindings.filter(
      (item) => item.code === 'ADJACENT_SHOT_DUPLICATE',
    ).length > beforeDuplicates)
    assert.equal(afterFindings.filter(
      (item) => item.code === 'SHOT_SIZE_REPETITION',
    ).length, 1)
    assert.equal(afterFindings.filter(
      (item) => item.code === 'PACING_DURATION_MISMATCH',
    ).length, 1)
  })

  test('normalizes Turkish I tokens without locale APIs', () => {
    const recipe = canonicalRecipe({
      shotPatch: (_item, index) => index < 2
        ? {
          objective: index === 0 ? 'I alpha beta' : 'i alpha beta',
          action: 'panel',
          suggestedShotSize: 'medium',
        }
        : {},
    })
    const original = String.prototype.toLocaleLowerCase
    String.prototype.toLocaleLowerCase = function toTurkishLocaleLowerCase() {
      return original.call(this, 'tr')
    }
    try {
      assert.ok(analyzeStoryboardDirectorRecipe(recipe).some((item) => (
        item.code === 'ADJACENT_SHOT_DUPLICATE'
        && item.shotId === 'scene-001-shot-002'
      )))
    } finally {
      String.prototype.toLocaleLowerCase = original
    }
  })

  test('normalizes canonically equivalent NFC and NFD tokens with NFKC', () => {
    const recipe = canonicalRecipe({
      shotPatch: (_item, index) => index < 2
        ? {
          objective: index === 0 ? 'Café alpha beta' : 'Cafe\u0301 alpha beta',
          action: 'panel',
          suggestedShotSize: 'medium',
        }
        : {},
    })
    assert.ok(analyzeStoryboardDirectorRecipe(recipe).some((item) => (
      item.code === 'ADJACENT_SHOT_DUPLICATE'
      && item.shotId === 'scene-001-shot-002'
    )))
  })
})
