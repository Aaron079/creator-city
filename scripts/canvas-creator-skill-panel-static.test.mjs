import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'

const panelUrl = new URL(
  '../apps/web/src/components/create/canvas/skills/CreatorSkillRunPanel.tsx',
  import.meta.url,
)
const segmentationUrl = new URL(
  '../apps/web/src/components/create/canvas/skills/ScriptSegmentationPanel.tsx',
  import.meta.url,
)
const narrativeUrl = new URL(
  '../apps/web/src/components/create/canvas/skills/NarrativeBeatAnalysisPanel.tsx',
  import.meta.url,
)

const panel = readFileSync(panelUrl, 'utf8')
const segmentation = readFileSync(segmentationUrl, 'utf8')
const narrative = readFileSync(narrativeUrl, 'utf8')
const webRoot = fileURLToPath(new URL('../apps/web/', import.meta.url))
const tsx = resolve(webRoot, 'node_modules/.bin/tsx')

function assertTsxEvaluation(code) {
  const run = spawnSync(tsx, ['--eval', code], {
    cwd: webRoot,
    encoding: 'utf8',
  })
  assert.equal(run.status, 0, [run.stdout, run.stderr].filter(Boolean).join('\n'))
}

describe('Creator Skill review panel static boundary', () => {
  test('generic shell exposes the required review contract and stable controls', () => {
    assert.match(panel, /manifest:\s*CreatorSkillManifest/)
    assert.match(panel, /result:\s*CreatorSkillRunResult/)
    assert.match(panel, /canApply:\s*boolean/)
    assert.match(panel, /applyLabel:\s*string/)
    assert.match(panel, /onRerun:\s*\(\)\s*=>\s*void/)
    assert.match(panel, /onApply:\s*\(\)\s*=>\s*void/)
    assert.match(panel, /onClose:\s*\(\)\s*=>\s*void/)
    assert.match(panel, /children:\s*React\.ReactNode/)

    for (const testId of [
      'creator-skill-panel',
      'creator-skill-status',
      'creator-skill-rerun',
      'creator-skill-apply',
      'creator-skill-close',
    ]) {
      assert.match(panel, new RegExp(`data-testid=["']${testId}["']`))
    }
  })

  test('generic shell renders manifest identity and every result review channel', () => {
    assert.match(panel, /manifest\.name/)
    assert.match(panel, /manifest\.version/)
    assert.match(panel, /result\.status/)
    assert.match(panel, /result\.warnings\.map/)
    assert.match(panel, /result\.blockers\.map/)
    assert.match(panel, /result\.evidence\.map/)
    assert.match(panel, /evidence\.excerpt/)
  })

  test('generic apply control reflects the canApply disabled state', () => {
    const applyControl = panel
      .match(/<button\b[^>]*>/gs)
      ?.find((tag) => /data-testid=["']creator-skill-apply["']/.test(tag))

    assert.ok(applyControl, 'generic apply control should exist')
    assert.match(applyControl, /disabled=\{!canApply\}/)
  })

  test('generic modal focus is mount-stable and contains Tab navigation', () => {
    assert.match(panel, /const onCloseRef = useRef\(onClose\)/)
    assert.match(panel, /onCloseRef\.current = onClose/)
    assert.match(panel, /event\.key === ['"]Escape['"][\s\S]*onCloseRef\.current\(\)/)
    assert.match(panel, /event\.key\s*(?:===|!==)\s*['"]Tab['"]/)
    assert.match(panel, /event\.shiftKey/)
    assert.match(panel, /event\.preventDefault\(\)/)
    assert.match(
      panel,
      /useEffect\(\(\) => \{[\s\S]*document\.addEventListener\(['"]keydown['"][\s\S]*\}, \[\]\)/,
    )
    assert.doesNotMatch(panel, /\}, \[onClose\]\)/)
  })

  test('generic modal preserves reviews during IME composition and consumes dismissal Escape', () => {
    assert.match(
      panel,
      /event\.key === ['"]Escape['"]\)\s*\{\s*if \(event\.isComposing\) return[\s\S]{0,200}?event\.preventDefault\(\)[\s\S]{0,100}?event\.stopPropagation\(\)[\s\S]{0,100}?onCloseRef\.current\(\)/,
    )
  })

  test('generic result lists use collision-safe indexed React keys', () => {
    assert.match(
      panel,
      /result\.blockers\.map\(\(blocker,\s*index\)[\s\S]{0,500}?key=\{[^}]*index[^}]*\}/,
    )
    assert.match(
      panel,
      /result\.warnings\.map\(\(warning,\s*index\)[\s\S]{0,500}?key=\{[^}]*index[^}]*\}/,
    )
    assert.match(
      panel,
      /result\.evidence\.map\(\(evidence,\s*index\)[\s\S]{0,500}?key=\{[^}]*index[^}]*\}/,
    )
    assert.match(
      segmentation,
      /sceneEvidence\.map\(\(evidence,\s*index\)[\s\S]{0,500}?key=\{[^}]*index[^}]*\}/,
    )
  })

  test('stale source reset preserves equal reviews and clears changed-source state', () => {
    assertTsxEvaluation(`
      import assert from 'node:assert/strict'
      import {
        createScriptSegmentationPanelState,
        resetScriptSegmentationPanelStateForSource,
      } from './src/components/create/canvas/skills/ScriptSegmentationPanel'

      const source = {
        id: 'source-1',
        kind: 'text',
        title: 'Original title',
        prompt: 'INT. ROOM - DAY\\nMAYA\\nWe begin here.',
      }
      const dirty = createScriptSegmentationPanelState(source)
      dirty.review.drafts[0].approved = true
      dirty.duplicateSceneIds = ['scene-001']
      dirty.applyError = 'old error'
      dirty.applyLocked = true

      const equalSource = {
        ...source,
        title: 'Unrelated title change',
        metadataJson: { rerender: true },
      }
      assert.equal(
        resetScriptSegmentationPanelStateForSource(dirty, equalSource),
        dirty,
      )

      for (const changedSource of [
        { ...source, id: 'source-2' },
        { ...source, prompt: source.prompt + '\\nA changed ending.' },
      ]) {
        const reset = resetScriptSegmentationPanelStateForSource(dirty, changedSource)
        assert.notEqual(reset, dirty)
        assert.notEqual(reset.review, dirty.review)
        assert.ok(reset.review.drafts.every((scene) => scene.approved === false))
        assert.deepEqual(reset.duplicateSceneIds, [])
        assert.equal(reset.applyError, '')
        assert.equal(reset.applyLocked, false)
      }
    `)

    assert.match(
      segmentation,
      /useEffect\(\(\) => \{[\s\S]{0,400}resetScriptSegmentationPanelStateForSource\([\s\S]{0,200}latestSourceNodeRef\.current[\s\S]{0,100}\}, \[incomingSourceIdentity\]\)/,
    )
    assert.match(segmentation, /sourceIsCurrent/)
  })

  test('application boundary skips empty plans and locks truthful callback failures', () => {
    assertTsxEvaluation(`
      import assert from 'node:assert/strict'
      import {
        applyScriptSegmentationPlans,
        SCRIPT_SEGMENTATION_PLANNING_ERROR,
        SCRIPT_SEGMENTATION_PARTIAL_APPLY_ERROR,
      } from './src/components/create/canvas/skills/ScriptSegmentationPanel'

      let calls = 0
      const duplicatesOnly = applyScriptSegmentationPlans([], () => { calls += 1 })
      assert.equal(calls, 0)
      assert.equal(duplicatesOnly.applyLocked, false)
      assert.equal(duplicatesOnly.error, '')

      const plans = [{ resultId: 'scene-001' }]
      const failed = applyScriptSegmentationPlans(plans, () => {
        calls += 1
        throw new Error('partial creation')
      })
      assert.equal(calls, 1)
      assert.equal(failed.applyLocked, true)
      assert.equal(failed.error, SCRIPT_SEGMENTATION_PARTIAL_APPLY_ERROR)
      assert.match(failed.error, /部分/)
      assert.match(failed.error, /检查/)
      assert.doesNotMatch(failed.error, /重新运行|重跑/)
      assert.match(SCRIPT_SEGMENTATION_PLANNING_ERROR, /规划/)
      assert.doesNotMatch(SCRIPT_SEGMENTATION_PLANNING_ERROR, /部分/)
    `)

    assert.match(segmentation, /SCRIPT_SEGMENTATION_PLANNING_ERROR/)
    assert.match(
      segmentation,
      /catch\s*\{[\s\S]{0,240}SCRIPT_SEGMENTATION_PLANNING_ERROR/,
    )
    assert.match(segmentation, /applyScriptSegmentationPlans\(planned\.create,\s*onApply\)/)
    assert.match(segmentation, /applyLocked:\s*outcome\.applyLocked/)
    assert.match(segmentation, /const canApply =[\s\S]{0,240}&& !applyLocked/)
  })

  test('segmentation runs locally from a fresh source snapshot on open and rerun', () => {
    assert.match(segmentation, /import\s+\{[^}]*runCreatorSkill[^}]*\}\s+from\s+['"]@\/lib\/skills['"]/s)
    assert.match(
      segmentation,
      /export function runScriptSegmentationReview\(\s*sourceNode:\s*CreatorSkillSourceNode/,
    )
    assert.match(
      segmentation,
      /runCreatorSkill\(\s*['"]script-segmentation['"]\s*,\s*\{\s*sourceNodes:\s*\[[^\]]+\]/s,
    )
    assert.doesNotMatch(segmentation, /sourceNodes:\s*\[sourceNode\]/)
    assert.ok(
      segmentation.match(/createScriptSegmentationPanelState\(sourceNode\)/g)?.length >= 2,
      'the component should create a review batch on open and on explicit rerun',
    )
  })

  test('segmentation narrows the Artifact and keeps review state local and unapproved', () => {
    assert.match(segmentation, /artifactType\s*!==\s*['"]scene-breakdown['"]/)
    assert.match(segmentation, /artifactVersion\s*!==\s*1/)
    assert.match(segmentation, /approved:\s*false/)
    assert.match(segmentation, /field:\s*['"]heading['"]\s*\|\s*['"]sourceText['"]/)
    assert.match(segmentation, /data-testid=["']script-segmentation-scene-list["']/)
    assert.match(segmentation, /data-testid=["']script-segmentation-scene-checkbox["']/)
    assert.match(segmentation, /scene\.lineStart/)
    assert.match(segmentation, /scene\.lineEnd/)
    assert.match(segmentation, /evidence\.excerpt/)
  })

  test('apply is approval-gated and materializes only exact-batch create plans', () => {
    assert.match(segmentation, /result\.status\s*!==\s*['"]blocked['"]/)
    assert.match(segmentation, /approvedCount\s*>\s*0/)
    assert.match(segmentation, /canApply=\{canApply\}/)
    assert.match(segmentation, /planScriptSceneMaterialization\(\{/)
    assert.match(
      segmentation,
      /approvalContext:\s*\{\s*runFingerprint:\s*result\.runFingerprint,\s*sourceArtifactId:\s*artifact\.artifactId,?\s*\}/s,
    )
    assert.match(segmentation, /approvedScenes/)
    assert.match(segmentation, /existingNodes/)
    assert.match(segmentation, /planned\.duplicates/)
    assert.match(segmentation, /data-testid=["']script-segmentation-duplicates["']/)
    assert.match(segmentation, /onApply\(plans\)/)
    assert.doesNotMatch(segmentation, /onApply\(planned\)/)
  })

  test('review panels remain independent of remote generation and legacy skills', () => {
    const source = `${panel}\n${segmentation}\n${narrative}`
    assert.doesNotMatch(source, /fetch\s*\(/)
    assert.doesNotMatch(source, /\/api\/generate\//i)
    assert.doesNotMatch(source, /\bProvider\b/)
    assert.doesNotMatch(source, /billing|credits|wallet|payment|recharge|checkout/i)
    assert.doesNotMatch(source, /@\/lib\/ai\/skills|apps\/web\/src\/lib\/ai\/skills/)
  })

  test('narrative review state starts pending and edits decisions and order immutably', () => {
    assertTsxEvaluation(`
      import assert from 'node:assert/strict'
      import {
        createNarrativeBeatPanelState,
        moveNarrativeBeatDraft,
        removeNarrativeBeatDraft,
        setNarrativeBeatDecision,
        updateNarrativeBeatDraft,
      } from './src/components/create/canvas/skills/NarrativeBeatAnalysisPanel'

      const source = {
        id: 'source-1',
        kind: 'text',
        title: 'Scene',
        prompt: 'Maya enters the room. She wants the sealed letter. The lights fail.',
      }
      const initial = createNarrativeBeatPanelState(source)
      assert.ok(initial.review.drafts.length >= 2)
      assert.ok(initial.review.drafts.every((beat) => beat.decision === 'pending'))
      assert.deepEqual(initial.removedBeatIds, [])

      const firstId = initial.review.drafts[0].beatId
      const secondId = initial.review.drafts[1].beatId
      const edited = updateNarrativeBeatDraft(
        initial.review.drafts,
        firstId,
        { summary: 'Maya crosses the threshold.', type: 'action' },
      )
      assert.notEqual(edited, initial.review.drafts)
      assert.notEqual(edited[0], initial.review.drafts[0])
      assert.equal(initial.review.drafts[0].summary === 'Maya crosses the threshold.', false)
      assert.equal(edited[0].summary, 'Maya crosses the threshold.')
      assert.equal(edited[0].type, 'action')

      const approved = setNarrativeBeatDecision(edited, firstId, 'approved')
      const rejected = setNarrativeBeatDecision(approved, secondId, 'rejected')
      assert.equal(approved[0].decision, 'approved')
      assert.equal(rejected[1].decision, 'rejected')
      assert.equal(edited[0].decision, 'pending')

      const moved = moveNarrativeBeatDraft(rejected, secondId, -1)
      assert.notEqual(moved, rejected)
      assert.equal(moved[0].beatId, secondId)
      assert.equal(rejected[0].beatId, firstId)
      assert.equal(moveNarrativeBeatDraft(moved, secondId, -1), moved)

      const removed = removeNarrativeBeatDraft(initial, firstId)
      assert.notEqual(removed, initial)
      assert.equal(removed.review.drafts.some((beat) => beat.beatId === firstId), false)
      assert.deepEqual(removed.removedBeatIds, [firstId])
      assert.equal(removed.review.drafts.some((beat) => beat.decision === 'rejected'), false)
      assert.equal(initial.removedBeatIds.length, 0)
    `)
  })

  test('narrative source reset preserves equal dirty reviews and resets changed effective text', () => {
    assertTsxEvaluation(`
      import assert from 'node:assert/strict'
      import {
        createNarrativeBeatPanelState,
        canApplyNarrativeBeatReview,
        getNarrativeBeatSourceIdentity,
        resetNarrativeBeatPanelStateForSource,
        setNarrativeBeatDecision,
      } from './src/components/create/canvas/skills/NarrativeBeatAnalysisPanel'

      const source = {
        id: 'source-1',
        kind: 'text',
        title: 'Scene',
        prompt: 'Maya enters the room. She wants the sealed letter. The lights fail.',
      }
      const state = createNarrativeBeatPanelState(source)
      const firstId = state.review.drafts[0].beatId
      const dirty = {
        ...state,
        review: {
          ...state.review,
          drafts: setNarrativeBeatDecision(state.review.drafts, firstId, 'approved'),
        },
        duplicateSceneIds: ['scene-001'],
        applyError: 'old error',
        applyLocked: true,
      }
      const equal = { ...source, title: 'Renamed', metadataJson: { rerender: true } }
      assert.equal(getNarrativeBeatSourceIdentity(equal), getNarrativeBeatSourceIdentity(source))
      assert.equal(resetNarrativeBeatPanelStateForSource(dirty, equal), dirty)

      const applicable = {
        ...state,
        review: {
          ...state.review,
          drafts: setNarrativeBeatDecision(state.review.drafts, firstId, 'approved'),
        },
      }
      assert.equal(canApplyNarrativeBeatReview(applicable, source), true)
      assert.equal(canApplyNarrativeBeatReview(applicable, {
        ...source,
        prompt: source.prompt + ' Maya turns back.',
      }), false)

      for (const changed of [
        { ...source, id: 'source-2' },
        { ...source, prompt: source.prompt + ' Maya turns back.' },
        { ...source, resultText: source.prompt + ' The door opens.' },
      ]) {
        const reset = resetNarrativeBeatPanelStateForSource(dirty, changed)
        assert.notEqual(reset, dirty)
        assert.ok(reset.review.drafts.every((beat) => beat.decision === 'pending'))
        assert.deepEqual(reset.removedBeatIds, [])
        assert.deepEqual(reset.duplicateSceneIds, [])
        assert.equal(reset.applyError, '')
        assert.equal(reset.applyLocked, false)
      }
    `)

    assert.match(narrative, /sourceIsCurrent/)
    assert.match(narrative, /canApplyNarrativeBeatReview/)
  })

  test('narrative Artifact handling falls back only when absent and blocks invalid metadata', () => {
    assertTsxEvaluation(`
      import assert from 'node:assert/strict'
      import {
        createNarrativeBeatPanelState,
      } from './src/components/create/canvas/skills/NarrativeBeatAnalysisPanel'
      import { runCreatorSkill } from './src/lib/skills'

      const base = {
        id: 'source-1',
        kind: 'text',
        title: 'Scene',
        prompt: 'Maya enters the room. She wants the sealed letter. The lights fail.',
      }
      const fallback = createNarrativeBeatPanelState(base)
      assert.equal(fallback.review.approvedArtifactStatus, 'absent')
      assert.ok(fallback.review.result.artifacts.length > 0)

      const invalid = createNarrativeBeatPanelState({
        ...base,
        metadataJson: { creatorSkill: { approvedArtifact: { artifactId: '' } } },
      })
      assert.equal(invalid.review.approvedArtifactStatus, 'invalid')
      assert.equal(invalid.review.displayResult.status, 'blocked')
      assert.ok(invalid.review.displayResult.blockers.some(
        (blocker) => blocker.code === 'APPROVED_ARTIFACT_INVALID',
      ))
      assert.equal(invalid.review.result.artifacts.length, 0)
      assert.equal(invalid.review.drafts.length, 0)

      const segmented = runCreatorSkill('script-segmentation', {
        sourceNodes: [base],
      })
      const approvedArtifact = segmented.artifacts[0]
      const valid = createNarrativeBeatPanelState({
        ...base,
        metadataJson: { creatorSkill: { approvedArtifact } },
      })
      assert.equal(valid.review.approvedArtifactStatus, 'valid')
      assert.notEqual(valid.review.result.status, 'blocked')
      assert.deepEqual(
        valid.review.result.artifacts[0].sourceArtifactIds,
        [approvedArtifact.artifactId],
      )
    `)

    assert.match(narrative, /readApprovedCreatorSkillArtifact/)
    assert.match(
      narrative,
      /runCreatorSkill\(\s*['"]narrative-beat-analysis['"]\s*,\s*\{\s*sourceNodes:\s*\[[^\]]+\][\s\S]{0,220}artifacts:\s*\[approvedSceneArtifact\]/,
    )
    assert.match(narrative, /APPROVED_ARTIFACT_INVALID/)
  })

  test('narrative materialization keeps only approvals and callback failures lock the batch', () => {
    assertTsxEvaluation(`
      import assert from 'node:assert/strict'
      import {
        applyNarrativeBeatPlans,
        approvedNarrativeBeatScenes,
        createNarrativeBeatPanelState,
        NARRATIVE_BEAT_PARTIAL_APPLY_ERROR,
        setNarrativeBeatDecision,
      } from './src/components/create/canvas/skills/NarrativeBeatAnalysisPanel'

      const state = createNarrativeBeatPanelState({
        id: 'source-1',
        kind: 'text',
        title: 'Scene',
        prompt: 'Maya enters the room. She wants the sealed letter. The lights fail.',
      })
      const [first, second] = state.review.drafts
      const decided = setNarrativeBeatDecision(
        setNarrativeBeatDecision(state.review.drafts, first.beatId, 'approved'),
        second.beatId,
        'rejected',
      )
      const scenes = approvedNarrativeBeatScenes(decided, state.review.artifact)
      assert.equal(scenes.length, 1)
      assert.deepEqual(scenes[0].beats.map((beat) => beat.beatId), [first.beatId])
      assert.equal(decided.find((beat) => beat.beatId === second.beatId).decision, 'rejected')

      let calls = 0
      assert.deepEqual(applyNarrativeBeatPlans([], () => { calls += 1 }), {
        error: '',
        applyLocked: false,
      })
      assert.equal(calls, 0)
      const failed = applyNarrativeBeatPlans([{ resultId: 'scene-001' }], () => {
        calls += 1
        throw new Error('partial')
      })
      assert.equal(calls, 1)
      assert.equal(failed.applyLocked, true)
      assert.equal(failed.error, NARRATIVE_BEAT_PARTIAL_APPLY_ERROR)
      assert.match(failed.error, /部分/)
      assert.match(failed.error, /检查/)
      assert.doesNotMatch(failed.error, /重新运行|重跑/)
    `)
  })

  test('narrative panel exposes grouped review controls and truthful feedback', () => {
    assert.match(narrative, /CreatorSkillRunPanel/)
    assert.match(narrative, /NARRATIVE_BEAT_ANALYSIS_MANIFEST/)
    assert.match(narrative, /data-testid=["']narrative-beat-scene-list["']/)
    assert.match(narrative, /data-testid=["']narrative-beat-decision["']/)
    assert.match(narrative, /data-testid=["']narrative-beat-duplicates["']/)
    assert.match(narrative, /<select/)
    assert.match(narrative, /<input/)
    assert.match(narrative, /ArrowUp/)
    assert.match(narrative, /ArrowDown/)
    assert.match(narrative, /Trash2/)
    for (const title of ['上移', '下移', '移除']) {
      assert.match(narrative, new RegExp(`title=["']${title}["']`))
    }
    assert.match(narrative, /创建叙事节拍节点 \(\$\{approvedCount\}\)/)
    assert.match(narrative, /planNarrativeBeatMaterialization\(\{/)
    assert.match(narrative, /planned\.duplicates/)
    assert.match(narrative, /decision\s*===\s*['"]approved['"]/)
    assert.match(narrative, /lineStart/)
    assert.match(narrative, /evidence\.excerpt/)
  })
})
