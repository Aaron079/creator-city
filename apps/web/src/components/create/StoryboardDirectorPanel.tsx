'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { ShotCard, StoryboardState } from '@/lib/storyboard/types'
import {
  createShotCard,
  reindexShots,
  type LegacyDirectorStateReadResult,
} from '@/lib/storyboard/director'
import { analyzeStoryboardDirectorRecipe } from '@/lib/storyboard/recipe/intelligence'
import type {
  StoryboardDirectorFinding,
  StoryboardDirectorPartialBatch,
  StoryboardDirectorRecipe,
} from '@/lib/storyboard/recipe/types'
import { StoryboardTimeline } from './StoryboardTimeline'
import {
  StoryboardDirectorRecipePanel,
  type StoryboardDirectorRecipePanelProps,
} from './StoryboardDirectorRecipePanel'

const SHOT_TYPE_OPTIONS = [
  { value: '', label: '选择景别' },
  { value: 'ELS', label: '大远景 ELS' },
  { value: 'LS', label: '远景 LS' },
  { value: 'MS', label: '中景 MS' },
  { value: 'MCU', label: '中近景 MCU' },
  { value: 'CU', label: '近景 CU' },
  { value: 'ECU', label: '特写 ECU' },
]

const CAMERA_MOVEMENT_OPTIONS = [
  { value: '', label: '选择运镜' },
  { value: 'static', label: '固定' },
  { value: 'pan', label: '横摇 Pan' },
  { value: 'tilt', label: '纵摇 Tilt' },
  { value: 'dolly', label: '推拉 Dolly' },
  { value: 'zoom', label: '变焦 Zoom' },
  { value: 'handheld', label: '手持 Handheld' },
  { value: 'drone', label: '航拍 Drone' },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 6,
  padding: '6px 10px',
  color: 'rgba(255,255,255,0.88)',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 4,
}

export type StoryboardDirectorPanelTab = 'recipe' | 'board'

const PANEL_TABS: StoryboardDirectorPanelTab[] = ['recipe', 'board']
const PANEL_TAB_IDS = {
  recipe: 'storyboard-director-tab-recipe',
  board: 'storyboard-director-tab-board',
} as const
const PANEL_IDS = {
  recipe: 'storyboard-director-panel-recipe',
  board: 'storyboard-director-panel-board',
} as const
const SAVE_LABELS = {
  local: '本地已保留',
  saving: '同步中',
  cloud: '已同步到云端',
  failed: '云端保存失败',
} as const

export interface StoryboardDirectorPanelProps {
  open: boolean
  state: StoryboardState
  activeShotId: string | null
  boardCommitMode: 'immediate' | 'buffered'
  recipe: StoryboardDirectorRecipe | null
  openedFromRecipe: boolean
  availableSources: Array<{ id: string; title: string }>
  availableRecipes: Array<{ nodeId: string; recipeId: string; title: string; status: string }>
  saveState: 'local' | 'saving' | 'cloud' | 'failed'
  legacyState: LegacyDirectorStateReadResult
  emergencyPartialBatch: StoryboardDirectorPartialBatch | null
  projectId?: string
  canvasNodes?: Array<{ id: string; kind: string; title?: string; resultImageUrl?: string; resultVideoUrl?: string }>
  onStateChange: (state: StoryboardState) => boolean | void
  onActiveShotChange: (id: string | null) => void
  onStartRecipe: (sourceNodeId: string) => void
  onOpenRecipe: (controlNodeId: string) => void
  onCommitRecipe: (recipe: StoryboardDirectorRecipe) => void
  onFocusSource: (sourceNodeId: string) => void
  onMaterializeGrouped: StoryboardDirectorRecipePanelProps['onMaterializeGrouped']
  onSyncShotBoard: () => void
  onCreateDraftNodes: () => void
  onImportLegacy: () => void
  onAcknowledgeEmergencyPartialBatch: (batchId: string) => void
  registerDeferredBoardFlush: (
    flush: () => boolean,
  ) => () => void
  onClose: () => void
}

function now() {
  return new Date().toISOString()
}

function patchState(state: StoryboardState, shots: ShotCard[]): StoryboardState {
  return { ...state, shots, updatedAt: now() }
}

