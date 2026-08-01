/**
 * Unit tests for Storyboard Director Recipe identity and metadata persistence.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/storyboard/recipe/recipePersistence.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  addNodeToShot,
  createRecipeMaterializationIdentity,
  createStoryboardDirectorPartialBatchIdentity,
  createStoryboardDirectorRecipeIdentity,
  createStoryboardDirectorRecipeRevision,
  createStoryboardDirectorRecipeSketchRevision,
  readStoryboardDirectorRecipe,
  storyboardDirectorRecipeMetadata,
  STORYBOARD_DIRECTOR_MAX_RECEIPTS,
  type RecipeReviewItem,
  type StoryboardDirectorRecipe,
} from '../index'
import type {
  NarrativeBeatDraft,
  ScriptSceneDraft,
  ShotPlanDraft,
} from '../../skills'
import { deriveStoryboardSketchFrame } from '../sketch/grammar'
import { createStoryboardSketchRenderKey } from '../sketch/renderer'
import type { ApprovedStoryboardShot } from '../sketch/types'

const context = { projectId: 'project-1', workflowId: 'workflow-1' }
const source = {
  id: 'source-1',
  kind: 'text' as const,
  title: 'Pilot',
  prompt: 'INT. LAB - NIGHT\nMara opens the sealed case.',
}

function sceneDraft(index = 1): RecipeReviewItem<ScriptSceneDraft> {
  return {
    sceneId: `scene-${index}`,
    order: index,
    heading: 'INT. LAB - NIGHT',
    location: 'LAB',
    timeOfDay: 'NIGHT',
    characters: ['Mara'],
    actionSummary: 'Mara opens the sealed case.',
    sourceText: source.prompt,
    lineStart: 1,
    lineEnd: 2,
    reviewStatus: 'pending',
    decision: 'approved',
  }
}

function beatDraft(index = 1): RecipeReviewItem<NarrativeBeatDraft> {
  return {
    beatId: `beat-${index}`,
    sceneId: 'scene-1',
    order: index,
    type: 'action',
    sourceText: 'Mara opens the sealed case.',
    summary: 'Mara opens the case.',
    lineStart: 2,
    lineEnd: 2,
    reviewStatus: 'pending',
    decision: 'approved',
  }
}

function shotDraft(index = 1): RecipeReviewItem<ShotPlanDraft> {
  return {
    shotId: `shot-${index}`,
    sceneId: 'scene-1',
    beatId: 'beat-1',
    order: index,
    objective: 'Reveal the case.',
    subject: 'Mara and the sealed case',
    action: 'Mara opens the case.',
    suggestedShotSize: 'medium',
    sourceText: 'Mara opens the sealed case.',
    lineStart: 2,
    lineEnd: 2,
    outputKind: 'image',
    duration: 5,
    reviewStatus: 'pending',
    decision: 'approved',
  }
}

function validRecipeFixture(): StoryboardDirectorRecipe {
  const identity = createStoryboardDirectorRecipeIdentity(context, source)
  return {
    schemaVersion: 2,
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
      result: null,
      drafts: [sceneDraft()],
      approvedArtifact: null,
      staleResult: null,
    },
    beat: {
      status: 'approved',
      generation: 1,
      sourceFingerprint: identity.sourceFingerprint,
      result: null,
      drafts: [beatDraft()],
      approvedArtifact: null,
      staleResult: null,
    },
    shot: {
      status: 'needs-review',
      generation: 1,
      sourceFingerprint: identity.sourceFingerprint,
      result: null,
      drafts: [shotDraft()],
      approvedArtifact: null,
      staleResult: null,
      options: {
        requestedShotCount: 1,
        outputMode: 'image',
        pacing: 'standard',
        shotSizeStrategy: 'auto',
        userInstruction: 'Keep the reveal restrained.',
      },
    },
    findings: [{
      findingId: 'finding-1',
      severity: 'advisory',
      code: 'CASE_CONTINUITY',
      message: 'Keep the case orientation consistent.',
      sceneId: 'scene-1',
      evidenceIds: ['evidence-1'],
    }],
    storyboard: {
      version: '1',
      shots: [{
        id: 'card-1',
        index: 0,
        title: 'S01',
        shotType: 'medium',
        durationSec: 5,
        characterIds: ['character-mara'],
        sceneIds: ['scene-1'],
        nodeIds: ['source-1'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    receipts: [{
      identity: createRecipeMaterializationIdentity(
        identity.recipeId,
        'shot-card',
        'shot-1',
        'result-1',
      ),
      kind: 'shot-card',
      resultId: 'result-1',
      targetId: 'card-1',
    }],
    sketchBoard: null,
    legacyImportStatus: 'not-offered',
    audit: {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  }
}

function metadataWith(recipe: unknown): unknown {
  return { storyboardDirectorRecipe: recipe }
}

function sketchBoardFixture(recipe: StoryboardDirectorRecipe) {
  const base = { ...recipe, sketchBoard: null }
  const frames = recipe.shot.drafts
    .filter((shot) => shot.decision === 'approved')
    .map((shot) => {
      const draft = deriveStoryboardSketchFrame(shot as ApprovedStoryboardShot)
      return { ...draft, renderKey: createStoryboardSketchRenderKey(draft) }
    })
  if (frames.length === 0) throw new TypeError('Fixture requires an approved shot')
  return {
    version: 1 as const,
    recipeRevision: createStoryboardDirectorRecipeSketchRevision(base),
    frames,
    updatedAt: '2026-01-03T00:00:00.000Z',
  }
}

function freshSketchBoardFixture(recipe: StoryboardDirectorRecipe) {
  recipe.shot.status = 'approved'
  return sketchBoardFixture(recipe)
}

function unsupportedVersionFixture() {
  return metadataWith({ ...validRecipeFixture(), schemaVersion: 3 })
}

function assertInvalid(recipe: unknown) {
  const result = readStoryboardDirectorRecipe(metadataWith(recipe))
  assert.equal(result.status, 'invalid')
  if (result.status === 'invalid') {
    assert.equal(result.issue.code, 'STORYBOARD_RECIPE_INVALID')
    assert.ok(result.issue.message.length > 0)
  }
}

describe('Storyboard Director Recipe identity', () => {
  test('upgrades a valid version-1 Recipe to version 2 without a sketch board', () => {
    const legacy = structuredClone(validRecipeFixture()) as Record<string, unknown>
    legacy.schemaVersion = 1
    delete legacy.sketchBoard

    const read = readStoryboardDirectorRecipe(metadataWith(legacy))

    assert.equal(read.status, 'valid')
    if (read.status === 'valid') {
      assert.equal(read.recipe.schemaVersion, 2)
      assert.equal(read.recipe.sketchBoard, null)
    }
  })

  test('is deterministic and ignores title and metadata audit time', () => {
    const first = createStoryboardDirectorRecipeIdentity(context, source)
    const second = createStoryboardDirectorRecipeIdentity(context, {
      ...source,
      title: 'Renamed only',
      metadataJson: { updatedAt: '2099-01-01T00:00:00.000Z' },
    })
    assert.equal(first.recipeId, second.recipeId)
    assert.equal(first.sourceFingerprint, second.sourceFingerprint)
    assert.match(first.recipeId, /^sdr1_[0-9a-f]{8}$/)
  })

  test('changes with project, workflow, source node, or effective source text', () => {
    const base = createStoryboardDirectorRecipeIdentity(context, source)
    assert.notEqual(
      createStoryboardDirectorRecipeIdentity({ ...context, projectId: 'project-2' }, source).recipeId,
      base.recipeId,
    )
    assert.notEqual(
      createStoryboardDirectorRecipeIdentity({ ...context, workflowId: 'workflow-2' }, source).recipeId,
      base.recipeId,
    )
    assert.notEqual(
      createStoryboardDirectorRecipeIdentity(context, { ...source, id: 'source-2' }).recipeId,
      base.recipeId,
    )
    assert.notEqual(
      createStoryboardDirectorRecipeIdentity(context, {
        ...source,
        prompt: `${source.prompt}\nA siren starts.`,
      }).recipeId,
      base.recipeId,
    )
  })

  test('uses trimmed result text when present and rejects unusable sources', () => {
    const fromResult = createStoryboardDirectorRecipeIdentity(context, {
      ...source,
      prompt: 'ignored prompt',
      resultText: `  ${source.prompt}  `,
    })
    const fromPrompt = createStoryboardDirectorRecipeIdentity(context, source)
    assert.deepEqual(fromResult, fromPrompt)

    assert.throws(
      () => createStoryboardDirectorRecipeIdentity(context, { ...source, kind: 'image' }),
      TypeError,
    )
    assert.throws(
      () => createStoryboardDirectorRecipeIdentity(context, { ...source, prompt: '   ' }),
      TypeError,
    )
    assert.throws(
      () => createStoryboardDirectorRecipeIdentity({ ...context, projectId: ' ' }, source),
      TypeError,
    )
  })

  test('fingerprints the complete Recipe revision and detects same-identity concurrent edits', () => {
    const recipe = validRecipeFixture()
    const same = structuredClone(recipe)
    const concurrent = {
      ...structuredClone(recipe),
      storyboard: {
        ...structuredClone(recipe.storyboard),
        shots: recipe.storyboard.shots.map((shot) => (
          shot.id === 'card-1' ? { ...shot, directorNote: 'Concurrent edit' } : shot
        )),
      },
    }

    assert.equal(
      createStoryboardDirectorRecipeRevision(recipe),
      createStoryboardDirectorRecipeRevision(same),
    )
    assert.notEqual(
      createStoryboardDirectorRecipeRevision(recipe),
      createStoryboardDirectorRecipeRevision(concurrent),
    )
    assert.match(createStoryboardDirectorRecipeRevision(recipe), /^sdrr1_[0-9a-f]{8}$/)
  })

  test('derives a sketch board revision from the board-free Recipe state', () => {
    const recipe = validRecipeFixture()
    const baseRevision = createStoryboardDirectorRecipeSketchRevision(recipe)
    recipe.sketchBoard = sketchBoardFixture(recipe)

    assert.equal(createStoryboardDirectorRecipeSketchRevision(recipe), baseRevision)
  })

  test('creates deterministic materialization identities from every identity input', () => {
    const first = createRecipeMaterializationIdentity('recipe-1', 'scene', 'scene-1', 'result-1')
    assert.equal(
      createRecipeMaterializationIdentity('recipe-1', 'scene', 'scene-1', 'result-1'),
      first,
    )
    assert.match(first, /^sdrm1_[0-9a-f]{8}$/)
    assert.notEqual(
      createRecipeMaterializationIdentity('recipe-1', 'beat', 'scene-1', 'result-1'),
      first,
    )
    assert.notEqual(
      createRecipeMaterializationIdentity('recipe-1', 'scene', 'scene-2', 'result-1'),
      first,
    )
    assert.notEqual(
      createRecipeMaterializationIdentity('recipe-1', 'scene', 'scene-1', 'result-2'),
      first,
    )
  })

  test('does not collide when materialization identifiers contain newlines', () => {
    const first = createRecipeMaterializationIdentity(
      'recipe-1',
      'scene',
      'artifact-a\nsegment',
      'result-z',
    )
    const second = createRecipeMaterializationIdentity(
      'recipe-1',
      'scene',
      'artifact-a',
      'segment\nresult-z',
    )

    assert.notEqual(first, second)
  })
})

describe('Storyboard Director Recipe persistence', () => {
  test('strictly round-trips the exact version-2 sketch board shape', () => {
    const recipe = validRecipeFixture()
    recipe.sketchBoard = freshSketchBoardFixture(recipe)

    const read = readStoryboardDirectorRecipe(metadataWith(recipe))

    assert.equal(read.status, 'valid')
    if (read.status === 'valid') {
      assert.equal(read.recipe.schemaVersion, 2)
      assert.deepEqual(read.recipe.sketchBoard, recipe.sketchBoard)
    }
  })

  test('rejects duplicate or arbitrary sketch board metadata', () => {
    const duplicate = validRecipeFixture()
    const board = sketchBoardFixture(duplicate)
    const firstFrame = board.frames[0]
    assert.ok(firstFrame)
    duplicate.sketchBoard = {
      ...board,
      frames: [...board.frames, { ...firstFrame }],
    }
    assertInvalid(duplicate)

    const arbitrary = validRecipeFixture()
    arbitrary.sketchBoard = {
      ...sketchBoardFixture(arbitrary),
      unexpected: true,
    } as unknown as typeof arbitrary.sketchBoard
    assertInvalid(arbitrary)

    const forgedRevision = validRecipeFixture()
    forgedRevision.sketchBoard = {
      ...sketchBoardFixture(forgedRevision),
      recipeRevision: 'sdrr1_deadbeef',
    }
    assertInvalid(forgedRevision)
  })

  test('binds sketch board frames to the exact approved shot set and computed render keys', () => {
    const missing = validRecipeFixture()
    missing.sketchBoard = { ...freshSketchBoardFixture(missing), frames: [] }
    assertInvalid(missing)

    const unapproved = validRecipeFixture()
    unapproved.sketchBoard = freshSketchBoardFixture(unapproved)
    unapproved.shot.drafts = unapproved.shot.drafts.map((draft) => ({
      ...draft,
      decision: 'rejected',
    }))
    unapproved.sketchBoard.recipeRevision = createStoryboardDirectorRecipeSketchRevision({
      ...unapproved,
      sketchBoard: null,
    })
    assertInvalid(unapproved)

    const forgedRenderKey = validRecipeFixture()
    forgedRenderKey.sketchBoard = freshSketchBoardFixture(forgedRenderKey)
    const frame = forgedRenderKey.sketchBoard.frames[0]
    assert.ok(frame)
    forgedRenderKey.sketchBoard.frames = [{ ...frame, renderKey: 'csf1_forged' }]
    assertInvalid(forgedRenderKey)
  })

  test('requires persisted sketch board frame order to match approved shot draft order', () => {
    const recipe = validRecipeFixture()
    recipe.shot.drafts = [shotDraft(1), shotDraft(2)]
    recipe.sketchBoard = freshSketchBoardFixture(recipe)
    const first = recipe.sketchBoard.frames[0]
    const second = recipe.sketchBoard.frames[1]
    assert.ok(first)
    assert.ok(second)
    recipe.sketchBoard.frames = [second, first]

    assertInvalid(recipe)
  })

  test('rejects recomputed-key frames with forged immutable derived content', () => {
    const mutateFrame = (mutate: (frame: NonNullable<StoryboardDirectorRecipe['sketchBoard']>['frames'][number]) => void) => {
      const recipe = validRecipeFixture()
      recipe.sketchBoard = freshSketchBoardFixture(recipe)
      const frame = recipe.sketchBoard.frames[0]
      assert.ok(frame)
      mutate(frame)
      frame.renderKey = createStoryboardSketchRenderKey(frame)
      assertInvalid(recipe)
    }

    mutateFrame((frame) => { frame.subjects = frame.subjects.map((subject, index) => (
      index === 0 ? { ...subject, label: 'Forged subject' } : subject
    )) })
    mutateFrame((frame) => { frame.camera = { ...frame.camera, label: 'Forged label' } })
    mutateFrame((frame) => { frame.notes = ['Forged note'] })
    mutateFrame((frame) => { frame.status = 'needs-review' })
  })

  test('round-trips a stale allowed manual frame override with a recomputed render key', () => {
    const recipe = validRecipeFixture()
    recipe.sketchBoard = freshSketchBoardFixture(recipe)
    const frame = recipe.sketchBoard.frames[0]
    assert.ok(frame)
    frame.movement = 'pan'
    frame.status = 'stale'
    frame.renderKey = createStoryboardSketchRenderKey(frame)

    const read = readStoryboardDirectorRecipe(metadataWith(recipe))

    assert.equal(read.status, 'valid')
    if (read.status === 'valid') {
      assert.equal(read.recipe.sketchBoard?.frames[0]?.movement, 'pan')
      assert.equal(read.recipe.sketchBoard?.frames[0]?.status, 'stale')
    }
  })

  test('allows only stale frames while the retained recipe is stale', () => {
    const stale = validRecipeFixture()
    stale.sketchBoard = freshSketchBoardFixture(stale)
    stale.activeStage = 'source'
    stale.scene.status = 'stale'
    stale.beat.status = 'stale'
    stale.shot.status = 'stale'
    stale.sketchBoard.recipeRevision = createStoryboardDirectorRecipeSketchRevision({
      ...stale,
      sketchBoard: null,
    })
    assertInvalid(stale)

    const freshUnapproved = validRecipeFixture()
    freshUnapproved.sketchBoard = freshSketchBoardFixture(freshUnapproved)
    freshUnapproved.shot.status = 'needs-review'
    freshUnapproved.sketchBoard.recipeRevision = createStoryboardDirectorRecipeSketchRevision({
      ...freshUnapproved,
      sketchBoard: null,
    })
    assertInvalid(freshUnapproved)
  })

  test('round-trips valid owned metadata without sharing references', () => {
    const recipe = validRecipeFixture()
    const metadata = storyboardDirectorRecipeMetadata(recipe)
    const stored = metadata.storyboardDirectorRecipe
    const read = readStoryboardDirectorRecipe(metadata)
    assert.equal(read.status, 'valid')
    if (read.status !== 'valid') return

    assert.notEqual(stored, recipe)
    assert.notEqual(read.recipe, stored)
    assert.deepEqual(read.recipe, recipe)
    assert.notEqual(read.recipe.sourceNode, recipe.sourceNode)
    assert.notEqual(read.recipe.scene.drafts, recipe.scene.drafts)
    assert.notEqual(read.recipe.scene.drafts[0], recipe.scene.drafts[0])
    assert.notEqual(read.recipe.storyboard.shots[0], recipe.storyboard.shots[0])
    assert.notEqual(read.recipe.findings[0]?.evidenceIds, recipe.findings[0]?.evidenceIds)
  })

  test('strictly round-trips a deterministic partial-batch blocker', () => {
    const recipe = validRecipeFixture()
    const plannedIdentities = ['sdrm1_plan-a', 'sdrm1_plan-b', 'sdrm1_plan-c']
    const batchId = createStoryboardDirectorPartialBatchIdentity(
      recipe.recipeId,
      'grouped-materialization',
      plannedIdentities,
    )
    recipe.findings = [{
      findingId: batchId.replace(/^sdrb1_/, 'sdrf1_'),
      severity: 'blocking',
      code: 'PARTIAL_MATERIALIZATION_BATCH',
      message: 'Created 1 target; 2 targets were not created.',
      evidenceIds: [],
      partialBatch: {
        batchId,
        operation: 'grouped-materialization',
        plannedCount: 3,
        createdCount: 1,
        uncreatedCount: 2,
        plannedIdentities,
        successfulTargetIds: ['target-1'],
      },
    }]
    const read = readStoryboardDirectorRecipe(storyboardDirectorRecipeMetadata(recipe))
    assert.equal(read.status, 'valid')
    if (read.status !== 'valid') return
    assert.deepEqual(read.recipe.findings, recipe.findings)
    assert.notEqual(read.recipe.findings[0]?.partialBatch, recipe.findings[0]?.partialBatch)
    assert.notEqual(
      read.recipe.findings[0]?.partialBatch?.plannedIdentities,
      recipe.findings[0]?.partialBatch?.plannedIdentities,
    )
  })

  test('rejects forged partial-batch identity, counts, targets, and shape', () => {
    const recipe = validRecipeFixture()
    const plannedIdentities = ['sdrm1_plan-a', 'sdrm1_plan-b']
    const batchId = createStoryboardDirectorPartialBatchIdentity(
      recipe.recipeId,
      'draft-node-creation',
      plannedIdentities,
    )
    const finding = {
      findingId: batchId.replace(/^sdrb1_/, 'sdrf1_'),
      severity: 'blocking' as const,
      code: 'PARTIAL_MATERIALIZATION_BATCH',
      message: 'Created 1 target; 1 target was not created.',
      evidenceIds: [],
      partialBatch: {
        batchId,
        operation: 'draft-node-creation' as const,
        plannedCount: 2,
        createdCount: 1,
        uncreatedCount: 1,
        plannedIdentities,
        successfulTargetIds: ['target-1'],
      },
    }
    const invalid = [
      { ...finding, partialBatch: { ...finding.partialBatch, batchId: 'sdrb1_forged' } },
      { ...finding, partialBatch: { ...finding.partialBatch, uncreatedCount: 0 } },
      { ...finding, partialBatch: { ...finding.partialBatch, successfulTargetIds: [] } },
      { ...finding, partialBatch: { ...finding.partialBatch, successfulTargetIds: ['target-1', 'target-1'] } },
      { ...finding, code: 'OTHER_CODE' },
      { ...finding, partialBatch: { ...finding.partialBatch, unexpected: true } },
    ]
    for (const candidate of invalid) {
      assertInvalid({ ...recipe, findings: [candidate] })
    }
    assertInvalid({
      ...recipe,
      findings: [{
        findingId: finding.findingId,
        severity: 'blocking',
        code: 'PARTIAL_MATERIALIZATION_BATCH',
        message: finding.message,
        evidenceIds: [],
      }],
    })
  })

  test('distinguishes absent, invalid, unsupported, and oversized metadata', () => {
    assert.deepEqual(readStoryboardDirectorRecipe(undefined), { status: 'absent' })
    assert.equal(readStoryboardDirectorRecipe({ storyboardDirectorRecipe: {} }).status, 'invalid')
    const unsupported = readStoryboardDirectorRecipe(unsupportedVersionFixture())
    assert.equal(unsupported.status, 'unsupported')
    if (unsupported.status === 'unsupported') {
      assert.equal(unsupported.issue.code, 'STORYBOARD_RECIPE_VERSION_UNSUPPORTED')
    }
  })

  test('does not execute accessors or accept inherited top-level metadata', () => {
    const inherited = Object.create({ storyboardDirectorRecipe: validRecipeFixture() })
    assert.deepEqual(readStoryboardDirectorRecipe(inherited), { status: 'absent' })

    let reads = 0
    const metadata = Object.create(null)
    Object.defineProperty(metadata, 'storyboardDirectorRecipe', {
      get() {
        reads += 1
        throw new Error('must not execute')
      },
    })
    assert.equal(readStoryboardDirectorRecipe(metadata).status, 'invalid')
    assert.equal(reads, 0)
  })

  test('rejects nested accessors and inherited nested fields without reading them', () => {
    let reads = 0
    const accessorRecipe = validRecipeFixture()
    Object.defineProperty(accessorRecipe.sourceNode, 'title', {
      enumerable: true,
      get() {
        reads += 1
        throw new Error('nested getter must not execute')
      },
    })
    assertInvalid(accessorRecipe)
    assert.equal(reads, 0)

    const inheritedSource = Object.create({ id: source.id }) as typeof source
    Object.assign(inheritedSource, source)
    delete (inheritedSource as { id?: string }).id
    assertInvalid({ ...validRecipeFixture(), sourceNode: inheritedSource })
  })

  test('rejects sparse arrays', () => {
    const recipe = validRecipeFixture()
    const sparseDrafts = new Array<RecipeReviewItem<ScriptSceneDraft>>(2)
    sparseDrafts[1] = sceneDraft(2)
    recipe.scene.drafts = sparseDrafts
    assertInvalid(recipe)

    const sparseCharacters = new Array<string>(2)
    sparseCharacters[1] = 'Mara'
    assertInvalid({
      ...validRecipeFixture(),
      scene: {
        ...validRecipeFixture().scene,
        drafts: [{ ...sceneDraft(), characters: sparseCharacters }],
      },
    })
  })

  test('continues rejecting undefined array entries', () => {
    const recipe = validRecipeFixture()
    recipe.scene.drafts[0]!.characters = [undefined as unknown as string]
    assertInvalid(recipe)
  })

  test('continues rejecting symbol-keyed nested objects', () => {
    const recipe = validRecipeFixture()
    recipe.sourceNode.metadataJson = { [Symbol('hidden')]: true }
    assertInvalid(recipe)
  })

  test('continues rejecting cyclic nested objects', () => {
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    const recipe = validRecipeFixture()
    recipe.sourceNode.metadataJson = cycle
    assertInvalid(recipe)
  })

  test('rejects duplicate scene, beat, and shot IDs', () => {
    const duplicateScenes = validRecipeFixture()
    duplicateScenes.scene.drafts = [sceneDraft(), { ...sceneDraft(), order: 2 }]
    assertInvalid(duplicateScenes)

    const duplicateBeats = validRecipeFixture()
    duplicateBeats.beat.drafts = [beatDraft(), { ...beatDraft(), order: 2 }]
    assertInvalid(duplicateBeats)

    const duplicateShots = validRecipeFixture()
    duplicateShots.shot.drafts = [shotDraft(), { ...shotDraft(), order: 2 }]
    assertInvalid(duplicateShots)
  })

  test('rejects more than 40 scenes', () => {
    const recipe = validRecipeFixture()
    recipe.scene.drafts = Array.from({ length: 41 }, (_, index) => sceneDraft(index + 1))
    assertInvalid(recipe)
  })

  test('rejects more than 120 beats', () => {
    const recipe = validRecipeFixture()
    recipe.beat.drafts = Array.from({ length: 121 }, (_, index) => beatDraft(index + 1))
    assertInvalid(recipe)
  })

  test('rejects more than 120 shots', () => {
    const recipe = validRecipeFixture()
    recipe.shot.drafts = Array.from({ length: 121 }, (_, index) => shotDraft(index + 1))
    assertInvalid(recipe)
  })

  test('accepts the exact scene, beat, and shot limits', () => {
    const recipe = validRecipeFixture()
    recipe.scene.drafts = Array.from({ length: 40 }, (_, index) => sceneDraft(index + 1))
    recipe.beat.drafts = Array.from({ length: 120 }, (_, index) => beatDraft(index + 1))
    recipe.shot.drafts = Array.from({ length: 120 }, (_, index) => shotDraft(index + 1))
    assert.equal(readStoryboardDirectorRecipe(metadataWith(recipe)).status, 'valid')
  })

  test('round-trips the exact receipt limit and rejects one more', () => {
    const recipe = validRecipeFixture()
    recipe.receipts = Array.from(
      { length: STORYBOARD_DIRECTOR_MAX_RECEIPTS },
      (_, index) => ({
        identity: createRecipeMaterializationIdentity(
          recipe.recipeId,
          'shot-card',
          `artifact-${index}`,
          `result-${index}`,
        ),
        kind: 'shot-card' as const,
        resultId: `result-${index}`,
        targetId: `target-${index}`,
      }),
    )
    const metadata = storyboardDirectorRecipeMetadata(recipe)
    const read = readStoryboardDirectorRecipe(metadata)
    assert.equal(read.status, 'valid')
    if (read.status === 'valid') {
      assert.equal(read.recipe.receipts.length, STORYBOARD_DIRECTOR_MAX_RECEIPTS)
      assert.deepEqual(read.recipe.receipts, recipe.receipts)
    }

    const overflow: StoryboardDirectorRecipe = {
      ...recipe,
      receipts: [...recipe.receipts, {
        identity: createRecipeMaterializationIdentity(
          recipe.recipeId,
          'shot-card',
          'artifact-overflow',
          'result-overflow',
        ),
        kind: 'shot-card',
        resultId: 'result-overflow',
        targetId: 'target-overflow',
      }],
    }
    assert.throws(() => storyboardDirectorRecipeMetadata(overflow), /receipt|limit/i)
    assert.equal(readStoryboardDirectorRecipe(metadataWith(overflow)).status, 'invalid')
  })

  test('rejects nonfinite numbers', () => {
    assertInvalid({
      ...validRecipeFixture(),
      scene: { ...validRecipeFixture().scene, generation: Number.NaN },
    })
    assertInvalid({
      ...validRecipeFixture(),
      storyboard: {
        ...validRecipeFixture().storyboard,
        shots: [{
          ...validRecipeFixture().storyboard.shots[0]!,
          durationSec: Number.POSITIVE_INFINITY,
        }],
      },
    })
  })

  test('rejects persisted identity that conflicts with the source snapshot', () => {
    assertInvalid({ ...validRecipeFixture(), recipeId: 'sdr1_00000000' })
    assertInvalid({ ...validRecipeFixture(), sourceFingerprint: 'csf1_00000000' })

    const changedSource = validRecipeFixture()
    changedSource.sourceNode.prompt = `${source.prompt}\nA siren starts.`
    assertInvalid(changedSource)
  })

  test('isolates metadata and read results from later caller mutation', () => {
    const recipe = validRecipeFixture()
    const metadata = storyboardDirectorRecipeMetadata(recipe)
    recipe.sourceNode.prompt = 'changed after write'
    recipe.scene.drafts[0]!.characters[0] = 'Changed'

    const read = readStoryboardDirectorRecipe(metadata)
    assert.equal(read.status, 'valid')
    if (read.status !== 'valid') return
    assert.equal(read.recipe.sourceNode.prompt, source.prompt)
    assert.deepEqual(read.recipe.scene.drafts[0]!.characters, ['Mara'])

    metadata.storyboardDirectorRecipe.scene.drafts[0]!.characters[0] = 'changed after read'
    assert.deepEqual(read.recipe.scene.drafts[0]!.characters, ['Mara'])
  })

  test('omits cleared optional object fields from Director-produced storyboard state', () => {
    const recipe = validRecipeFixture()
    const directorShot = addNodeToShot({
      id: 'card-director',
      index: 0,
      title: 'S01',
      nodeIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }, source.id)
    directorShot.directorNote = undefined
    directorShot.characterIds = undefined
    recipe.storyboard = {
      version: '1',
      shots: [directorShot],
      updatedAt: directorShot.updatedAt,
    }

    const metadata = storyboardDirectorRecipeMetadata(recipe)
    const storedShot = metadata.storyboardDirectorRecipe.storyboard.shots[0]!
    assert.equal(Object.hasOwn(storedShot, 'thumbnailUrl'), false)
    assert.equal(Object.hasOwn(storedShot, 'directorNote'), false)
    assert.equal(Object.hasOwn(storedShot, 'characterIds'), false)

    const read = readStoryboardDirectorRecipe(metadata)
    assert.equal(read.status, 'valid')
  })
})
