/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/ShotListBuilderPanel.test.tsx
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { runCreatorSkill } from '../../lib/skills'
import {
  approvedShotPlanScenes,
  buildShotReviewReport,
  canCopyShotReview,
  createApprovedShotDrafts,
  createShotOperationToken,
  createShotListPanelState,
  getShotListSourceIdentity,
  isShotOperationTokenCurrent,
  moveShotReviewDraft,
  removeShotReviewDraft,
  rerunShotListPanelState,
  setShotReviewDecision,
  updateShotReviewDraft,
  type ShotReviewDraft,
} from './ShotListBuilderPanel'

const OPTIONS = {
  requestedShotCount: 5,
  outputMode: 'mixed' as const,
  pacing: 'standard' as const,
  shotSizeStrategy: 'auto' as const,
  userInstruction: '',
}

const SOURCE = {
  id: 'source-1',
  kind: 'text' as const,
  title: 'Scene',
  prompt: 'Maya enters the ruined hall. She sees the sealed letter. She gasps and steps back.',
}

function state() {
  return createShotListPanelState(SOURCE, SOURCE.prompt, OPTIONS)
}

describe('ShotListBuilderPanel Stage B boundaries', () => {
  test('opening runs public shot-planning and initializes every decision pending', () => {
    const current = state()
    assert.equal(current.review.result.skillId, 'shot-planning')
    assert.notEqual(current.review.result.status, 'blocked')
    assert.ok(current.review.drafts.length > 0)
    assert.ok(current.review.drafts.every((shot) => shot.decision === 'pending'))
  })

  test('rerun creates a fresh deterministic review and clears transient state', () => {
    const current = state()
    const first = current.review.drafts[0]!
    const dirty = {
      ...current,
      review: {
        ...current.review,
        drafts: setShotReviewDecision(current.review.drafts, first.shotId, 'approved'),
      },
      duplicateSceneIds: ['scene-001'],
      duplicateShotIds: ['scene-001-shot-001'],
      applyError: 'old',
      applyLocked: true,
    }
    const next = rerunShotListPanelState(SOURCE, SOURCE.prompt, OPTIONS)
    assert.deepEqual(next, current)
    assert.notEqual(next, dirty)
    assert.ok(next.review.drafts.every((shot) => shot.decision === 'pending'))
  })

  test('valid current approved Artifact is used by the public Skill boundary', () => {
    const narrative = runCreatorSkill('narrative-beat-analysis', {
      sourceNodes: [SOURCE],
    })
    const approvedArtifact = narrative.artifacts[0]!
    const current = createShotListPanelState({
      ...SOURCE,
      metadataJson: { creatorSkill: { approvedArtifact } },
    }, SOURCE.prompt, OPTIONS)

    assert.equal(current.review.approvedArtifactStatus, 'valid')
    assert.deepEqual(
      current.review.result.artifacts[0]?.sourceArtifactIds,
      [approvedArtifact.artifactId],
    )
  })

  test('materialized Narrative Beats carrier uses canonical Artifact text for handoff', () => {
    const narrative = runCreatorSkill('narrative-beat-analysis', {
      sourceNodes: [SOURCE],
    })
    const approvedArtifact = narrative.artifacts[0]!
    const scene = (approvedArtifact.payload as {
      scenes: Array<{
        order: number
        heading: string
        beats: Array<{ type: string; summary: string; sourceText: string }>
      }>
    }).scenes[0]!
    const carrierPrompt = [
      `Scene: ${scene.heading || `Scene ${scene.order}`}`,
      ...scene.beats.flatMap((beat, index) => [
        '',
        `Beat ${index + 1}`,
        `Type: ${beat.type}`,
        `Summary: ${beat.summary}`,
        `Source: ${beat.sourceText}`,
      ]),
    ].join('\n')
    const carrier = {
      ...SOURCE,
      id: 'narrative-carrier',
      title: 'Scene 1 · Narrative Beats',
      prompt: carrierPrompt,
      metadataJson: { creatorSkill: { approvedArtifact } },
    }
    const current = createShotListPanelState(carrier, carrier.prompt, OPTIONS)

    assert.equal(current.review.approvedArtifactStatus, 'valid')
    assert.notEqual(current.review.result.status, 'blocked')
    assert.deepEqual(
      current.review.result.artifacts[0]?.sourceArtifactIds,
      [approvedArtifact.artifactId],
    )
    assert.deepEqual(
      current.review.result.artifacts[0]?.sourceNodeIds,
      [carrier.id],
    )

    const tamperedPrompt = carrierPrompt.replace('Summary: ', 'Summary: changed ')
    const tampered = createShotListPanelState({
      ...carrier,
      prompt: tamperedPrompt,
    }, tamperedPrompt, OPTIONS)
    assert.equal(tampered.review.result.status, 'blocked')
    assert.ok(tampered.review.result.blockers.some(
      (blocker) => blocker.code === 'SHOT_SOURCE_CONFLICT',
    ))
  })

  test('edited source draft runs Text-only without a stale approved Artifact', () => {
    const narrative = runCreatorSkill('narrative-beat-analysis', {
      sourceNodes: [SOURCE],
    })
    const current = createShotListPanelState({
      ...SOURCE,
      metadataJson: {
        creatorSkill: { approvedArtifact: narrative.artifacts[0]! },
      },
    }, `${SOURCE.prompt} A door slams.`, OPTIONS)

    assert.equal(current.review.approvedArtifactStatus, 'valid-unused-edited')
    assert.deepEqual(current.review.result.artifacts[0]?.sourceArtifactIds, [])
  })

  test('malformed present approved Artifact blocks without Text fallback', () => {
    const current = createShotListPanelState({
      ...SOURCE,
      metadataJson: { creatorSkill: { approvedArtifact: { artifactId: '' } } },
    }, `${SOURCE.prompt} Edited.`, OPTIONS)

    assert.equal(current.review.approvedArtifactStatus, 'invalid')
    assert.equal(current.review.displayResult.status, 'blocked')
    assert.equal(current.review.result.artifacts.length, 0)
    assert.ok(current.review.displayResult.blockers.some(
      (blocker) => blocker.code === 'APPROVED_ARTIFACT_INVALID',
    ))
  })

  test('edit, decision, order, and removal helpers are immutable', () => {
    const current = state()
    const [first, second] = current.review.drafts
    assert.ok(first && second)

    const edited = updateShotReviewDraft(current.review.drafts, first.shotId, {
      objective: 'Edited objective',
      suggestedShotSize: 'close',
      outputKind: 'video',
      duration: 10,
    })
    assert.notEqual(edited, current.review.drafts)
    assert.equal(edited[0]?.objective, 'Edited objective')
    assert.notEqual(current.review.drafts[0]?.objective, 'Edited objective')

    const approved = setShotReviewDecision(edited, first.shotId, 'approved')
    const rejected = setShotReviewDecision(approved, second.shotId, 'rejected')
    assert.equal(approved[0]?.decision, 'approved')
    assert.equal(rejected[1]?.decision, 'rejected')

    const moved = moveShotReviewDraft(rejected, second.shotId, -1)
    assert.equal(moved[0]?.shotId, second.shotId)
    assert.equal(rejected[0]?.shotId, first.shotId)

    const removed = removeShotReviewDraft(moved, second.shotId)
    assert.equal(removed.length, moved.length - 1)
    assert.equal(moved.length, rejected.length)
  })

  test('ordering cannot move a shot across scene boundaries', () => {
    const first: ShotReviewDraft = {
      ...state().review.drafts[0]!,
      sceneId: 'scene-001',
    }
    const second: ShotReviewDraft = {
      ...first,
      shotId: 'scene-002-shot-001',
      sceneId: 'scene-002',
    }
    const drafts = [first, second]
    assert.equal(moveShotReviewDraft(drafts, second.shotId, -1), drafts)
  })

  test('grouped materialization input contains approved shots only in reviewed order', () => {
    const current = state()
    const [first, second, third] = current.review.drafts
    assert.ok(first && second && third)
    const decided = setShotReviewDecision(
      setShotReviewDecision(current.review.drafts, first.shotId, 'approved'),
      second.shotId,
      'rejected',
    )
    const reviewed = moveShotReviewDraft(
      moveShotReviewDraft(decided, third.shotId, -1),
      third.shotId,
      -1,
    )
    const approved = setShotReviewDecision(reviewed, third.shotId, 'approved')
    const scenes = approvedShotPlanScenes(approved, current.review.artifact)
    assert.deepEqual(
      scenes.flatMap((scene) => scene.shots.map((shot) => shot.shotId)),
      [third.shotId, first.shotId],
    )
    assert.ok(scenes.every((scene) => (
      scene.shots.every((shot) => shot.reviewStatus === 'approved')
    )))
  })

  test('compatibility creation receives approved nonduplicates only', async () => {
    const current = state()
    const [first, second, third] = current.review.drafts
    assert.ok(first && second && third)
    const reviewed = setShotReviewDecision(
      setShotReviewDecision(
        setShotReviewDecision(current.review.drafts, first.shotId, 'approved'),
        second.shotId,
        'approved',
      ),
      third.shotId,
      'rejected',
    )
    const calls: string[] = []
    const outcome = await createApprovedShotDrafts({
      drafts: reviewed,
      result: current.review.result,
      sourceNodeId: SOURCE.id,
      duplicateShotIds: [second.shotId],
      onCreateNode: (_kind, options) => {
        calls.push(options.metadataJson.creatorSkill.resultId)
        return `node-${calls.length}`
      },
    })

    assert.deepEqual(calls, [first.shotId])
    assert.deepEqual(outcome.createdIds, ['node-1'])
    assert.deepEqual(outcome.duplicateShotIds, [second.shotId])
    assert.equal(outcome.applyLocked, false)
  })

  test('compatibility metadata preserves reviewed kind, shot identity, and 5 or 10 second duration', async () => {
    const current = state()
    const [first, second] = current.review.drafts
    assert.ok(first && second)
    const edited = updateShotReviewDraft(
      updateShotReviewDraft(current.review.drafts, first.shotId, {
        outputKind: 'image',
        duration: 5,
      }),
      second.shotId,
      {
        outputKind: 'video',
        duration: 10,
      },
    )
    const reviewed = setShotReviewDecision(
      setShotReviewDecision(edited, first.shotId, 'approved'),
      second.shotId,
      'approved',
    )
    const calls: Array<{
      kind: string
      metadata: Record<string, unknown>
      creatorSkill: Record<string, unknown>
    }> = []

    await createApprovedShotDrafts({
      drafts: reviewed,
      result: current.review.result,
      sourceNodeId: SOURCE.id,
      duplicateShotIds: [],
      onCreateNode: (kind, options) => {
        const metadata = options.metadataJson as unknown as Record<string, unknown>
        calls.push({
          kind,
          metadata,
          creatorSkill: metadata.creatorSkill as Record<string, unknown>,
        })
        return `node-${calls.length}`
      },
    })

    assert.deepEqual(calls.map(({ kind, metadata, creatorSkill }) => ({
      kind,
      duration: metadata.duration,
      outputKind: metadata.outputKind,
      shotId: metadata.shotId,
      runFingerprint: creatorSkill.runFingerprint,
    })), [
      {
        kind: 'image',
        duration: 5,
        outputKind: 'image',
        shotId: first.shotId,
        runFingerprint: current.review.result.runFingerprint,
      },
      {
        kind: 'video',
        duration: 10,
        outputKind: 'video',
        shotId: second.shotId,
        runFingerprint: current.review.result.runFingerprint,
      },
    ])
  })

  test('a completed local create batch prevents an immediate duplicate create', async () => {
    const current = state()
    const first = current.review.drafts[0]!
    const reviewed = setShotReviewDecision(
      current.review.drafts,
      first.shotId,
      'approved',
    )
    let calls = 0
    const create = async (duplicateShotIds: string[]) => createApprovedShotDrafts({
      drafts: reviewed,
      result: current.review.result,
      sourceNodeId: SOURCE.id,
      duplicateShotIds,
      onCreateNode: () => {
        calls += 1
        return `node-${calls}`
      },
    })

    const firstOutcome = await create([])
    assert.deepEqual(firstOutcome.createdShotIds, [first.shotId])
    const secondOutcome = await create(firstOutcome.createdShotIds)
    assert.equal(calls, 1)
    assert.deepEqual(secondOutcome.createdIds, [])
    assert.deepEqual(secondOutcome.duplicateShotIds, [first.shotId])
  })

  test('generation callback receives only IDs from that exact confirmed create operation', async () => {
    const current = state()
    const [first, second] = current.review.drafts
    assert.ok(first && second)
    const reviewed = setShotReviewDecision(
      setShotReviewDecision(current.review.drafts, first.shotId, 'approved'),
      second.shotId,
      'approved',
    )
    const generated: string[][] = []
    const outcome = await createApprovedShotDrafts({
      drafts: reviewed,
      result: current.review.result,
      sourceNodeId: SOURCE.id,
      duplicateShotIds: [first.shotId],
      onCreateNode: (_kind, options) => (
        options.metadataJson.creatorSkill.resultId === second.shotId
          ? 'new-node-2'
          : ''
      ),
    })
    if (outcome.createdIds.length > 0) generated.push(outcome.createdIds)

    assert.deepEqual(outcome.createdIds, ['new-node-2'])
    assert.deepEqual(generated, [['new-node-2']])
  })

  test('async partial callback failure reports actual IDs and locks the batch', async () => {
    const current = state()
    const [first, second] = current.review.drafts
    assert.ok(first && second)
    const reviewed = setShotReviewDecision(
      setShotReviewDecision(current.review.drafts, first.shotId, 'approved'),
      second.shotId,
      'approved',
    )
    let calls = 0
    const outcome = await createApprovedShotDrafts({
      drafts: reviewed,
      result: current.review.result,
      sourceNodeId: SOURCE.id,
      duplicateShotIds: [],
      onCreateNode: async () => {
        calls += 1
        if (calls === 2) throw new Error('partial')
        return 'new-node-1'
      },
    })

    assert.deepEqual(outcome.createdIds, ['new-node-1'])
    assert.equal(outcome.applyLocked, true)
    assert.match(outcome.error, /部分|检查/)
    assert.doesNotMatch(outcome.error, /重试|重新运行/)
  })

  test('source identity changes with effective draft or source Artifact', () => {
    const base = getShotListSourceIdentity(SOURCE, SOURCE.prompt, OPTIONS)
    assert.notEqual(
      getShotListSourceIdentity(SOURCE, `${SOURCE.prompt} changed`, OPTIONS),
      base,
    )
    assert.notEqual(
      getShotListSourceIdentity(SOURCE, SOURCE.prompt, {
        ...OPTIONS,
        requestedShotCount: 8,
      }),
      base,
    )
  })

  test('source identity changes when the live selected node text changes externally', () => {
    const current = state()
    const externallyChanged = {
      ...SOURCE,
      prompt: `${SOURCE.prompt} External update.`,
    }

    assert.notEqual(
      getShotListSourceIdentity(externallyChanged, SOURCE.prompt, OPTIONS),
      current.review.sourceIdentity,
    )
  })

  test('deferred operation completion is rejected after source, settings, rerun, or operation changes', async () => {
    const current = state()
    const token = createShotOperationToken(current.review, 1, 7)
    let context = {
      sourceIdentity: current.review.sourceIdentity,
      runFingerprint: current.review.result.runFingerprint,
      reviewGeneration: 1,
      operationId: 7,
    }
    let resolveDeferred!: (value: string) => void
    const deferred = new Promise<string>((resolve) => {
      resolveDeferred = resolve
    })
    const committed = deferred.then((value) => (
      isShotOperationTokenCurrent(token, context) ? value : null
    ))

    context = { ...context, reviewGeneration: 2 }
    resolveDeferred('old completion')
    assert.equal(await committed, null)

    for (const staleContext of [
      { ...context, reviewGeneration: 1, sourceIdentity: `${context.sourceIdentity}:edited` },
      { ...context, reviewGeneration: 1, runFingerprint: 'csf1_deadbeef' },
      { ...context, reviewGeneration: 1, operationId: 8 },
    ]) {
      assert.equal(isShotOperationTokenCurrent(token, staleContext), false)
    }
    assert.equal(isShotOperationTokenCurrent(token, {
      ...context,
      reviewGeneration: 1,
    }), true)
  })

  test('copy is stale-gated and reports only the analyzed review snapshot', () => {
    const current = state()
    const first = current.review.drafts[0]!
    const review = {
      ...current.review,
      drafts: setShotReviewDecision(
        current.review.drafts,
        first.shotId,
        'approved',
      ),
    }
    assert.equal(
      canCopyShotReview(review, review.sourceIdentity),
      true,
    )
    assert.equal(
      canCopyShotReview(review, `${review.sourceIdentity}:stale`),
      false,
    )

    const report = buildShotReviewReport(review)
    assert.match(report, new RegExp(SOURCE.prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.doesNotMatch(report, /unmatched current draft/i)
    assert.match(report, /图片\+视频混合 · 标准叙事 · 自动景别/)
  })
})