export function createStoryboardDirectorPanelState({
  hasRecipe,
  openedFromRecipe,
}: {
  hasRecipe: boolean
  openedFromRecipe: boolean
}) {
  return { tab: hasRecipe && openedFromRecipe ? 'recipe' as const : 'board' as const }
}

export function selectStoryboardDirectorTab<T extends { tab: StoryboardDirectorPanelTab }>(
  state: T,
  tab: StoryboardDirectorPanelTab,
): T {
  return state.tab === tab ? state : { ...state, tab }
}

export type StoryboardDirectorRecipeControl = {
  nodeId: string
  recipeId: string
  title: string
  status: string
}

export function findStoryboardDirectorRecipeControl(
  availableRecipes: StoryboardDirectorRecipeControl[],
  recipeId: string,
) {
  return availableRecipes.find((candidate) => candidate.recipeId === recipeId) ?? null
}

export type StoryboardDirectorShotRecipeMarkers = {
  synchronization: 'synchronized' | 'stale' | 'unavailable'
  quality: 'blocking' | 'advisory' | 'stale' | 'clean' | 'unavailable'
}

function findingAppliesToShot(
  finding: StoryboardDirectorFinding,
  provenance: NonNullable<ShotCard['recipe']>,
) {
  if (finding.sceneId && finding.sceneId !== provenance.sceneId) return false
  if (finding.beatId && finding.beatId !== provenance.beatId) return false
  if (finding.shotId && finding.shotId !== provenance.shotId) return false
  return true
}

export function deriveStoryboardDirectorShotRecipeMarkers(
  shot: ShotCard,
  recipe: StoryboardDirectorRecipe | null,
): StoryboardDirectorShotRecipeMarkers | null {
  const provenance = shot.recipe
  if (!provenance) return null
  if (!recipe || recipe.recipeId !== provenance.recipeId) {
    return { synchronization: 'unavailable', quality: 'unavailable' }
  }

  const approvedDraft = recipe.shot.drafts.find((draft) => (
    draft.decision === 'approved'
    && draft.shotId === provenance.shotId
    && draft.sceneId === provenance.sceneId
    && draft.beatId === provenance.beatId
  ))
  const analyzedFindings = analyzeStoryboardDirectorRecipe(recipe)
  const expectedShotType = approvedDraft ? {
    wide: 'ELS',
    full: 'LS',
    medium: 'MS',
    close: 'CU',
    'extreme-close': 'ECU',
  }[approvedDraft.suggestedShotSize] : undefined
  const expectedDirectorNote = approvedDraft
    ? `${approvedDraft.objective}\n${approvedDraft.action}`.trim()
    : undefined
  const synchronization = recipe.shot.status === 'approved'
    && approvedDraft
    && recipe.shot.approvedArtifact?.artifactId === provenance.sourceArtifactId
    && shot.shotType === expectedShotType
    && shot.durationSec === approvedDraft.duration
    && shot.directorNote === expectedDirectorNote
    && provenance.recipeId === recipe.recipeId
    && provenance.sourceArtifactId === recipe.shot.approvedArtifact.artifactId
    && provenance.sceneId === approvedDraft.sceneId
    && provenance.beatId === approvedDraft.beatId
    && provenance.shotId === approvedDraft.shotId
    ? 'synchronized'
    : 'stale'
  const findings = [...recipe.findings, ...analyzedFindings].filter((finding) => (
    findingAppliesToShot(finding, provenance)
  ))
  const quality = findings.some((finding) => finding.severity === 'blocking')
    ? 'blocking'
    : findings.some((finding) => finding.severity === 'advisory')
      ? 'advisory'
      : synchronization === 'stale'
        || recipe.scene.status !== 'approved'
        || recipe.beat.status !== 'approved'
        || recipe.shot.status !== 'approved'
        ? 'stale'
        : 'clean'
  return { synchronization, quality }
}

export function patchStoryboardDirectorShot(
  state: StoryboardState,
  shotId: string,
  patch: Partial<ShotCard>,
  updatedAt: string,
): StoryboardState {
  let changed = false
  const shots = state.shots.map((shot) => {
    if (shot.id !== shotId) return shot
    changed = true
    return { ...shot, ...patch, updatedAt }
  })
  return changed ? { ...state, shots, updatedAt } : state
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  )
}

