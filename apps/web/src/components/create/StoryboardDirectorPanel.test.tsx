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
import type { ShotCard, StoryboardState } from '../../lib/storyboard/types'
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
import {
  planStoryboardDirectorDraftNodes,
  planStoryboardDirectorShotBoardSync,
  recordStoryboardDirectorPartialBatch,
} from './canvas/skills/storyboardDirectorMaterialization'
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

function partialBatchRecipe() {
  const recipe = completedRecipe()
  const plans = planStoryboardDirectorDraftNodes(recipe, []).create
  const first = plans[0]
  assert.ok(first)
  return recordStoryboardDirectorPartialBatch(
    recipe,
    'draft-node-creation',
    plans.map((plan) => plan.identity),
    [{
      identity: first.identity,
      kind: 'draft-node',
      resultId: first.resultId,
      targetId: 'created-draft-1',
    }],
    ISO_TIME,
  ).recipe
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
let renderedStylesPath = ''
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
  const replacement = JSON.stringify({
    ...completedRecipe(),
    recipeId: 'sdr1_replacement',
    sourceNode: {
      ...completedRecipe().sourceNode,
      id: 'source-replacement',
      title: 'Replacement',
    },
  })
  const sceneReview = JSON.stringify(decidedSceneRecipe())
  const beatReview = JSON.stringify(approveSceneStage(decidedSceneRecipe(), ISO_TIME))
  const partialBatch = JSON.stringify(partialBatchRecipe())
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import { StoryboardDirectorPanel } from ${JSON.stringify(panelPath)}
    import { StoryboardDirectorRecipePanel } from ${JSON.stringify(recipePanelPath)}

    const FIXTURES = {
      completed: ${completed},
      replacement: ${replacement},
      sceneReview: ${sceneReview},
      beatReview: ${beatReview},
      partialBatch: ${partialBatch},
    }
    let root = null
    let calls = []
    let currentRecipe = null
    let emergencyPartialBatch = null
    let detachedConfirm = null
    let livePanel = null
    let boardMode = null
    let boardContextKey = 'project-1:workflow-1:control-node-1'
    let currentBoardState = null
    let boardCommitAllowed = true
    let deferredBoardFlush = null

    function resetRoot() {
      if (root) root.unmount()
      document.getElementById('root').replaceChildren()
      root = createRoot(document.getElementById('root'))
      calls = []
      emergencyPartialBatch = null
      detachedConfirm = null
      livePanel = null
      boardMode = null
      boardContextKey = 'project-1:workflow-1:control-node-1'
      currentBoardState = null
      boardCommitAllowed = true
      deferredBoardFlush = null
    }

    function recipeProps() {
      return {
        recipe: currentRecipe,
        availableSources: [],
        availableRecipes: [],
        saveState: 'cloud',
        legacyState: { status: 'absent' },
        emergencyPartialBatch,
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
        onAcknowledgeEmergencyPartialBatch(batchId) {
          calls.push('emergency-ack:' + batchId)
          emergencyPartialBatch = null
          renderRecipe()
        },
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

    function replaceRecipe(kind = 'replacement') {
      detachedConfirm = document.querySelector('[aria-label="确认修改"]')
        || Array.from(document.querySelectorAll('button')).find((button) => button.textContent === '确认修改')
        || null
      currentRecipe = structuredClone(FIXTURES[kind])
      renderRecipe()
    }

    function mountEmergencyRecipe() {
      resetRoot()
      currentRecipe = structuredClone(FIXTURES.completed)
      emergencyPartialBatch = structuredClone(
        FIXTURES.partialBatch.findings.find(
          (finding) => finding.code === 'PARTIAL_MATERIALIZATION_BATCH',
        ).partialBatch,
      )
      renderRecipe()
    }

    function clickDetachedConfirm() {
      detachedConfirm?.click()
    }

    function renderBoard() {
      const matching = boardMode === 'unavailable' || boardMode === 'manual' ? [] : [{
        nodeId: boardMode === 'replacement' ? 'control-node-2' : 'control-node-1',
        recipeId: currentRecipe.recipeId,
        title: 'Pilot Recipe',
        status: 'approved',
      }]
      root.render(React.createElement(StoryboardDirectorPanel, {
        open: true,
        state: currentBoardState,
        activeShotId: currentBoardState.shots[0].id,
        recipe: boardMode === 'unavailable' ? null : currentRecipe,
        boardCommitMode: boardMode === 'manual' ? 'immediate' : 'buffered',
        boardContextKey,
        openedFromRecipe: false,
        availableSources: [],
        availableRecipes: matching,
        saveState: 'local',
        legacyState: { status: 'absent' },
        emergencyPartialBatch: null,
        onStateChange(next) {
          if (!boardCommitAllowed) {
            calls.push('state-change-failed')
            return false
          }
          calls.push('state-change')
          currentBoardState = next
          return true
        },
        onActiveShotChange() {},
        onStartRecipe() {},
        onOpenRecipe(nodeId) {
          const selected = document.querySelector('[data-testid="storyboard-director-tab-board"]')
            ?.getAttribute('aria-selected') === 'true' ? 'board' : 'recipe'
          calls.push('open:' + nodeId + ':' + selected)
        },
        onCommitRecipe() {},
        onFocusSource() {},
        onMaterializeGrouped() {},
        onSyncShotBoard() {},
        onCreateDraftNodes() {},
        onImportLegacy() {},
        onClose() { calls.push('close') },
        onAcknowledgeEmergencyPartialBatch() {},
        registerDeferredBoardFlush(flush) {
          deferredBoardFlush = flush
          return () => {
            if (deferredBoardFlush === flush) deferredBoardFlush = null
          }
        },
      }))
    }

    function mountBoard(mode = 'matching') {
      resetRoot()
      boardMode = mode
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
        shotType: {
          wide: 'ELS',
          full: 'LS',
          medium: 'MS',
          close: 'CU',
          'extreme-close': 'ECU',
        }[draft.suggestedShotSize],
        durationSec: draft.duration,
        directorNote: (draft.objective + '\\n' + draft.action).trim(),
        nodeIds: [],
        createdAt: '2026-07-19T01:00:00.000Z',
        updatedAt: '2026-07-19T01:00:00.000Z',
        ...(provenance ? { recipe: provenance } : {}),
      }
      currentBoardState = { version: '1', shots: [shot], updatedAt: shot.updatedAt }
      renderBoard()
    }

    function switchBoardRecipe() {
      currentRecipe = structuredClone(FIXTURES.replacement)
      boardMode = 'replacement'
      boardContextKey = 'project-1:workflow-1:control-node-2'
      renderBoard()
    }

    function switchBoardContext(kind) {
      if (kind === 'project') boardContextKey = 'project-2:workflow-2:control-node-2'
      if (kind === 'workflow') boardContextKey = 'project-1:workflow-2:control-node-2'
      if (kind === 'control') boardContextKey = 'project-1:workflow-1:control-node-2'
      if (kind === 'replacement') {
        currentRecipe = structuredClone(FIXTURES.replacement)
        boardContextKey = 'project-1:workflow-1:control-node-2'
      }
      renderBoard()
    }

    function unmountBoard() {
      root.unmount()
      root = null
    }

    function failBoardCommit() {
      boardCommitAllowed = false
    }

    function navigateFromBoard(destination) {
      if (!deferredBoardFlush?.()) {
        calls.push('navigation-blocked:' + destination)
        return false
      }
      calls.push('navigate:' + destination)
      return true
    }

    function renderLivePanel() {
      const recipe = livePanel.recipeKind
        ? structuredClone(FIXTURES[livePanel.recipeKind])
        : null
      currentRecipe = recipe
      const control = recipe ? [{
        nodeId: livePanel.controlNodeId,
        recipeId: recipe.recipeId,
        title: 'Live Recipe',
        status: 'approved',
      }] : []
      root.render(React.createElement(StoryboardDirectorPanel, {
        open: livePanel.open,
        state: {
          version: '2',
          shots: [],
          updatedAt: livePanel.boardUpdatedAt,
        },
        activeShotId: null,
        recipe,
        boardCommitMode: recipe ? 'buffered' : 'immediate',
        boardContextKey: [
          'project-1',
          'workflow-1',
          livePanel.controlNodeId,
          recipe?.recipeId ?? 'manual',
        ].join(':'),
        openedFromRecipe: livePanel.openedFromRecipe,
        availableSources: [],
        availableRecipes: control,
        saveState: livePanel.saveState,
        legacyState: { status: 'absent' },
        emergencyPartialBatch: null,
        onStateChange() {},
        onActiveShotChange() {},
        onStartRecipe() {},
        onOpenRecipe() {},
        onCommitRecipe() {},
        onFocusSource() {},
        onMaterializeGrouped() {},
        onSyncShotBoard() {},
        onCreateDraftNodes() {},
        onImportLegacy() {},
        onClose() {},
        onAcknowledgeEmergencyPartialBatch() {},
        registerDeferredBoardFlush() { return () => {} },
      }))
    }

    function mountLivePanel() {
      resetRoot()
      livePanel = {
        open: true,
        openedFromRecipe: false,
        recipeKind: 'completed',
        controlNodeId: 'control-live-a',
        boardUpdatedAt: '2026-07-19T01:00:00.000Z',
        saveState: 'cloud',
      }
      renderLivePanel()
    }

    function updateLivePanel(patch) {
      livePanel = { ...livePanel, ...patch }
      renderLivePanel()
    }

    window.__directorHarness = {
      mountRecipe,
      mountEmergencyRecipe,
      replaceRecipe,
      clickDetachedConfirm,
      mountBoard,
      switchBoardRecipe,
      switchBoardContext,
      unmountBoard,
      failBoardCommit,
      navigateFromBoard,
      mountLivePanel,
      updateLivePanel,
      calls: () => calls.slice(),
      recipe: () => structuredClone(currentRecipe),
      boardState: () => structuredClone(currentBoardState),
    }
  `
}

before(async () => {
  renderedTempDirectory = await mkdtemp(path.join(tmpdir(), 'storyboard-director-render-'))
  const entryPath = path.join(renderedTempDirectory, 'entry.tsx')
  renderedBundlePath = path.join(renderedTempDirectory, 'bundle.js')
  renderedStylesPath = path.join(renderedTempDirectory, 'styles.css')
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
  const styles = spawnSync(path.resolve(process.cwd(), 'node_modules/.bin/tailwindcss'), [
    '-i',
    path.resolve(process.cwd(), 'src/app/globals.css'),
    '-o',
    renderedStylesPath,
    '--minify',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  assert.equal(styles.status, 0, styles.stderr || styles.stdout)
  renderedBrowser = await chromium.launch({ headless: true })
})

after(async () => {
  await renderedBrowser?.close()
  if (renderedTempDirectory) await rm(renderedTempDirectory, { recursive: true, force: true })
})

async function renderPage(viewport = { width: 1280, height: 900 }) {
  assert.ok(renderedBrowser)
  const page = await renderedBrowser.newPage({ viewport })
  page.setDefaultTimeout(5_000)
  const errors: string[] = []
  renderedPageErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
  await page.addStyleTag({ path: renderedStylesPath })
  await page.addScriptTag({ path: renderedBundlePath })
  return page
}

async function selectReviewStage(page: Page, label: '场景' | '节拍' | '镜头') {
  const navigation = page.getByRole('navigation', { name: 'Recipe 阶段' })
  await navigation.getByRole('button', { name: new RegExp(label) }).click()
  await page.getByRole('button', { name: '全部' }).click()
}

type RenderedHarness = {
  mountRecipe: (kind?: 'completed' | 'replacement' | 'sceneReview' | 'beatReview' | 'partialBatch') => void
  mountEmergencyRecipe: () => void
  replaceRecipe: (kind?: 'completed' | 'replacement') => void
  clickDetachedConfirm: () => void
  mountBoard: (mode?: 'matching' | 'blocking' | 'stale' | 'unavailable' | 'manual') => void
  switchBoardRecipe: () => void
  switchBoardContext: (kind: 'project' | 'workflow' | 'control' | 'replacement') => void
  unmountBoard: () => void
  failBoardCommit: () => void
  navigateFromBoard: (destination: string) => boolean
  mountLivePanel: () => void
  updateLivePanel: (patch: {
    open?: boolean
    openedFromRecipe?: boolean
    recipeKind?: 'completed' | 'replacement' | null
    controlNodeId?: string
    boardUpdatedAt?: string
    saveState?: 'local' | 'saving' | 'cloud' | 'failed'
  }) => void
  calls: () => string[]
  recipe: () => StoryboardDirectorRecipe
  boardState: () => StoryboardState
}

async function mountRenderedRecipe(
  page: Page,
  kind: 'completed' | 'sceneReview' | 'beatReview' | 'partialBatch' = 'completed',
) {
  await page.evaluate((fixture) => (
    window as unknown as { __directorHarness: RenderedHarness }
  ).__directorHarness.mountRecipe(fixture), kind)
  await page.waitForTimeout(50)
  if (await page.locator('#root').evaluate((element) => element.childElementCount) === 0) {
    throw new Error(`Rendered Recipe root is empty: ${(renderedPageErrors.get(page) ?? []).join(' | ')}`)
  }
}

async function mountRenderedEmergencyRecipe(page: Page) {
  await page.evaluate(() => (
    window as unknown as { __directorHarness: RenderedHarness }
  ).__directorHarness.mountEmergencyRecipe())
  await page.waitForTimeout(50)
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

async function mountRenderedLivePanel(page: Page) {
  await page.evaluate(() => (
    window as unknown as { __directorHarness: RenderedHarness }
  ).__directorHarness.mountLivePanel())
  await page.waitForTimeout(50)
}

async function updateRenderedLivePanel(
  page: Page,
  patch: Parameters<RenderedHarness['updateLivePanel']>[0],
) {
  await page.evaluate((value) => (
    window as unknown as { __directorHarness: RenderedHarness }
  ).__directorHarness.updateLivePanel(value), patch)
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

async function renderedBoardState(page: Page) {
  return page.evaluate(() => (
    window as unknown as { __directorHarness: RenderedHarness }
  ).__directorHarness.boardState())
}

async function setRenderedBoardDrafts(
  page: Page,
  values: { mood: string; directorNote: string },
) {
  await page.evaluate((next) => {
    const mood = document.querySelector('[aria-label="情绪"]') as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
      ?.set?.call(mood, next.mood)
    mood.dispatchEvent(new Event('input', { bubbles: true }))
    const note = document.querySelector('[aria-label="导演备注"]') as HTMLTextAreaElement
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
      ?.set?.call(note, next.directorNote)
    note.dispatchEvent(new Event('input', { bubbles: true }))
  }, values)
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
      shotType: {
        wide: 'ELS',
        full: 'LS',
        medium: 'MS',
        close: 'CU',
        'extreme-close': 'ECU',
      }[cleanDraft.suggestedShotSize],
      durationSec: cleanDraft.duration,
      directorNote: `${cleanDraft.objective}\n${cleanDraft.action}`.trim(),
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

  test('synchronization matches every Recipe-owned shot-board field', () => {
    const recipe = completedRecipe()
    const planned = planStoryboardDirectorShotBoardSync(
      recipe,
      { version: '2', shots: [], updatedAt: ISO_TIME },
      ISO_TIME,
    )
    const synchronized = planned.state.shots[0]
    assert.ok(synchronized)
    assert.equal(
      deriveStoryboardDirectorShotRecipeMarkers(synchronized, recipe)?.synchronization,
      'synchronized',
    )

    const divergence: Array<Partial<ShotCard>> = [
      { shotType: synchronized.shotType === 'ELS' ? 'CU' : 'ELS' },
      { durationSec: (synchronized.durationSec ?? 0) + 1 },
      { directorNote: `${synchronized.directorNote ?? ''}\nManual change` },
      { recipe: { ...synchronized.recipe!, recipeId: 'sdr1_manual-divergence' } },
      { recipe: { ...synchronized.recipe!, shotId: 'manual-shot-id' } },
      { recipe: { ...synchronized.recipe!, sourceArtifactId: 'manual-artifact-id' } },
      { recipe: { ...synchronized.recipe!, sceneId: 'manual-scene-id' } },
      { recipe: { ...synchronized.recipe!, beatId: 'manual-beat-id' } },
    ]
    for (const patch of divergence) {
      const markers = deriveStoryboardDirectorShotRecipeMarkers({
        ...synchronized,
        ...patch,
      }, recipe)
      assert.notEqual(markers?.synchronization, 'synchronized')
      assert.notEqual(markers?.quality, 'clean')
    }

    for (const status of ['needs-review', 'stale', 'blocked', 'idle'] as const) {
      const nonFinal = { ...recipe, shot: { ...recipe.shot, status } }
      const markers = deriveStoryboardDirectorShotRecipeMarkers(synchronized, nonFinal)
      assert.equal(markers?.synchronization, 'stale')
      assert.notEqual(markers?.quality, 'clean')
    }
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
  test('Recipe board text buffers existing fields until blur and Enter does not double commit', async () => {
    const page = await renderPage()
    try {
      await mountRenderedBoard(page, 'matching')
      assert.equal(await page.getByLabel('镜头标题').count(), 0)
      const mood = page.getByLabel('情绪')
      await mood.press('End')
      await mood.pressSequentially('abcdefghijklmnopqrst')
      assert.deepEqual(await renderedCalls(page), [])
      await mood.blur()
      assert.deepEqual(await renderedCalls(page), ['state-change'])

      await mountRenderedBoard(page, 'matching')
      const note = page.getByPlaceholder('镜头构图、情感要点、特别说明...')
      await note.press('End')
      await note.pressSequentially('abcdefghijklmnopqrst')
      assert.deepEqual(await renderedCalls(page), [])
      await note.press('Enter')
      await note.blur()
      assert.deepEqual(await renderedCalls(page), ['state-change'])
    } finally {
      await page.close()
    }
  })

  test('manual preexisting board text stays immediate while Recipe select and number changes commit once', async () => {
    const page = await renderPage()
    try {
      await mountRenderedBoard(page, 'manual')
      assert.equal(await page.getByLabel('镜头标题').count(), 0)
      const mood = page.getByLabel('情绪')
      await mood.press('End')
      await mood.pressSequentially('abcdefghijklmnopqrst')
      assert.equal((await renderedCalls(page)).length, 20)

      await mountRenderedBoard(page, 'matching')
      await page.getByLabel('景别').selectOption('CU')
      assert.deepEqual(await renderedCalls(page), ['state-change'])

      await mountRenderedBoard(page, 'matching')
      await page.getByLabel('时长 (秒)').fill('8')
      assert.deepEqual(await renderedCalls(page), ['state-change'])
    } finally {
      await page.close()
    }
  })

  test('backdrop and Close atomically flush two dirty Recipe fields once before closing', async () => {
    const page = await renderPage()
    try {
      await mountRenderedBoard(page, 'matching')
      const first = { mood: 'quiet dread', directorNote: 'Hold on the sealed case.' }
      await setRenderedBoardDrafts(page, first)
      await page.locator('[role="presentation"][data-storyboard-director="true"]').click({
        position: { x: 2, y: 2 },
      })
      assert.deepEqual(await renderedCalls(page), ['state-change', 'close'])
      assert.equal((await renderedBoardState(page)).shots[0]?.mood, first.mood)
      assert.equal((await renderedBoardState(page)).shots[0]?.directorNote, first.directorNote)

      await mountRenderedBoard(page, 'matching')
      const second = { mood: 'measured relief', directorNote: 'End on the antenna.' }
      await setRenderedBoardDrafts(page, second)
      await page.getByRole('button', { name: '关闭分镜导演' }).click()
      assert.deepEqual(await renderedCalls(page), ['state-change', 'close'])
      assert.equal((await renderedBoardState(page)).shots[0]?.mood, second.mood)
      assert.equal((await renderedBoardState(page)).shots[0]?.directorNote, second.directorNote)
    } finally {
      await page.close()
    }
  })

  test('Recipe, control, project, and workflow replacement atomically flush two dirty fields', async () => {
    const page = await renderPage()
    try {
      for (const kind of ['replacement', 'control', 'project', 'workflow'] as const) {
        await mountRenderedBoard(page, 'matching')
        const values = {
          mood: `${kind} mood remains`,
          directorNote: `${kind} note remains`,
        }
        await setRenderedBoardDrafts(page, values)
        await page.evaluate((value) => (
          window as unknown as { __directorHarness: RenderedHarness }
        ).__directorHarness.switchBoardContext(value), kind)
        await page.waitForTimeout(50)

        assert.deepEqual(await renderedCalls(page), ['state-change'])
        assert.equal((await renderedBoardState(page)).shots[0]?.mood, values.mood)
        assert.equal((await renderedBoardState(page)).shots[0]?.directorNote, values.directorNote)
      }
    } finally {
      await page.close()
    }
  })

  test('unmount atomically flushes two focused dirty Recipe fields exactly once', async () => {
    const page = await renderPage()
    try {
      await mountRenderedBoard(page, 'matching')
      const values = {
        mood: 'unmount mood',
        directorNote: 'Persist before unmount.',
      }
      await setRenderedBoardDrafts(page, values)
      await page.evaluate(() => (
        window as unknown as { __directorHarness: RenderedHarness }
      ).__directorHarness.unmountBoard())

      assert.deepEqual(await renderedCalls(page), ['state-change'])
      assert.equal((await renderedBoardState(page)).shots[0]?.mood, values.mood)
      assert.equal((await renderedBoardState(page)).shots[0]?.directorNote, values.directorNote)
    } finally {
      await page.close()
    }
  })

  test('failed dirty-field commit prevents an explicit close', async () => {
    const page = await renderPage()
    try {
      await mountRenderedBoard(page, 'matching')
      await setRenderedBoardDrafts(page, {
        mood: 'must not disappear',
        directorNote: 'must also remain',
      })
      await page.evaluate(() => (
        window as unknown as { __directorHarness: RenderedHarness }
      ).__directorHarness.failBoardCommit())
      await page.getByRole('button', { name: '关闭分镜导演' }).click()

      assert.deepEqual(await renderedCalls(page), ['state-change-failed'])
      assert.equal(await page.getByRole('dialog', { name: 'Storyboard Director' }).count(), 1)
    } finally {
      await page.close()
    }
  })

  test('each route exit flushes two dirty Recipe fields and blocks navigation on commit failure', async () => {
    const page = await renderPage()
    try {
      for (const destination of ['new-project', 'delivery', 'projects', 'project-center']) {
        await mountRenderedBoard(page, 'matching')
        await setRenderedBoardDrafts(page, {
          mood: `${destination} mood`,
          directorNote: `${destination} note`,
        })
        await page.evaluate(() => (
          window as unknown as { __directorHarness: RenderedHarness }
        ).__directorHarness.failBoardCommit())
        const navigated = await page.evaluate((nextDestination) => (
          window as unknown as { __directorHarness: RenderedHarness }
        ).__directorHarness.navigateFromBoard(nextDestination), destination)

        assert.equal(navigated, false, destination)
        assert.deepEqual(await renderedCalls(page), [
          'state-change-failed',
          `navigation-blocked:${destination}`,
        ], destination)
      }
    } finally {
      await page.close()
    }
  })

  test('reopened partial batch remains locked until the visible targeted acknowledgment', async () => {
    const page = await renderPage()
    try {
      await mountRenderedRecipe(page, 'partialBatch')
      await page.getByText(/已创建 1 个草稿节点/).waitFor()
      for (const label of ['落地审核结果', '同步镜头板', '创建草稿节点']) {
        assert.equal(await page.getByRole('button', { name: label }).isDisabled(), true)
      }
      assert.deepEqual(await renderedCalls(page), [])

      await page.getByRole('button', { name: '确认已检查此批次' }).click()
      assert.deepEqual(await renderedCalls(page), ['commit'])
      assert.equal(
        (await renderedRecipe(page)).findings.some(
          (item) => item.code === 'PARTIAL_MATERIALIZATION_BATCH',
        ),
        false,
      )
    } finally {
      await page.close()
    }
  })

  test('emergency partial lock disables apply until its explicit inspection acknowledgment', async () => {
    const page = await renderPage()
    try {
      await mountRenderedEmergencyRecipe(page)
      await page.getByText(/已创建 1 个草稿节点/).waitFor()
      for (const label of ['落地审核结果', '同步镜头板', '创建草稿节点']) {
        assert.equal(await page.getByRole('button', { name: label }).isDisabled(), true)
      }
      await page.getByRole('button', { name: '确认已检查此批次' }).click()
      const calls = await renderedCalls(page)
      assert.equal(calls.length, 1)
      assert.match(calls[0] ?? '', /^emergency-ack:sdrb1_/)
      assert.equal(await page.getByRole('button', { name: '落地审核结果' }).isEnabled(), true)
    } finally {
      await page.close()
    }
  })

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

  test('renders compact visible labels for every Recipe review control', async () => {
    const page = await renderPage()
    try {
      await mountRenderedRecipe(page)
      const labelsByStage = {
        '场景': ['场景标题', '场景地点', '场景时间', '场景角色', '场景动作摘要'],
        '节拍': ['节拍类型', '节拍摘要'],
        '镜头': ['镜头目标', '镜头主体', '镜头动作', '镜头景别', '输出类型', '镜头时长'],
      } as const

      for (const [stage, labels] of Object.entries(labelsByStage)) {
        await selectReviewStage(page, stage as keyof typeof labelsByStage)
        for (const label of labels) {
          const visibleLabel = page.locator('label').filter({ hasText: label }).first()
          assert.equal(await visibleLabel.isVisible(), true, `${label} must have a visible label`)
          assert.equal(await page.getByLabel(label).first().isVisible(), true)
        }
      }
    } finally {
      await page.close()
    }
  })

  test('Recipe replacement clears pending confirmation and detached drafts cannot commit to B', async () => {
    const page = await renderPage()
    try {
      await mountRenderedRecipe(page)
      await selectReviewStage(page, '场景')
      const heading = page.getByLabel('场景标题').first()
      await heading.fill('A-only pending heading')
      await heading.blur()
      await page.getByRole('button', { name: '确认修改' }).waitFor()

      await page.evaluate(() => (
        window as unknown as { __directorHarness: RenderedHarness }
      ).__directorHarness.replaceRecipe('replacement'))
      await page.waitForTimeout(50)

      assert.equal(await page.getByRole('button', { name: '确认修改' }).count(), 0)
      await page.evaluate(() => (
        window as unknown as { __directorHarness: RenderedHarness }
      ).__directorHarness.clickDetachedConfirm())
      assert.deepEqual(await renderedCalls(page), [])
      const replacement = await renderedRecipe(page)
      assert.equal(replacement.recipeId, 'sdr1_replacement')
      assert.notEqual(replacement.scene.drafts[0]?.heading, 'A-only pending heading')
      assert.deepEqual(renderedPageErrors.get(page), [])
    } finally {
      await page.close()
    }
  })

  test('live-open intent selects Recipe without overriding later manual board choice', async () => {
    const page = await renderPage()
    try {
      await mountRenderedLivePanel(page)
      const recipeTab = page.getByTestId('storyboard-director-tab-recipe')
      const boardTab = page.getByTestId('storyboard-director-tab-board')
      assert.equal(await boardTab.getAttribute('aria-selected'), 'true')

      await updateRenderedLivePanel(page, { openedFromRecipe: true })
      assert.equal(await recipeTab.getAttribute('aria-selected'), 'true')

      await boardTab.click()
      await updateRenderedLivePanel(page, {
        saveState: 'saving',
        boardUpdatedAt: '2026-07-19T01:05:00.000Z',
      })
      assert.equal(await boardTab.getAttribute('aria-selected'), 'true')

      await updateRenderedLivePanel(page, { controlNodeId: 'control-live-b' })
      assert.equal(await recipeTab.getAttribute('aria-selected'), 'true')

      await boardTab.click()
      await updateRenderedLivePanel(page, { open: false })
      await updateRenderedLivePanel(page, { open: true })
      assert.equal(await recipeTab.getAttribute('aria-selected'), 'true')
    } finally {
      await page.close()
    }
  })

  test('tabs and segmented controls expose selection and keyboard navigation', async () => {
    const page = await renderPage()
    try {
      await mountRenderedLivePanel(page)
      const recipeTab = page.getByTestId('storyboard-director-tab-recipe')
      const boardTab = page.getByTestId('storyboard-director-tab-board')

      assert.equal(await recipeTab.getAttribute('id'), 'storyboard-director-tab-recipe')
      assert.equal(await boardTab.getAttribute('id'), 'storyboard-director-tab-board')
      assert.equal(await recipeTab.getAttribute('aria-controls'), 'storyboard-director-panel-recipe')
      assert.equal(await boardTab.getAttribute('aria-controls'), 'storyboard-director-panel-board')
      const tabPanels = page.getByRole('tabpanel', { includeHidden: true })
      assert.equal(await tabPanels.count(), 2)
      assert.deepEqual(
        (await tabPanels.evaluateAll((elements) => elements.map((element) => element.id))).sort(),
        ['storyboard-director-panel-board', 'storyboard-director-panel-recipe'],
      )
      assert.equal(
        await page.getByRole('tabpanel').getAttribute('aria-labelledby'),
        'storyboard-director-tab-board',
      )

      await boardTab.focus()
      await boardTab.press('ArrowRight')
      assert.equal(await recipeTab.getAttribute('aria-selected'), 'true')
      assert.equal(await recipeTab.evaluate((element) => document.activeElement === element), true)
      await recipeTab.press('End')
      assert.equal(await boardTab.getAttribute('aria-selected'), 'true')
      await boardTab.press('Home')
      assert.equal(await recipeTab.getAttribute('aria-selected'), 'true')
      await recipeTab.press('ArrowLeft')
      assert.equal(await boardTab.getAttribute('aria-selected'), 'true')

      await page.setViewportSize({ width: 390, height: 844 })
      await recipeTab.click()
      const reviewFilter = page.getByRole('button', { name: '全部' })
      await reviewFilter.click()
      assert.equal(await reviewFilter.getAttribute('aria-pressed'), 'true')
      const reviewRegion = page.getByRole('button', { name: '审核', exact: true })
      assert.equal(await reviewRegion.getAttribute('aria-pressed'), 'true')
      const evidenceRegion = page.getByRole('button', { name: '证据', exact: true })
      await evidenceRegion.click()
      assert.equal(await reviewRegion.getAttribute('aria-pressed'), 'false')
      assert.equal(await evidenceRegion.getAttribute('aria-pressed'), 'true')
    } finally {
      await page.close()
    }
  })

  test('styled dialog stays safe, contained, and responsive at required viewports', async () => {
    const viewports = [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 720 },
      { width: 1440, height: 900 },
    ]

    for (const viewport of viewports) {
      const page = await renderPage(viewport)
      try {
        await mountRenderedBoard(page, 'matching')
        const dialog = page.getByRole('dialog', { name: 'Storyboard Director' })
        const box = await dialog.boundingBox()
        assert.ok(box)
        assert.ok(box.x >= 15.5, `${viewport.width}: left safe margin`)
        assert.ok(box.y >= 15.5, `${viewport.width}: top safe margin`)
        assert.ok(box.x + box.width <= viewport.width - 15.5, `${viewport.width}: right safe margin`)
        assert.ok(box.y + box.height <= viewport.height - 15.5, `${viewport.width}: bottom safe margin`)

        const overflow = await page.evaluate(() => ({
          viewport: document.documentElement.scrollWidth - window.innerWidth,
          dialog: (() => {
            const element = document.querySelector('[role="dialog"]') as HTMLElement
            return element.scrollWidth - element.clientWidth
          })(),
        }))
        assert.ok(overflow.viewport <= 0, `${viewport.width}: viewport horizontal overflow`)
        assert.ok(overflow.dialog <= 0, `${viewport.width}: dialog horizontal overflow`)

        const detailDirection = await page.getByTestId('storyboard-board-detail').evaluate(
          (element) => getComputedStyle(element).flexDirection,
        )
        assert.equal(detailDirection, viewport.width < 1024 ? 'column' : 'row')
        assert.equal(
          await page.getByTestId('storyboard-board-scroll').evaluate(
            (element) => getComputedStyle(element).overflowY,
          ),
          'auto',
        )

        const contentFits = await dialog.locator('button:visible, label:visible').evaluateAll((elements) => (
          elements.every((item) => {
            const element = item as HTMLElement
            return element.scrollWidth <= element.clientWidth + 1
          })
        ))
        assert.equal(contentFits, true, `${viewport.width}: board text and button containment`)

        const titleBox = await page.getByRole('heading', { name: '分镜导演' }).boundingBox()
        const closeBox = await page.getByRole('button', { name: '关闭分镜导演' }).boundingBox()
        const tabListBox = await page.getByRole('tablist', { name: '分镜导演视图' }).boundingBox()
        assert.ok(titleBox && closeBox && tabListBox)
        if (viewport.width === 390) {
          assert.ok(closeBox.x > viewport.width / 2, 'mobile Close must be anchored right')
          assert.ok(Math.abs(closeBox.y - titleBox.y) < 16, 'mobile title and Close share row one')
          assert.ok(tabListBox.y >= titleBox.y + titleBox.height, 'mobile tabs occupy row two')
          assert.equal(await page.getByText('本地已保留', { exact: true }).isVisible(), true)
        } else if (viewport.width >= 1024) {
          assert.ok(tabListBox.y < titleBox.y + titleBox.height, 'desktop header stays compact')
        }

        await page.getByTestId('storyboard-director-tab-recipe').click()
        const recipePanel = page.locator('#storyboard-director-panel-recipe')
        assert.equal(await recipePanel.isVisible(), true)
        assert.ok(
          await recipePanel.evaluate((element) => element.scrollWidth <= element.clientWidth),
          `${viewport.width}: Recipe horizontal containment`,
        )
        assert.equal(
          await recipePanel.locator('button:visible, label:visible').evaluateAll((elements) => (
            elements.every((item) => {
              const element = item as HTMLElement
              return element.scrollWidth <= element.clientWidth + 1
            })
          )),
          true,
          `${viewport.width}: Recipe text and button containment`,
        )
        assert.deepEqual(renderedPageErrors.get(page), [])
      } finally {
        await page.close()
      }
    }
  })
})
