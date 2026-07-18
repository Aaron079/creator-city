/**
 * Unit tests for deterministic Storyboard Director Recipe intelligence.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/storyboard/recipe/intelligence.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type {
  CreatorSkillArtifact,
  CreatorSkillEvidence,
  CreatorSkillRunResult,
  NarrativeBeatDraft,
  ScriptSceneDraft,
  ShotPlanDraft,
} from '../../skills'
import {
  createRecipeMaterializationIdentity,
  createStoryboardDirectorRecipeIdentity,
} from './identity'
import type { RecipeReviewItem, StoryboardDirectorRecipe } from './types'
import {
  analyzeStoryboardDirectorRecipe,
  isStoryboardRecipeMaterializationReady,
  summarizeStoryboardDirectorRecipe,
} from './intelligence'

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

function scene(
  sceneId: string,
  order: number,
  overrides: Partial<RecipeReviewItem<ScriptSceneDraft>> = {},
): RecipeReviewItem<ScriptSceneDraft> {
  return {
    sceneId,
    order,
    heading: order === 1 ? 'INT. LAB - NIGHT' : 'EXT. ROOF - DAWN',
    location: order === 1 ? 'LAB' : 'ROOF',
    timeOfDay: order === 1 ? 'NIGHT' : 'DAWN',
    characters: order === 1 ? ['Jose', 'Mara'] : ['Mara'],
    actionSummary: order === 1 ? 'Jose opens the case.' : 'Mara stops the alarm.',
    sourceText: source.prompt.split('\n')[order === 1 ? 1 : 3]!,
    lineStart: order === 1 ? 2 : 4,
    lineEnd: order === 1 ? 2 : 4,
    reviewStatus: 'pending',
    decision: 'approved',
    ...overrides,
  }
}

function beat(
  beatId: string,
  sceneId: string,
  order: number,
  overrides: Partial<RecipeReviewItem<NarrativeBeatDraft>> = {},
): RecipeReviewItem<NarrativeBeatDraft> {
  const inFirstScene = sceneId === 'scene-001'
  return {
    beatId,
    sceneId,
    order,
    type: 'action',
    sourceText: source.prompt.split('\n')[inFirstScene ? 1 : 3]!,
    summary: `Beat ${beatId}`,
    lineStart: inFirstScene ? 2 : 4,
    lineEnd: inFirstScene ? 2 : 4,
    reviewStatus: 'pending',
    decision: 'approved',
    ...overrides,
  }
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

function artifact(
  artifactId: string,
  artifactType: string,
  sourceArtifactIds: string[],
): CreatorSkillArtifact {
  return {
    artifactId,
    artifactType,
    artifactVersion: 1,
    sourceNodeIds: [source.id],
    sourceArtifactIds,
    payload: {},
  }
}

function result(
  skillId: string,
  output: CreatorSkillArtifact,
  evidenceItems: CreatorSkillEvidence[] = [],
): CreatorSkillRunResult {
  return {
    skillId,
    skillVersion: '1.0.0',
    runFingerprint: `${skillId}-run`,
    status: 'ready',
    artifacts: [output],
    evidence: evidenceItems,
    warnings: [],
    blockers: [],
  }
}

function approvedRecipe(overrides: Partial<StoryboardDirectorRecipe> = {}): StoryboardDirectorRecipe {
  const identity = createStoryboardDirectorRecipeIdentity(context, source)
  const sceneResultArtifact = artifact('scene-result-artifact', 'scene-breakdown', [])
  const sceneApprovedArtifact = artifact(
    'scene-approved-artifact',
    'scene-breakdown',
    [sceneResultArtifact.artifactId],
  )
  const beatResultArtifact = artifact(
    'beat-result-artifact',
    'narrative-beat-map',
    [sceneApprovedArtifact.artifactId],
  )
  const beatApprovedArtifact = artifact(
    'beat-approved-artifact',
    'narrative-beat-map',
    [beatResultArtifact.artifactId],
  )
  const shotResultArtifact = artifact(
    'shot-result-artifact',
    'shot-plan',
    [beatApprovedArtifact.artifactId],
  )
  const shotApprovedArtifact = artifact(
    'shot-approved-artifact',
    'shot-plan',
    [shotResultArtifact.artifactId],
  )
  const shots = [
    shot('shot-001', 'scene-001', 'scene-001-beat-001', 1, { suggestedShotSize: 'wide' }),
    shot('shot-002', 'scene-001', 'scene-001-beat-002', 2, { suggestedShotSize: 'medium' }),
    shot('shot-003', 'scene-001', 'scene-001-beat-003', 3, { suggestedShotSize: 'close' }),
    shot('shot-004', 'scene-002', 'scene-002-beat-001', 1, { suggestedShotSize: 'medium' }),
    shot('shot-005', 'scene-002', 'scene-002-beat-002', 2, { suggestedShotSize: 'close' }),
    shot('shot-006', 'scene-001', 'scene-001-beat-003', 4, { suggestedShotSize: 'full' }),
  ]
  const shotEvidence = shots.map((item) => evidence(
    `${item.shotId}-evidence`,
    item.lineStart,
    item.shotId === 'shot-003' ? 'VISUAL_RESPONSE' : 'shot-source',
  ))
  return {
    schemaVersion: 1,
    recipeId: identity.recipeId,
    projectId: context.projectId,
    workflowId: context.workflowId,
    sourceNode: { ...source },
    sourceFingerprint: identity.sourceFingerprint,
    activeStage: 'shot-review',
    scene: {
      status: 'approved',
      generation: 1,
      sourceFingerprint: identity.sourceFingerprint,
      result: result('script-segmentation', sceneResultArtifact),
      drafts: [scene('scene-001', 1), scene('scene-002', 2)],
      approvedArtifact: sceneApprovedArtifact,
      staleResult: null,
    },
    beat: {
      status: 'approved',
      generation: 1,
      sourceFingerprint: identity.sourceFingerprint,
      result: result('narrative-beat-analysis', beatResultArtifact),
      drafts: [
        beat('scene-001-beat-001', 'scene-001', 1, { type: 'setup' }),
        beat('scene-001-beat-002', 'scene-001', 2),
        beat('scene-001-beat-003', 'scene-001', 3, { type: 'reaction' }),
        beat('scene-002-beat-001', 'scene-002', 1, { type: 'setup' }),
        beat('scene-002-beat-002', 'scene-002', 2, { type: 'closure' }),
      ],
      approvedArtifact: beatApprovedArtifact,
      staleResult: null,
    },
    shot: {
      status: 'approved',
      generation: 1,
      sourceFingerprint: identity.sourceFingerprint,
      result: result('shot-planning', shotResultArtifact, shotEvidence),
      drafts: shots,
      approvedArtifact: shotApprovedArtifact,
      staleResult: null,
      options: {
        requestedShotCount: 6,
        outputMode: 'mixed',
        pacing: 'standard',
        shotSizeStrategy: 'auto',
        userInstruction: '',
      },
    },
    findings: [],
    storyboard: { version: '2', shots: [], updatedAt: '2026-07-19T01:00:00.000Z' },
    receipts: [],
    legacyImportStatus: 'not-offered',
    audit: {
      createdAt: '2026-07-19T01:00:00.000Z',
      updatedAt: '2026-07-19T01:00:00.000Z',
    },
    ...overrides,
  }
}

function recipeWithCoverageGaps() {
  const recipe = approvedRecipe()
  return {
    ...recipe,
    beat: {
      ...recipe.beat,
      drafts: recipe.beat.drafts.filter((item) => item.sceneId === 'scene-001'),
    },
    shot: {
      ...recipe.shot,
      drafts: recipe.shot.drafts.filter((item) => (
        item.sceneId === 'scene-001' && item.beatId !== 'scene-001-beat-002'
      )),
    },
  }
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
  const recipe = approvedRecipe()
  const advisoryShots = [
    shot('shot-a', 'scene-001', 'scene-001-beat-001', 1, {
      objective: 'Follow Jose opening the sealed case now',
      subject: 'Mara',
      action: 'Jose opens the sealed case very slowly',
    }),
    shot('shot-b', 'scene-001', 'scene-001-beat-002', 2, {
      objective: 'Follow Jose opening the sealed case closely',
      subject: 'Mara',
      action: 'Jose opens the sealed case very carefully',
    }),
    shot('shot-c', 'scene-001', 'scene-001-beat-003', 3, {
      objective: 'Hold on the alarm panel',
      subject: 'Mara',
      action: 'A runner keeps moving through the long corridor',
      outputKind: 'image',
    }),
    shot('shot-d', 'scene-001', 'scene-001-beat-003', 4, {
      objective: 'Reveal the final choice',
      subject: 'Jose',
      action: 'The case locks shut',
      duration: 10,
    }),
  ]
  return {
    ...recipe,
    scene: {
      ...recipe.scene,
      drafts: [scene('scene-001', 1, { characters: ['José', 'Mara'] })],
    },
    beat: {
      ...recipe.beat,
      drafts: recipe.beat.drafts.filter((item) => item.sceneId === 'scene-001'),
    },
    shot: {
      ...recipe.shot,
      options: { ...recipe.shot.options, pacing: 'fast_social' as const },
      drafts: advisoryShots,
      result: {
        ...recipe.shot.result!,
        evidence: [
          evidence('shot-a-evidence', 2),
          evidence('shot-b-evidence', 2),
          evidence('shot-c-evidence', 2, 'SUSTAINED_MOVEMENT'),
          evidence('shot-d-evidence', 2),
        ],
      },
    },
  }
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
      'REACTION_VISUAL_RESPONSE_MISSING',
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
      drafts: second.shot.drafts.slice().reverse(),
      result: {
        ...second.shot.result!,
        evidence: [
          ...second.shot.result!.evidence,
          ...duplicateRuleEvidence,
        ].reverse(),
      },
    }
    second.scene = { ...second.scene, drafts: second.scene.drafts.slice().reverse() }
    second.beat = { ...second.beat, drafts: second.beat.drafts.slice().reverse() }
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
      drafts: recipe.shot.drafts.map((item) => item.shotId === 'shot-001'
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
    assert.deepEqual(subjectFindings[0]?.evidenceIds, [
      'shot-001-evidence',
      'shot-002-evidence',
      'shot-003-evidence',
      'shot-006-evidence',
    ])
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
    ).map((item) => item.shotId), ['shot-001', 'shot-002', 'shot-003', 'shot-006'])
  })

  test('allows advisory-only findings but never lets them override a blocker', () => {
    assert.equal(isStoryboardRecipeMaterializationReady(advisoryFixture()), true)
    const blocked = advisoryFixture()
    blocked.shot = {
      ...blocked.shot,
      drafts: blocked.shot.drafts.map((item) => item.shotId === 'shot-a'
        ? { ...item, action: '' }
        : item),
    }
    assert.ok(analyzeStoryboardDirectorRecipe(blocked).some((item) => item.severity === 'advisory'))
    assert.equal(isStoryboardRecipeMaterializationReady(blocked), false)
  })

  test('reports reaction quality separately when the same beat lacks blocking coverage', () => {
    const recipe = approvedRecipe()
    recipe.shot = {
      ...recipe.shot,
      drafts: recipe.shot.drafts.filter((item) => item.beatId !== 'scene-001-beat-003'),
    }
    const codes = analyzeStoryboardDirectorRecipe(recipe).filter(
      (item) => item.beatId === 'scene-001-beat-003',
    ).map((item) => item.code)
    assert.deepEqual(codes, [
      'BEAT_WITHOUT_APPROVED_SHOT',
      'REACTION_VISUAL_RESPONSE_MISSING',
    ])
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
    const fast = approvedRecipe()
    fast.shot = {
      ...fast.shot,
      options: { ...fast.shot.options, pacing: 'fast_social' },
    }
    assert.equal(analyzeStoryboardDirectorRecipe(fast).some(
      (item) => item.code === 'PACING_DURATION_MISMATCH',
    ), false)
    fast.shot = {
      ...fast.shot,
      drafts: fast.shot.drafts.map((item, index) => index === 0
        ? { ...item, duration: 10 as const }
        : item),
    }
    assert.equal(analyzeStoryboardDirectorRecipe(fast).filter(
      (item) => item.code === 'PACING_DURATION_MISMATCH',
    ).length, 1)

    const slow = approvedRecipe()
    slow.shot = {
      ...slow.shot,
      options: { ...slow.shot.options, pacing: 'slow_cinematic' },
      drafts: slow.shot.drafts.map((item, index) => ({
        ...item,
        duration: (index < 2 ? 5 : 10) as 5 | 10,
      })),
    }
    assert.equal(analyzeStoryboardDirectorRecipe(slow).some(
      (item) => item.code === 'PACING_DURATION_MISMATCH',
    ), false)
    slow.shot = {
      ...slow.shot,
      drafts: slow.shot.drafts.map((item, index) => index === 2
        ? { ...item, duration: 5 as const }
        : item),
    }
    assert.equal(analyzeStoryboardDirectorRecipe(slow).filter(
      (item) => item.code === 'PACING_DURATION_MISMATCH',
    ).length, 1)
  })

  test('normalizes Unicode names canonically and reports only genuine variants', () => {
    const recipe = approvedRecipe()
    recipe.scene = {
      ...recipe.scene,
      drafts: recipe.scene.drafts.map((item) => item.sceneId === 'scene-001'
        ? { ...item, characters: ['Élodie', '李雷'] }
        : item),
    }
    recipe.shot = {
      ...recipe.shot,
      drafts: recipe.shot.drafts.map((item, index) => {
        if (item.sceneId !== 'scene-001') return item
        if (index === 0) return { ...item, subject: 'E\u0301LODIE' }
        if (index === 1) return { ...item, subject: '李雷' }
        return { ...item, subject: 'Elodie' }
      }),
    }
    const naming = analyzeStoryboardDirectorRecipe(recipe).filter(
      (item) => item.code === 'CHARACTER_NAME_INCONSISTENT',
    )
    assert.deepEqual(naming.map((item) => item.shotId), ['shot-003', 'shot-006'])
    assert.ok(naming.every((item) => !/replace|rename|use instead/iu.test(item.message)))
  })
})