function BoardTextControl({
  fieldId,
  value,
  mode,
  ariaLabel,
  placeholder,
  multiline = false,
  registerDeferredCommit,
  onCommit,
}: {
  fieldId: string
  value: string
  mode: 'immediate' | 'buffered'
  ariaLabel: string
  placeholder: string
  multiline?: boolean
  registerDeferredCommit: (fieldId: string, flush: () => boolean) => () => void
  onCommit: (value: string) => boolean | void
}) {
  const [draft, setDraft] = useState(value)
  const skipNextBlur = useRef(false)
  const draftRef = useRef(value)
  const committedRef = useRef(value)
  const dirtyRef = useRef(false)
  const modeRef = useRef(mode)
  const onCommitRef = useRef(onCommit)
  const dirtyCommitRef = useRef(onCommit)
  const flushRef = useRef<() => boolean>(() => true)
  const skipNextRegisteredFlush = useRef(false)

  modeRef.current = mode
  onCommitRef.current = onCommit

  useEffect(() => {
    if (!dirtyRef.current) {
      draftRef.current = value
      committedRef.current = value
      setDraft(value)
    }
    skipNextBlur.current = false
  }, [value])

  const handleChange = (next: string) => {
    draftRef.current = next
    setDraft(next)
    if (mode === 'immediate') {
      const committed = onCommitRef.current(next) !== false
      if (committed) committedRef.current = next
      dirtyRef.current = !committed
      return
    }
    if (!dirtyRef.current) dirtyCommitRef.current = onCommitRef.current
    dirtyRef.current = next !== committedRef.current
  }
  const commitBuffered = () => {
    if (modeRef.current !== 'buffered' || !dirtyRef.current) return true
    const next = draftRef.current
    if (dirtyCommitRef.current(next) === false) {
      dirtyCommitRef.current = onCommitRef.current
      return false
    }
    committedRef.current = next
    dirtyRef.current = false
    return true
  }
  flushRef.current = commitBuffered

  useEffect(() => registerDeferredCommit(
    fieldId,
    () => {
      if (skipNextRegisteredFlush.current) {
        skipNextRegisteredFlush.current = false
        return false
      }
      return flushRef.current()
    },
  ), [fieldId, registerDeferredCommit])

  useEffect(() => () => {
    flushRef.current()
  }, [])

  const handleBlur = () => {
    if (skipNextBlur.current) {
      skipNextBlur.current = false
      return
    }
    if (!flushRef.current()) skipNextRegisteredFlush.current = true
  }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || mode !== 'buffered') return
    event.preventDefault()
    if (!dirtyRef.current) return
    if (flushRef.current()) skipNextBlur.current = true
  }
  const props = {
    'aria-label': ariaLabel,
    placeholder,
    value: draft,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => handleChange(event.target.value),
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
  }
  return multiline ? (
    <textarea
      {...props}
      rows={3}
      style={{
        ...inputStyle,
        resize: 'vertical',
        lineHeight: 1.6,
        fontFamily: 'inherit',
        minHeight: 64,
      }}
    />
  ) : <input {...props} type="text" style={inputStyle} />
}

