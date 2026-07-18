/**
 * Pure state and action tests for the Storyboard Director workspace.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/StoryboardDirectorPanel.test.tsx
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'
import { runCreatorSkill, type CreatorSkillReviewStatus } from '../../lib/skills'
import type { StoryboardState } from '../../lib/storyboard/types'
import { analyzeStoryboardDirectorRecipe } from '../../lib/storyboard/recipe/intelligence'
import {
  approveBeatStage,
  approveSceneStage,
  approveShotStage,
  changeImpactForStage,
  createStoryboardDirectorRecipe,
  invalidateRecipeAfter,
  setRecipeDecision,
  updateRecipeDraft,
} from '../../lib/storyboard/recipe/state-machine'
import type {
  StoryboardDirectorFinding,
  StoryboardDirectorRecipe,
  StoryboardDirectorStageId,
} from '../../lib/storyboard/recipe/types'
import {
  createStoryboardDirectorPanelState,
  deriveStoryboardDirectorShotRecipeMarkers,
  findStoryboardDirectorRecipeControl,
  patchStoryboardDirectorShot,
  selectStoryboardDirectorTab,
} from './StoryboardDirectorPanel'
import {
  approveActiveRecipeStage,
  batchDecideRecipeScene,
  canImportLegacyDirectorState,
  createRecipeFieldDraft,
  finishRecipeFieldDraft,
  getStoryboardDirectorRecipeActions,
  nextUnresolvedFinding,
  selectRecipeWorkspaceRegion,
} from './StoryboardDirectorRecipePanel'

const ISO_TIME = '2026-07-19T01:00:00.000Z'
const source = {
  id: 'source-1',
  kind: 'text' as const,
  title: 'Pilot',
  prompt: [
    'INT. LAB - NIGHT',
    'Mara opens the sealed case. She recoils.',
    '',
    'EXT. ROOF - DAWN',
    'Mara runs toward the antenna. The alarm sounds.',
  ].join('\n'),
}

function stageDrafts(
  recipe: StoryboardDirectorRecipe,
  stageId: Exclude<StoryboardDirectorStageId, 'source'>,
) {
  if (stageId === 'scene-review') return recipe.scene.drafts
  if (stageId === 'beat-review') return recipe.beat.drafts
  return recipe.shot.drafts
}

function reviewItemId(
  stageId: Exclude<StoryboardDirectorStageId, 'source'>,
  item: Record<string, unknown>,
) {
  if (stageId === 'scene-review') return item.sceneId as string
  if (stageId === 'beat-review') return item.beatId as string
  return item.shotId as string
}

function decideAll(
  recipe: StoryboardDirectorRecipe,
  stageId: Exclude<StoryboardDirectorStageId, 'source'>,
  decision: Exclude<CreatorSkillReviewStatus, 'pending'>,
) {
  return stageDrafts(recipe, stageId).reduce(
    (next, item) => setRecipeDecision(
      next,
      stageId,
      reviewItemId(stageId, item as unknown as Record<string, unknown>),
      decision,
      ISO_TIME,
    ),
    recipe,
  )
}

function decidedSceneRecipe() {
  return decideAll(
    createStoryboardDirectorRecipe(
      { projectId: 'project-1', workflowId: 'workflow-1' },
      source,
      ISO_TIME,
      runCreatorSkill,
    ),
    'scene-review',
    'approved',
  )
}

function completedRecipe() {
  let sceneReview = createStoryboardDirectorRecipe(
    { projectId: 'project-1', workflowId: 'workflow-1' },
    {
      ...source,
      prompt: [
        'INT. LAB - NIGHT',
        'Jose opens the sealed case.',
        'EXT. ROOF - DAWN',
        'Mara runs to the antenna, then smiles.',
        'The city falls quiet.',
      ].join('\n'),
    },
    ISO_TIME,
  )
  for (const item of sceneReview.scene.drafts) {
    sceneReview = updateRecipeDraft(sceneReview, 'scene-review', item.sceneId, {
      characters: item.sceneId === 'scene-001' ? ['Jose'] : ['Mara'],
    }, ISO_TIME)
  }
  const beatReview = approveSceneStage(
    decideAll(sceneReview, 'scene-review', 'approved'),
    ISO_TIME,
  )
  let decidedBeats = decideAll(beatReview, 'beat-review', 'approved')
  decidedBeats = {
    ...decidedBeats,
    shot: {
      ...decidedBeats.shot,
      options: { ...decidedBeats.shot.options, requestedShotCount: 6 },
    },
  }
  let shotReview = approveBeatStage(decidedBeats, ISO_TIME)
  for (const item of shotReview.shot.drafts) {
    const patch = {
      ...(!item.subject.trim()
        ? { subject: item.sceneId === 'scene-001' ? 'Jose' : 'Mara' }
        : {}),
      ...(item.shotId === 'scene-001-shot-001'
        ? { suggestedShotSize: 'wide' as const }
        : {}),
    }
    if (Object.keys(patch).length > 0) {
      shotReview = updateRecipeDraft(shotReview, 'shot-review', item.shotId, patch, ISO_TIME)
    }
  }
  return approveShotStage(decideAll(shotReview, 'shot-review', 'approved'), ISO_TIME)
}

function sceneRecipeWithWarning() {
  const recipe = approveSceneStage(decidedSceneRecipe(), ISO_TIME, runCreatorSkill)
  const warningIndex = recipe.beat.drafts.findIndex((item) => item.sceneId === recipe.beat.drafts[0]?.sceneId)
  assert.notEqual(warningIndex, -1)
  return {
    ...recipe,
    beat: {
      ...recipe.beat,
      drafts: recipe.beat.drafts.map((item, index) => index === warningIndex
        ? { ...item, needsReviewReason: 'Ambiguous action requires a person to decide.' }
        : item),
    },
  }
}

function healthyOrderedFindings(): StoryboardDirectorFinding[] {
  return ['first', 'second', 'third'].map((findingId, index) => ({
    findingId,
    severity: index === 0 ? 'blocking' : 'advisory',
    code: `FINDING_${index + 1}`,
    message: `Finding ${index + 1}`,
    evidenceIds: [],
  }))
}

let renderedBrowser: Browser | null = null
let renderedBundlePath = ''
let renderedTempDirectory = ''
const renderedPageErrors = new WeakMap<Page, string[]>()

async function findEsbuildBinary() {
  const pnpmDirectory = path.resolve(process.cwd(), '../..', 'node_modules/.pnpm')
  const entries = (await readdir(pnpmDirectory)).filter((entry) => entry.startsWith('tsx@')).sort()
  for (const entry of entries) {
    const candidate = path.join(
      pnpmDirectory,
      entry,
      'node_modules/esbuild/bin/esbuild',
    )
    try {
      await readdir(path.dirname(candidate))
      return candidate
    } catch {
      // Keep looking for the tsx installation that owns esbuild.
    }
  }
  throw new Error('Unable to locate the existing tsx esbuild binary')
}

function renderedHarnessSource() {
  const panelPath = path.resolve(process.cwd(), 'src/components/create/StoryboardDirectorPanel.tsx')
  const recipePanelPath = path.resolve(process.cwd(), 'src/components/create/StoryboardDirectorRecipePanel.tsx')
  const completed = JSON.stringify(completedRecipe())
  const sceneReview = JSON.stringify(decidedSceneRecipe())
  const beatReview = JSON.stringify(approveSceneStage(decidedSceneRecipe(), ISO_TIME))
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import { StoryboardDirectorPanel } from ${JSON.stringify(panelPath)}
    import { StoryboardDirectorRecipePanel } from ${JSON.stringify(recipePanelPath)}

    const FIXTURES = {
      completed: ${completed},
      sceneReview: ${sceneReview},
      beatReview: ${beatReview},
    }
    let root = null
    let calls = []
    let currentRecipe = null

    function resetRoot() {
      if (root) root.unmount()
      document.getElementById('root').replaceChildren()
      root = createRoot(document.getElementById('root'))
      calls = []
    }

    function recipeProps() {
      return {
        recipe: currentRecipe,
        availableSources: [],
        availableRecipes: [],
        saveState: 'cloud',
        legacyState: { status: 'absent' },
        onStartRecipe() {},
        onOpenRecipe() {},
        onCommitRecipe(next) {
          calls.push('commit')
          currentRecipe = next
          renderRecipe()
        },
        onFocusSource() {},
        onMaterializeGrouped() { calls.push('materialize') },
        onSyncShotBoard() { calls.push('sync') },
        onCreateDraftNodes() { calls.push('draft-nodes') },
        onImportLegacy() {},
      }
    }

    function renderRecipe() {
      root.render(React.createElement(StoryboardDirectorRecipePanel, recipeProps()))
    }

    function mountRecipe(kind = 'completed') {
      resetRoot()
      currentRecipe = structuredClone(FIXTURES[kind])
      renderRecipe()
    }

    function mountBoard(mode = 'matching') {
      resetRoot()
      currentRecipe = structuredClone(FIXTURES.completed)
      const draft = currentRecipe.shot.drafts[0]
      if (mode === 'blocking') draft.subject = ''
      const provenance = mode === 'manual' ? undefined : {
        recipeId: mode === 'unavailable' ? 'foreign-recipe' : currentRecipe.recipeId,
        sourceArtifactId: mode === 'stale'
          ? 'old-shot-artifact'
          : currentRecipe.shot.approvedArtifact.artifactId,
        sceneId: draft.sceneId,
        ...(draft.beatId ? { beatId: draft.beatId } : {}),
        shotId: draft.shotId,
      }
      const shot = {
        id: 'shot-card-1',
        index: 0,
        title: 'S01',
        nodeIds: [],
        createdAt: '2026-07-19T01:00:00.000Z',
        updatedAt: '2026-07-19T01:00:00.000Z',
        ...(provenance ? { recipe: provenance } : {}),
      }
      const matching = mode === 'unavailable' || mode === 'manual' ? [] : [{
        nodeId: 'control-node-1',
        recipeId: currentRecipe.recipeId,
        title: 'Pilot Recipe',
        status: 'approved',
      }]
      root.render(React.createElement(StoryboardDirectorPanel, {
        open: true,
        state: { version: '1', shots: [shot], updatedAt: shot.updatedAt },
        activeShotId: shot.id,
        recipe: mode === 'unavailable' ? null : currentRecipe,
        availableRecipes: matching,
        onStateChange() {},
        onActiveShotChange() {},
        onOpenRecipe(nodeId) {
          const selected = document.querySelector('[data-testid="storyboard-director-tab-board"]')
            ?.getAttribute('aria-selected') === 'true' ? 'board' : 'recipe'
          calls.push('open:' + nodeId + ':' + selected)
        },
        onClose() {},
      }))
    }

    window.__directorHarness = {
      mountRecipe,
      mountBoard,
      calls: () => calls.slice(),
      recipe: () => structuredClone(currentRecipe),
    }
  `
}

before(async () => {
  renderedTempDirectory = await mkdtemp(path.join(tmpdir(), 'storyboard-director-render-'))
  const entryPath = path.join(renderedTempDirectory, 'entry.tsx')
  renderedBundlePath = path.join(renderedTempDirectory, 'bundle.js')
  await writeFile(entryPath, renderedHarnessSource(), 'utf8')
  const build = spawnSync(await findEsbuildBinary(), [
    entryPath,
    '--bundle',
    '--platform=browser',
    '--format=iife',
    '--jsx=automatic',
    `--outfile=${renderedBundlePath}`,
    `--tsconfig=${path.resolve(process.cwd(), 'tsconfig.json')}`,
    '--define:process.env.NODE_ENV="test"',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  assert.equal(build.status, 0, build.stderr || build.stdout)
  renderedBrowser = await chromium.launch({ headless: true })
})

after(async () => {
  await renderedBrowser?.close()
  if (renderedTempDirectory) await rm(renderedTempDirectory, { recursive: true, force: true })
})

async function renderPage() {
  assert.ok(renderedBrowser)
  const page = await renderedBrowser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultTimeout(5_000)
  const errors: string[] = []
  renderedPageErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
  await page.addScriptTag({ path: renderedBundlePath })
  return page
}

async function selectReviewStage(page: Page, label: '场景' | '节拍' | '镜头') {
  const navigation = page.getByRole('navigation', { name: 'Recipe 阶段' })
  await navigation.getByRole('button', { name: new RegExp(label) }).click()
  await page.getByRole('button', { name: '全部' }).click()
}

type RenderedHarness = {
  mountRecipe: (kind?: 'completed' | 'sceneReview' | 'beatReview') => void
  mountBoard: (mode?: 'matching' | 'blocking' | 'stale' | 'unavailable' | 'manual') => void
  calls: () => string[]
  recipe: () => StoryboardDirectorRecipe
}

async function mountRenderedRecipe(page: Page, kind: 'completed' | 'sceneReview' | 'beatReview' = 'completed') {
  await page.evaluate((fixture) => (
    window as unknown as { __directorHarness: RenderedHarness }
  ).__directorHarness.mountRecipe(fixture), kind)
  await page.waitForTimeout(50)
  if (await page.locator('#root').evaluate((element) => element.childElementCount) === 0) {
    throw new Error(`Rendered Recipe root is empty: ${(renderedPageErrors.get(page) ?? []).join(' | ')}`)
  }
}

async function mountRenderedBoard(
  page: Page,
  mode: 'matching' | 'blocking' | 'stale' | 'unavailable' | 'manual',
) {
  await page.evaluate((value) => (
    window as unknown as { __directorHarness: RenderedHarness }
  ).__directorHarness.mountBoard(value), mode)
  await page.waitForTimeout(50)
}

async function renderedCalls(page: Page) {
  return page.evaluate(() => (
    window as unknown as { __directorHarness: RenderedHarness }
  ).__directorHarness.calls())
}

async function renderedRecipe(page: Page) {
  return page.evaluate(() => (
    window as unknown as { __directorHarness: RenderedHarness }
  ).__directorHarness.recipe())
}

describe('Storyboard Director panel state', () => {
  test('opening from a Recipe selects the Recipe tab and global opening preserves board', () => {
    assert.equal(createStoryboardDirectorPanelState({ hasRecipe: true, openedFromRecipe: true }).tab, 'recipe')
    assert.equal(createStoryboardDirectorPanelState({ hasRecipe: false, openedFromRecipe: false }).tab, 'board')
    assert.equal(selectStoryboardDirectorTab({ tab: 'board' }, 'recipe').tab, 'recipe')
  })

  test('tab switching does not mutate Recipe or shot-board state', () => {
    const recipe = decidedSceneRecipe()
    const shotBoard: StoryboardState = { version: '1', shots: [], updatedAt: ISO_TIME }
    const state = { tab: 'board' as const, recipe, shotBoard }
    const next = selectStoryboardDirectorTab(state, 'recipe')

    assert.notEqual(next, state)
    assert.equal(next.recipe, recipe)
    assert.equal(next.shotBoard, shotBoard)
    assert.equal(state.tab, 'board')
  })

  test('manual shot edits preserve Recipe provenance', () => {
    const shotBoard: StoryboardState = {
      version: '1',
      updatedAt: ISO_TIME,
      shots: [{
        id: 'shot-card-1',
        index: 0,
        title: 'S01',
        nodeIds: [],
        createdAt: ISO_TIME,
        updatedAt: ISO_TIME,
        recipe: {
          recipeId: 'recipe-1',
          sourceArtifactId: 'artifact-1',
          sceneId: 'scene-001',
          beatId: 'beat-001',
          shotId: 'shot-001',
        },
      }],
    }

    const next = patchStoryboardDirectorShot(
      shotBoard,
      'shot-card-1',
      { mood: 'Tense' },
      '2026-07-19T02:00:00.000Z',
    )

    assert.equal(next.shots[0]?.mood, 'Tense')
    assert.deepEqual(next.shots[0]?.recipe, shotBoard.shots[0]?.recipe)
    assert.notEqual(next.shots[0]?.recipe, undefined)
  })

  test('matches Recipe control nodes and derives real shot provenance markers', () => {
    const recipe = completedRecipe()
    const availableRecipes = [{
      nodeId: 'control-node-1',
      recipeId: recipe.recipeId,
      title: 'Pilot Recipe',
      status: 'approved',
    }]
    const cleanDraft = recipe.shot.drafts.find((draft) => (
      draft.decision === 'approved'
      && !analyzeStoryboardDirectorRecipe(recipe).some((finding) => finding.shotId === draft.shotId)
    ))
    assert.ok(cleanDraft)
    const shot = {
      id: 'card-1',
      index: 0,
      title: 'S01',
      nodeIds: [],
      createdAt: ISO_TIME,
      updatedAt: ISO_TIME,
      recipe: {
        recipeId: recipe.recipeId,
        sourceArtifactId: recipe.shot.approvedArtifact!.artifactId,
        sceneId: cleanDraft.sceneId,
        ...(cleanDraft.beatId ? { beatId: cleanDraft.beatId } : {}),
        shotId: cleanDraft.shotId,
      },
    }

    assert.equal(
      findStoryboardDirectorRecipeControl(availableRecipes, recipe.recipeId)?.nodeId,
      'control-node-1',
    )
    assert.equal(findStoryboardDirectorRecipeControl(availableRecipes, 'foreign'), null)
    assert.deepEqual(deriveStoryboardDirectorShotRecipeMarkers(shot, recipe), {
      synchronization: 'synchronized',
      quality: 'clean',
    })
    assert.deepEqual(deriveStoryboardDirectorShotRecipeMarkers({
      ...shot,
      recipe: { ...shot.recipe, sourceArtifactId: 'old-artifact' },
    }, recipe), {
      synchronization: 'stale',
      quality: 'stale',
    })
    assert.deepEqual(deriveStoryboardDirectorShotRecipeMarkers(shot, null), {
      synchronization: 'unavailable',
      quality: 'unavailable',
    })

    const blocking = {
      ...recipe,
      shot: {
        ...recipe.shot,
        drafts: recipe.shot.drafts.map((draft) => draft.shotId === cleanDraft.shotId
          ? { ...draft, subject: '' }
          : draft),
      },
    }
    assert.equal(
      deriveStoryboardDirectorShotRecipeMarkers(shot, blocking)?.quality,
      'blocking',
    )

    const sameSceneDrafts = recipe.shot.drafts.filter((draft) => (
      draft.decision === 'approved' && draft.sceneId === recipe.shot.drafts[0]?.sceneId
    ))
    assert.ok(sameSceneDrafts.length >= 2)
    const previousDraft = sameSceneDrafts[0]!
    const advisoryDraft = sameSceneDrafts[1]!
    const advisory = {
      ...recipe,
      shot: {
        ...recipe.shot,
        drafts: recipe.shot.drafts.map((draft) => draft.shotId === advisoryDraft.shotId
          ? {
              ...draft,
              objective: previousDraft.objective,
              action: previousDraft.action,
              suggestedShotSize: previousDraft.suggestedShotSize,
            }
          : draft),
      },
    }
    assert.equal(deriveStoryboardDirectorShotRecipeMarkers({
      ...shot,
      recipe: {
        recipeId: recipe.recipeId,
        sourceArtifactId: recipe.shot.approvedArtifact!.artifactId,
        sceneId: advisoryDraft.sceneId,
        ...(advisoryDraft.beatId ? { beatId: advisoryDraft.beatId } : {}),
        shotId: advisoryDraft.shotId,
      },
    }, advisory)?.quality, 'blocking')

    const finding = (
      severity: StoryboardDirectorFinding['severity'],
      scope: Partial<Pick<StoryboardDirectorFinding, 'sceneId' | 'beatId' | 'shotId'>>,
    ): StoryboardDirectorFinding => ({
      findingId: `finding-${severity}-${Object.values(scope).join('-') || 'global'}`,
      severity,
      code: 'REVIEW_FINDING',
      message: 'Review finding',
      evidenceIds: [],
      ...scope,
    })
    const provenance = shot.recipe!

    for (const applicableFinding of [
      finding('blocking', {}),
      finding('advisory', { sceneId: provenance.sceneId }),
      finding('advisory', { beatId: provenance.beatId }),
      finding('advisory', { shotId: provenance.shotId }),
    ]) {
      const marked = { ...recipe, findings: [applicableFinding] }
      assert.equal(
        deriveStoryboardDirectorShotRecipeMarkers(shot, marked)?.quality,
        applicableFinding.severity,
      )
    }
    const foreignScope = {
      ...recipe,
      findings: [finding('advisory', { sceneId: 'foreign-scene' })],
    }
    assert.equal(deriveStoryboardDirectorShotRecipeMarkers(shot, foreignScope)?.quality, 'clean')

    const invalidated = updateRecipeDraft(recipe, 'scene-review', recipe.scene.drafts[0]!.sceneId, {
      heading: 'INT. INVALIDATED LAB - NIGHT',
    }, ISO_TIME)
    assert.equal(invalidated.shot.status, 'stale')
    assert.equal(
      invalidated.shot.approvedArtifact?.artifactId,
      recipe.shot.approvedArtifact?.artifactId,
    )
    assert.deepEqual(deriveStoryboardDirectorShotRecipeMarkers(shot, invalidated), {
      synchronization: 'stale',
      quality: 'blocking',
    })

    for (const status of ['needs-review', 'blocked', 'idle'] as const) {
      const nonFinal = { ...recipe, shot: { ...recipe.shot, status } }
      const markers = deriveStoryboardDirectorShotRecipeMarkers(shot, nonFinal)
      assert.equal(markers?.synchronization, 'stale')
      assert.notEqual(markers?.quality, 'clean')
    }
    const sourceInvalidated = invalidateRecipeAfter(recipe, 'source', ISO_TIME)
    assert.equal(
      deriveStoryboardDirectorShotRecipeMarkers(shot, sourceInvalidated)?.synchronization,
      'stale',
    )
    assert.notEqual(
      deriveStoryboardDirectorShotRecipeMarkers(shot, sourceInvalidated)?.quality,
      'clean',
    )
  })
})

describe('Storyboard Director Recipe actions', () => {
  test('stage approval invokes the state machine and returns the next review', () => {
    const calls: string[] = []
    const runner: typeof runCreatorSkill = (skillId, input, version) => {
      calls.push(skillId)
      return runCreatorSkill(skillId, input, version)
    }
    const next = approveActiveRecipeStage(decidedSceneRecipe(), ISO_TIME, runner)

    assert.equal(next.activeStage, 'beat-review')
    assert.equal(next.beat.status, 'needs-review')
    assert.deepEqual(calls, ['narrative-beat-analysis'])
  })

  test('scene batch approval leaves needs-review items pending', () => {
    const recipe = sceneRecipeWithWarning()
    const sceneId = recipe.beat.drafts[0]!.sceneId
    const next = batchDecideRecipeScene(recipe, sceneId, 'approved', ISO_TIME)
    const inScene = next.beat.drafts.filter((item) => item.sceneId === sceneId)

    assert.equal(inScene.find((item) => item.needsReviewReason)?.decision, 'pending')
    assert.ok(inScene.filter((item) => !item.needsReviewReason).every(
      (item) => item.decision === 'approved',
    ))
  })

  test('next issue navigation is deterministic and wraps once', () => {
    const findings = healthyOrderedFindings()
    assert.equal(nextUnresolvedFinding(findings, null)?.findingId, findings[0]?.findingId)
    assert.equal(nextUnresolvedFinding(findings, findings[0]!.findingId)?.findingId, findings[1]?.findingId)
    assert.equal(nextUnresolvedFinding(findings, findings.at(-1)!.findingId)?.findingId, findings[0]?.findingId)
  })

  test('final actions follow Intelligence readiness and receipt conflicts', () => {
    const ready = completedRecipe()
    const available = getStoryboardDirectorRecipeActions(ready)

    assert.equal(available.materializeGrouped, true)
    assert.equal(available.syncShotBoard, true)
    assert.equal(available.createDraftNodes, true)

    const receipt = {
      identity: 'duplicate-receipt',
      kind: 'scene' as const,
      resultId: 'result-1',
      targetId: 'target-1',
    }
    const conflicting = {
      ...ready,
      receipts: [receipt, { ...receipt, targetId: 'target-2' }],
    }
    const blocked = getStoryboardDirectorRecipeActions(conflicting)
    assert.equal(blocked.materializeGrouped, false)
    assert.equal(blocked.syncShotBoard, false)
    assert.equal(blocked.createDraftNodes, false)
  })

  test('source-stale state exposes recovery actions and no apply actions', () => {
    const stale = invalidateRecipeAfter(completedRecipe(), 'source', ISO_TIME)
    const actions = getStoryboardDirectorRecipeActions(stale)

    assert.deepEqual(actions, {
      materializeGrouped: false,
      syncShotBoard: false,
      createDraftNodes: false,
      approveStage: false,
      rerunStage: false,
      focusSource: true,
      startNewVersion: true,
    })
  })

  test('legacy import is disabled for a nonempty cloud board', () => {
    const legacy = {
      status: 'valid' as const,
      state: {
        version: '1',
        updatedAt: ISO_TIME,
        shots: [{
          id: 'legacy-shot',
          index: 0,
          title: 'S01',
          nodeIds: [],
          createdAt: ISO_TIME,
          updatedAt: ISO_TIME,
        }],
      },
    }
    const cloudBoard = completedRecipe().storyboard
    const nonemptyCloudBoard: StoryboardState = {
      ...cloudBoard,
      shots: [{
        id: 'cloud-shot',
        index: 0,
        title: 'S01',
        nodeIds: [],
        createdAt: ISO_TIME,
        updatedAt: ISO_TIME,
      }],
    }

    assert.equal(canImportLegacyDirectorState(legacy, nonemptyCloudBoard), false)
    assert.equal(canImportLegacyDirectorState(legacy, cloudBoard), true)
  })

  test('narrow workspace region switching preserves review state', () => {
    const state = { region: 'review' as const, filter: 'warnings' as const, selectedFindingId: 'first' }
    const next = selectRecipeWorkspaceRegion(state, 'evidence')

    assert.deepEqual(next, { ...state, region: 'evidence' })
    assert.equal(state.region, 'review')
  })

  test('Enter commit suppresses the following blur duplicate', () => {
    const draft = createRecipeFieldDraft('Original')
    const typed = { ...draft, value: 'Changed' }
    const enter = finishRecipeFieldDraft(typed, 'enter')
    const blur = finishRecipeFieldDraft(enter.state, 'blur')

    assert.equal(enter.commitValue, 'Changed')
    assert.equal(enter.state.committedValue, 'Original')
    assert.equal(blur.commitValue, null)
    assert.equal(blur.state.skipNextBlur, false)
  })
})

describe('Storyboard Director rendered interactions', () => {
  test('approved edit cancel resets the draft and re-edit confirm commits once', async () => {
    const page = await renderPage()
    try {
      await mountRenderedRecipe(page)
      await selectReviewStage(page, '场景')
      const heading = page.getByLabel('场景标题').first()
      const original = await heading.inputValue()

      await heading.fill('Cancelled heading')
      await heading.blur()
      await page.getByText(/此修改将使 \d+ 个节拍和 \d+ 个镜头失效/).waitFor()
      assert.deepEqual(await renderedCalls(page), [])
      await page.getByRole('button', { name: '取消' }).click()
      await page.waitForFunction((expected) => (
        (document.querySelector('[aria-label="场景标题"]') as HTMLInputElement | null)?.value === expected
      ), original)
      assert.equal(await heading.inputValue(), original)

      await heading.fill('Confirmed heading')
      await heading.blur()
      await page.getByText(/此修改将使 \d+ 个节拍和 \d+ 个镜头失效/).waitFor()
      await page.getByRole('button', { name: '确认修改' }).click()
      assert.deepEqual(await renderedCalls(page), ['commit'])
      assert.equal((await renderedRecipe(page)).scene.drafts[0]?.heading, 'Confirmed heading')
    } finally {
      await page.close()
    }
  })

  test('approved edit Enter and its following blur open one action and commit once', async () => {
    const page = await renderPage()
    try {
      await mountRenderedRecipe(page)
      await selectReviewStage(page, '场景')
      const heading = page.getByLabel('场景标题').first()
      await heading.fill('Enter heading')
      await heading.press('Enter')

      assert.equal(await page.getByRole('button', { name: '确认修改' }).count(), 1)
      assert.deepEqual(await renderedCalls(page), [])
      await page.getByRole('button', { name: '确认修改' }).click()
      await heading.blur()
      assert.deepEqual(await renderedCalls(page), ['commit'])
    } finally {
      await page.close()
    }
  })

  test('pending edit exclusively locks fields, reorder, and stage actions until cancel or confirm', async () => {
    const page = await renderPage()
    const initial = completedRecipe()
    const initialOrder = initial.scene.drafts.map((item) => item.sceneId)
    try {
      await mountRenderedRecipe(page)
      await selectReviewStage(page, '场景')
      const heading = page.getByLabel('场景标题').first()
      const actionSummary = page.getByLabel('场景动作摘要').first()
      const originalHeading = await heading.inputValue()
      const originalAction = await actionSummary.inputValue()
      const rerun = page.getByRole('button', { name: '重新运行当前阶段' })
      const materialize = page.getByRole('button', { name: '落地审核结果' })
      const sync = page.getByRole('button', { name: '同步镜头板' })
      const createDrafts = page.getByRole('button', { name: '创建草稿节点' })
      for (const action of [rerun, materialize, sync, createDrafts]) {
        assert.equal(await action.isEnabled(), true)
      }

      await heading.fill('First pending heading')
      await heading.blur()
      await page.getByRole('button', { name: '确认修改' }).waitFor()

      assert.equal(await actionSummary.isDisabled(), true)
      assert.equal(await page.getByTitle('下移').first().isDisabled(), true)
      for (const action of [rerun, materialize, sync, createDrafts]) {
        assert.equal(await action.isDisabled(), true)
        await action.evaluate((button) => (button as HTMLButtonElement).click())
      }
      await actionSummary.evaluate((field) => {
        const input = field as HTMLTextAreaElement
        input.value = 'Second request must not win'
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      await page.getByTitle('下移').first().evaluate((button) => (
        button as HTMLButtonElement
      ).click())
      assert.equal(await page.getByRole('button', { name: '确认修改' }).count(), 1)
      assert.deepEqual(await renderedCalls(page), [])

      await page.getByRole('button', { name: '取消' }).click()
      await page.waitForFunction((expected) => (
        (document.querySelector('[aria-label="场景标题"]') as HTMLInputElement | null)?.value === expected
      ), originalHeading)
      assert.equal(await actionSummary.inputValue(), originalAction)
      assert.equal(await actionSummary.isEnabled(), true)
      assert.equal(await page.getByTitle('下移').first().isEnabled(), true)
      for (const action of [rerun, materialize, sync, createDrafts]) {
        assert.equal(await action.isEnabled(), true)
      }

      await heading.fill('Confirmed first request')
      await heading.blur()
      await page.getByRole('button', { name: '确认修改' }).click()
      assert.deepEqual(await renderedCalls(page), ['commit'])
      const committed = await renderedRecipe(page)
      assert.equal(committed.scene.drafts[0]?.heading, 'Confirmed first request')
      assert.equal(committed.scene.drafts[0]?.actionSummary, originalAction)
      assert.deepEqual(committed.scene.drafts.map((item) => item.sceneId), initialOrder)
    } finally {
      await page.close()
    }
  })

  test('pending approved edit survives cross-stage batch and decision attempts', async () => {
    const page = await renderPage()
    try {
      await mountRenderedRecipe(page, 'beatReview')
      await selectReviewStage(page, '场景')
      const heading = page.getByLabel('场景标题').first()
      await heading.fill('Only pending scene edit')
      await heading.blur()
      await page.getByRole('button', { name: '确认修改' }).waitFor()

      await selectReviewStage(page, '节拍')
      const batchApprove = page.getByRole('button', { name: '批量批准' })
      const decideApprove = page.getByTitle('批准').first()
      const moveDown = page.getByTitle('下移').first()
      assert.equal(await batchApprove.isDisabled(), true)
      assert.equal(await decideApprove.isDisabled(), true)
      assert.equal(await moveDown.isDisabled(), true)
      await batchApprove.evaluate((button) => (button as HTMLButtonElement).click())
      await decideApprove.evaluate((button) => (button as HTMLButtonElement).click())
      await moveDown.evaluate((button) => (button as HTMLButtonElement).click())
      assert.deepEqual(await renderedCalls(page), [])
      assert.equal(await page.getByRole('button', { name: '确认修改' }).count(), 1)

      await page.getByRole('button', { name: '确认修改' }).click()
      assert.deepEqual(await renderedCalls(page), ['commit'])
      assert.equal((await renderedRecipe(page)).scene.drafts[0]?.heading, 'Only pending scene edit')
    } finally {
      await page.close()
    }
  })

  test('approved scene reorder previews impact, cancels without change, and confirms once', async () => {
    const page = await renderPage()
    const recipe = completedRecipe()
    const impact = changeImpactForStage(recipe, 'scene-review')
    const initialOrder = recipe.scene.drafts.map((item) => item.sceneId)
    try {
      await mountRenderedRecipe(page)
      await selectReviewStage(page, '场景')
      const moveDown = page.getByTitle('下移').first()
      assert.equal(await moveDown.isEnabled(), true)
      await moveDown.click()
      await page.getByText(`此修改将使 ${impact.beatCount} 个节拍和 ${impact.shotCount} 个镜头失效。`).waitFor()
      assert.deepEqual(await renderedCalls(page), [])
      await page.getByRole('button', { name: '取消' }).click()
      assert.deepEqual((await renderedRecipe(page)).scene.drafts.map((item) => item.sceneId), initialOrder)

      await moveDown.click()
      await page.getByRole('button', { name: '确认调整' }).click()
      assert.deepEqual(await renderedCalls(page), ['commit'])
      assert.deepEqual(
        (await renderedRecipe(page)).scene.drafts.map((item) => item.sceneId),
        initialOrder.slice().reverse(),
      )
    } finally {
      await page.close()
    }
  })

  test('approved beat reorder is reviewable while final shot reorder remains locked', async () => {
    const page = await renderPage()
    const recipe = completedRecipe()
    const impact = changeImpactForStage(recipe, 'beat-review')
    const initialOrder = recipe.beat.drafts.map((item) => item.beatId)
    try {
      await mountRenderedRecipe(page)
      await selectReviewStage(page, '节拍')
      const beatMoveDown = page.getByTitle('下移').first()
      assert.equal(await beatMoveDown.isEnabled(), true)
      await beatMoveDown.click()
      await page.getByText(`此修改将使 ${impact.beatCount} 个节拍和 ${impact.shotCount} 个镜头失效。`).waitFor()
      await page.getByRole('button', { name: '取消' }).click()
      assert.deepEqual(await renderedCalls(page), [])
      assert.deepEqual(
        (await renderedRecipe(page)).beat.drafts.map((item) => item.beatId),
        initialOrder,
      )

      await beatMoveDown.click()
      await page.getByRole('button', { name: '确认调整' }).click()
      assert.deepEqual(await renderedCalls(page), ['commit'])
      assert.notDeepEqual(
        (await renderedRecipe(page)).beat.drafts.map((item) => item.beatId),
        initialOrder,
      )

      await mountRenderedRecipe(page)
      await selectReviewStage(page, '镜头')
      assert.equal(await page.getByTitle('下移').first().isDisabled(), true)
    } finally {
      await page.close()
    }
  })

  test('matching provenance opens its control node before selecting Recipe', async () => {
    const page = await renderPage()
    try {
      await mountRenderedBoard(page, 'blocking')
      assert.equal(await page.getByText('已同步').count(), 1)
      assert.equal(await page.getByText('阻塞').count(), 1)
      const provenance = page.getByRole('button', { name: /Recipe sdr1_/ })
      assert.equal(await provenance.isEnabled(), true)
      await provenance.click()
      assert.deepEqual(await renderedCalls(page), ['open:control-node-1:board'])
      assert.equal(
        await page.getByTestId('storyboard-director-tab-recipe').getAttribute('aria-selected'),
        'true',
      )
    } finally {
      await page.close()
    }
  })

  test('stale, unavailable, and manual shots render truthful provenance states', async () => {
    const page = await renderPage()
    try {
      await mountRenderedBoard(page, 'stale')
      assert.equal(await page.getByText('已过期').count(), 1)
      assert.equal(await page.getByText('来源已保留').count(), 0)

      await mountRenderedBoard(page, 'unavailable')
      const unavailable = page.getByRole('button', { name: 'Recipe 不可用' })
      assert.equal(await unavailable.isDisabled(), true)
      await unavailable.click({ force: true })
      assert.deepEqual(await renderedCalls(page), [])

      await mountRenderedBoard(page, 'manual')
      assert.equal(await page.getByText(/Recipe sdr1_/).count(), 0)
      assert.equal(await page.getByText('Recipe 不可用').count(), 0)
      assert.equal(await page.locator('input[placeholder^="例: 紧张"]').isEnabled(), true)
    } finally {
      await page.close()
    }
  })

  test('batch and stage approval controls use labeled stable Lucide buttons', async () => {
    const page = await renderPage()
    try {
      await mountRenderedRecipe(page, 'sceneReview')
      const batchApprove = page.getByRole('button', { name: '批量批准' })
      const batchReject = page.getByRole('button', { name: '批量拒绝' })
      const approveStage = page.getByRole('button', { name: '批准当前阶段' })
      for (const control of [batchApprove, batchReject, approveStage]) {
        assert.equal(await control.locator('svg').count(), 1)
        assert.ok((await control.getAttribute('title'))?.length)
        assert.match(await control.getAttribute('class') ?? '', /h-8/)
      }
    } finally {
      await page.close()
    }
  })
})