export function StoryboardDirectorPanel({
  open,
  state,
  activeShotId,
  boardCommitMode,
  recipe,
  openedFromRecipe,
  availableSources,
  availableRecipes,
  saveState,
  legacyState,
  emergencyPartialBatch,
  canvasNodes = [],
  onStateChange,
  onActiveShotChange,
  onStartRecipe,
  onOpenRecipe,
  onCommitRecipe,
  onFocusSource,
  onMaterializeGrouped,
  onSyncShotBoard,
  onCreateDraftNodes,
  onImportLegacy,
  onAcknowledgeEmergencyPartialBatch,
  registerDeferredBoardFlush,
  onClose,
}: StoryboardDirectorPanelProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [panelState, setPanelState] = useState(() => createStoryboardDirectorPanelState({
    hasRecipe: Boolean(recipe),
    openedFromRecipe,
  }))
  const wasOpen = useRef(false)
  const previousOpenedFromRecipe = useRef(openedFromRecipe)
  const matchingRecipeControl = recipe
    ? findStoryboardDirectorRecipeControl(availableRecipes, recipe.recipeId)
    : null
  const activeRecipeIdentity = recipe
    ? `${recipe.recipeId}:${matchingRecipeControl?.nodeId ?? ''}`
    : null
  const previousRecipeIdentity = useRef(activeRecipeIdentity)
  const tabRefs = useRef<Partial<Record<StoryboardDirectorPanelTab, HTMLButtonElement | null>>>({})
  const deferredBoardCommitsRef = useRef(new Map<string, () => boolean>())
  const registerDeferredCommit = useCallback((fieldId: string, flush: () => boolean) => {
    deferredBoardCommitsRef.current.set(fieldId, flush)
    return () => {
      if (deferredBoardCommitsRef.current.get(fieldId) === flush) {
        deferredBoardCommitsRef.current.delete(fieldId)
      }
    }
  }, [])
  const flushDeferredBoardDrafts = useCallback(() => {
    let committed = true
    for (const flush of deferredBoardCommitsRef.current.values()) {
      if (!flush()) committed = false
    }
    return committed
  }, [])

  useEffect(() => registerDeferredBoardFlush(
    flushDeferredBoardDrafts,
  ), [flushDeferredBoardDrafts, registerDeferredBoardFlush])

  useEffect(() => {
    const justOpened = open && !wasOpen.current
    const openedFromRecipeChanged = open
      && wasOpen.current
      && !previousOpenedFromRecipe.current
      && openedFromRecipe
    const activeRecipeChanged = open
      && wasOpen.current
      && activeRecipeIdentity !== null
      && activeRecipeIdentity !== previousRecipeIdentity.current
    if (justOpened) {
      setPanelState(createStoryboardDirectorPanelState({
        hasRecipe: Boolean(recipe),
        openedFromRecipe,
      }))
    } else if (openedFromRecipeChanged || activeRecipeChanged) {
      setPanelState((current) => selectStoryboardDirectorTab(current, 'recipe'))
    }
    wasOpen.current = open
    previousOpenedFromRecipe.current = openedFromRecipe
    previousRecipeIdentity.current = activeRecipeIdentity
  }, [activeRecipeIdentity, open, openedFromRecipe, recipe])

  if (!open) return null

  const { shots } = state
  const activeShot = activeShotId ? shots.find((s) => s.id === activeShotId) ?? null : null

  const updateShot = (id: string, patch: Partial<ShotCard>) => {
    return onStateChange(patchStoryboardDirectorShot(state, id, patch, now()))
  }
  const requestClose = () => {
    if (!flushDeferredBoardDrafts()) return
    onClose()
  }

  const handleAddShot = () => {
    const newShot = createShotCard(shots.length)
    const nextShots = [...shots, newShot]
    onStateChange(patchState(state, nextShots))
    onActiveShotChange(newShot.id)
  }

  const handleReorder = (reorderedShots: ShotCard[]) => {
    onStateChange(patchState(state, reorderedShots))
  }

  const handleDeleteShot = (id: string) => {
    const nextShots = reindexShots(shots.filter((s) => s.id !== id))
    onStateChange(patchState(state, nextShots))
    if (activeShotId === id) onActiveShotChange(nextShots[0]?.id ?? null)
    setConfirmDeleteId(null)
  }

  const boundNodes = activeShot
    ? canvasNodes.filter((n) => activeShot.nodeIds.includes(n.id))
    : []
  const activeRecipeControl = activeShot?.recipe
    ? findStoryboardDirectorRecipeControl(availableRecipes, activeShot.recipe.recipeId)
    : null
  const activeRecipeMarkers = activeShot
    ? deriveStoryboardDirectorShotRecipeMarkers(activeShot, recipe)
    : null
  const selectTab = (tab: StoryboardDirectorPanelTab, focus = false) => {
    setPanelState((current) => selectStoryboardDirectorTab(current, tab))
    if (focus) requestAnimationFrame(() => tabRefs.current[tab]?.focus())
  }
  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: StoryboardDirectorPanelTab,
  ) => {
    let nextTab: StoryboardDirectorPanelTab | null = null
    const currentIndex = PANEL_TABS.indexOf(currentTab)
    if (event.key === 'ArrowRight') {
      nextTab = PANEL_TABS[(currentIndex + 1) % PANEL_TABS.length]!
    } else if (event.key === 'ArrowLeft') {
      nextTab = PANEL_TABS[(currentIndex - 1 + PANEL_TABS.length) % PANEL_TABS.length]!
    } else if (event.key === 'Home') {
      nextTab = PANEL_TABS[0]!
    } else if (event.key === 'End') {
      nextTab = PANEL_TABS[PANEL_TABS.length - 1]!
    }
    if (!nextTab) return
    event.preventDefault()
    selectTab(nextTab, true)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.18)',
      }}
      role="presentation"
      data-no-node-drag="true"
      data-storyboard-director="true"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) requestClose()
      }}
      onWheel={(e) => e.stopPropagation()}
      onWheelCapture={(e) => e.stopPropagation()}
    >
      <aside
        style={{
          margin: 16,
          display: 'flex',
          flexDirection: 'column',
          width: 'min(1120px, calc(100vw - 32px))',
          height: 'min(88vh, calc(100dvh - 32px))',
          maxHeight: '88vh',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.10)',
          background: 'rgba(10,12,16,0.97)',
          color: 'white',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
          backdropFilter: 'blur(20px)',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Storyboard Director"
        data-no-node-drag="true"
        data-storyboard-director="true"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onWheelCapture={(e) => e.stopPropagation()}
      >
        <header
          data-testid="storyboard-director-header"
          className="grid flex-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-white/[0.08] px-4 py-3 sm:grid-cols-[minmax(120px,1fr)_auto_minmax(120px,1fr)]"
        >
          <div className="min-w-[120px]">
            <p className="mb-0.5 text-[9px] font-semibold uppercase text-cyan-200/45">Storyboard Director</p>
            <h2 className="m-0 text-[15px] font-semibold text-white">分镜导演</h2>
          </div>
          <div className="col-span-2 row-start-2 flex min-w-0 items-center justify-between gap-3 sm:col-span-1 sm:col-start-2 sm:row-start-1">
            <div className="grid h-9 min-w-[164px] grid-cols-2 rounded-md border border-white/10 bg-white/[0.025] p-0.5" role="tablist" aria-label="分镜导演视图">
              <button
                ref={(element) => { tabRefs.current.recipe = element }}
                id={PANEL_TAB_IDS.recipe}
                type="button"
                role="tab"
                aria-controls={PANEL_IDS.recipe}
                aria-selected={panelState.tab === 'recipe'}
                tabIndex={panelState.tab === 'recipe' ? 0 : -1}
                data-testid="storyboard-director-tab-recipe"
                onClick={() => selectTab('recipe')}
                onKeyDown={(event) => handleTabKeyDown(event, 'recipe')}
                className={`min-w-0 rounded px-3 text-[10px] font-semibold transition ${panelState.tab === 'recipe' ? 'bg-white/[0.11] text-white' : 'text-white/42 hover:text-white/70'}`}
              >
                Recipe
              </button>
              <button
                ref={(element) => { tabRefs.current.board = element }}
                id={PANEL_TAB_IDS.board}
                type="button"
                role="tab"
                aria-controls={PANEL_IDS.board}
                aria-selected={panelState.tab === 'board'}
                tabIndex={panelState.tab === 'board' ? 0 : -1}
                data-testid="storyboard-director-tab-board"
                onClick={() => selectTab('board')}
                onKeyDown={(event) => handleTabKeyDown(event, 'board')}
                className={`min-w-0 rounded px-3 text-[10px] font-semibold transition ${panelState.tab === 'board' ? 'bg-white/[0.11] text-white' : 'text-white/42 hover:text-white/70'}`}
              >
                镜头板
              </button>
            </div>
            <span className={`min-w-0 truncate text-right text-[9px] font-semibold ${saveState === 'failed' ? 'text-rose-200' : saveState === 'cloud' ? 'text-emerald-200' : 'text-white/38'}`}>
              {SAVE_LABELS[saveState]}
            </span>
          </div>
          <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 sm:col-start-3">
            {panelState.tab === 'board' ? (
              <button type="button" onClick={handleAddShot} title="新建镜头" aria-label="新建镜头" className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-200/30 bg-cyan-200/[0.08] text-cyan-100">
                <Plus size={15} aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" onClick={requestClose} title="关闭分镜导演" aria-label="关闭分镜导演" className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.09] hover:text-white">
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </header>

        {panelState.tab === 'board' ? (
          <div
            id={PANEL_IDS.board}
            role="tabpanel"
            aria-labelledby={PANEL_TAB_IDS.board}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >

        {/* Timeline */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {shots.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 24px',
              gap: 10,
            }}>
              <span style={{ fontSize: 32, opacity: 0.2 }}>🎬</span>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
                还没有镜头卡。点击 ＋ 新建镜头 开始构建分镜。
              </p>
            </div>
          ) : (
            <StoryboardTimeline
              shots={shots}
              activeShotId={activeShotId}
              onSelectShot={(id) => onActiveShotChange(id)}
              onReorder={handleReorder}
              onAddShot={handleAddShot}
            />
          )}
        </div>

        {/* Detail area */}
        <div data-testid="storyboard-board-scroll" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {activeShot ? (
            <div data-testid="storyboard-board-detail" className="flex min-h-0 flex-1 flex-col lg:flex-row">
              {/* Left: shot fields */}
              <div className="min-w-0 flex-1 border-b border-white/[0.07] lg:overflow-auto lg:border-b-0 lg:border-r" style={{
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                    {activeShot.title} 镜头详情
                  </span>
                  {confirmDeleteId === activeShot.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteShot(activeShot.id)}
                        style={{ fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                      >
                        确认删除
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(activeShot.id)}
                      style={{ fontSize: 11, color: 'rgba(248,113,113,0.65)', background: 'transparent', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                    >
                      删除镜头
                    </button>
                  )}
                </div>

                {activeShot.recipe ? (
                  <div className="flex min-h-9 flex-wrap items-center gap-2 border-y border-cyan-200/10 py-2">
                    <button
                      type="button"
                      disabled={!activeRecipeControl}
                      onClick={() => {
                        if (!activeRecipeControl) return
                        onOpenRecipe(activeRecipeControl.nodeId)
                        setPanelState((current) => selectStoryboardDirectorTab(current, 'recipe'))
                      }}
                      className="h-7 rounded-md border border-cyan-200/20 bg-cyan-200/[0.06] px-2 text-[9px] font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-white/30"
                    >
                      {activeRecipeControl ? `Recipe ${activeShot.recipe.recipeId}` : 'Recipe 不可用'}
                    </button>
                    {activeRecipeMarkers?.synchronization === 'synchronized' ? (
                      <span className="rounded border border-emerald-300/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200">已同步</span>
                    ) : activeRecipeMarkers?.synchronization === 'stale' ? (
                      <span className="rounded border border-amber-300/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">已过期</span>
                    ) : null}
                    {activeRecipeMarkers?.quality === 'blocking' ? (
                      <span className="rounded border border-rose-300/20 px-1.5 py-0.5 text-[9px] font-semibold text-rose-200">阻塞</span>
                    ) : activeRecipeMarkers?.quality === 'advisory' ? (
                      <span className="rounded border border-amber-300/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">建议</span>
                    ) : activeRecipeMarkers?.quality === 'clean' ? (
                      <span className="rounded border border-emerald-300/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200">检查通过</span>
                    ) : null}
                    <span className="text-[9px] text-white/35">{activeShot.recipe.sceneId} · {activeShot.recipe.beatId ?? '无节拍'} · {activeShot.recipe.shotId}</span>
                  </div>
                ) : null}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FieldRow label="景别">
                    <select
                      aria-label="景别"
                      value={activeShot.shotType ?? ''}
                      onChange={(e) => updateShot(activeShot.id, { shotType: e.target.value || undefined })}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      {SHOT_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </FieldRow>

                  <FieldRow label="时长 (秒)">
                    <input
                      aria-label="时长 (秒)"
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="例: 5"
                      value={activeShot.durationSec ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? undefined : Number(e.target.value)
                        updateShot(activeShot.id, { durationSec: val })
                      }}
                      style={inputStyle}
                    />
                  </FieldRow>

                  <FieldRow label="情绪">
                    <BoardTextControl
                      key={`${activeRecipeIdentity ?? 'manual'}:${activeShot.id}:mood`}
                      fieldId={`${activeRecipeIdentity ?? 'manual'}:${activeShot.id}:mood`}
                      value={activeShot.mood ?? ''}
                      mode={boardCommitMode}
                      ariaLabel="情绪"
                      placeholder="例: 紧张 / 孤独 / 宏大"
                      registerDeferredCommit={registerDeferredCommit}
                      onCommit={(value) => updateShot(activeShot.id, { mood: value || undefined })}
                    />
                  </FieldRow>

                  <FieldRow label="运镜">
                    <select
                      aria-label="运镜"
                      value={activeShot.cameraMovement ?? ''}
                      onChange={(e) => updateShot(activeShot.id, { cameraMovement: e.target.value || undefined })}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      {CAMERA_MOVEMENT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </FieldRow>
                </div>

                <FieldRow label="导演备注">
                  <BoardTextControl
                    key={`${activeRecipeIdentity ?? 'manual'}:${activeShot.id}:director-note`}
                    fieldId={`${activeRecipeIdentity ?? 'manual'}:${activeShot.id}:director-note`}
                    value={activeShot.directorNote ?? ''}
                    mode={boardCommitMode}
                    ariaLabel="导演备注"
                    placeholder="镜头构图、情感要点、特别说明..."
                    multiline
                    registerDeferredCommit={registerDeferredCommit}
                    onCommit={(value) => updateShot(activeShot.id, { directorNote: value || undefined })}
                  />
                </FieldRow>
              </div>

              {/* Right: bound nodes */}
              <div className="w-full flex-none lg:w-[220px] lg:overflow-auto" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={labelStyle}>已绑定节点 ({activeShot.nodeIds.length})</span>
                {boundNodes.length === 0 ? (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, margin: 0 }}>
                    在画布节点上点击【加入分镜】绑定节点。
                  </p>
                ) : (
                  boundNodes.map((n) => (
                    <div key={n.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 7,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)',
                    }}>
                      <span style={{ fontSize: 12, opacity: 0.55, flexShrink: 0 }}>
                        {n.kind === 'image' ? '◫' : n.kind === 'video' ? '▻' : '✦'}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {n.title || n.id.slice(0, 8)}
                      </span>
                      <button
                        type="button"
                        title="移除绑定"
                        aria-label="移除绑定"
                        onClick={() => {
                          const nodeIds = activeShot.nodeIds.filter((id) => id !== n.id)
                          const thumbnailUrl = n.id === canvasNodes.find((cn) => cn.id === activeShot.thumbnailUrl)?.id
                            ? nodeIds.find((id) => {
                                const cn = canvasNodes.find((c) => c.id === id)
                                return cn?.kind === 'image' || cn?.kind === 'video'
                              }) ?? undefined
                            : activeShot.thumbnailUrl
                          updateShot(activeShot.id, { nodeIds, thumbnailUrl })
                        }}
                        style={{ color: 'rgba(255,255,255,0.3)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 1, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 32 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.7, margin: 0 }}>
                {shots.length === 0
                  ? '点击 "＋ 新建镜头" 创建第一个镜头卡。'
                  : '点击上方镜头卡选择并编辑镜头信息。'}
              </p>
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div style={{
          padding: '8px 18px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          columnGap: 18,
          rowGap: 4,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            共 {shots.length} 个镜头
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            总时长 {shots.reduce((sum, s) => sum + (s.durationSec ?? 0), 0).toFixed(1)}s
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            绑定节点 {new Set(shots.flatMap((s) => s.nodeIds)).size}
          </span>
        </div>
          </div>
        ) : (
          <div
            id={PANEL_IDS.recipe}
            role="tabpanel"
            aria-labelledby={PANEL_TAB_IDS.recipe}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <StoryboardDirectorRecipePanel
              recipe={recipe}
              availableSources={availableSources}
              availableRecipes={availableRecipes}
              saveState={saveState}
              legacyState={legacyState}
              emergencyPartialBatch={emergencyPartialBatch}
              onStartRecipe={onStartRecipe}
              onOpenRecipe={onOpenRecipe}
              onCommitRecipe={onCommitRecipe}
              onFocusSource={onFocusSource}
              onMaterializeGrouped={onMaterializeGrouped}
              onSyncShotBoard={onSyncShotBoard}
              onCreateDraftNodes={onCreateDraftNodes}
              onImportLegacy={onImportLegacy}
              onAcknowledgeEmergencyPartialBatch={onAcknowledgeEmergencyPartialBatch}
            />
          </div>
        )}
        {panelState.tab !== 'board' ? (
          <div
            id={PANEL_IDS.board}
            role="tabpanel"
            aria-labelledby={PANEL_TAB_IDS.board}
            hidden
          />
        ) : null}
        {panelState.tab !== 'recipe' ? (
          <div
            id={PANEL_IDS.recipe}
            role="tabpanel"
            aria-labelledby={PANEL_TAB_IDS.recipe}
            hidden
          />
        ) : null}
      </aside>
    </div>
  )
}
