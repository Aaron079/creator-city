'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type * as React from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileSearch,
  RefreshCw,
  X,
} from 'lucide-react'
import { runCreatorSkill, type CreatorSkillReviewStatus } from '@/lib/skills'
import type { LegacyDirectorStateReadResult } from '@/lib/storyboard/director'
import {
  analyzeStoryboardDirectorRecipe,
  summarizeStoryboardDirectorRecipe,
} from '@/lib/storyboard/recipe/intelligence'
import {
  approveBeatStage,
  approveSceneStage,
  approveShotStage,
  changeImpactForStage,
  moveRecipeDraft,
  rerunRecipeStage,
  setRecipeDecision,
  updateRecipeDraft,
  type StoryboardRecipeSkillRunner,
} from '@/lib/storyboard/recipe/state-machine'
import type {
  StoryboardDirectorFinding,
  StoryboardDirectorRecipe,
  StoryboardDirectorStageId,
} from '@/lib/storyboard/recipe/types'
import type { StoryboardState } from '@/lib/storyboard/types'

type ReviewStageId = Exclude<StoryboardDirectorStageId, 'source'>
type ReviewFilter = 'pending' | 'warnings' | 'approved' | 'rejected' | 'all'
export type RecipeWorkspaceRegion = 'stages' | 'review' | 'evidence'

export type StoryboardDirectorRecipePanelProps = {
  recipe: StoryboardDirectorRecipe | null
  availableSources: Array<{ id: string; title: string }>
  availableRecipes: Array<{ nodeId: string; recipeId: string; title: string; status: string }>
  saveState: 'local' | 'saving' | 'cloud' | 'failed'
  legacyState: LegacyDirectorStateReadResult
  onStartRecipe: (sourceNodeId: string) => void
  onOpenRecipe: (controlNodeId: string) => void
  onCommitRecipe: (recipe: StoryboardDirectorRecipe) => void
  onFocusSource: (sourceNodeId: string) => void
  onMaterializeGrouped: (kinds: Array<'scene' | 'beat' | 'shot-plan'>) => void
  onSyncShotBoard: () => void
  onCreateDraftNodes: () => void
  onImportLegacy: () => void
}

export type RecipeFieldDraft = {
  value: string
  committedValue: string
  skipNextBlur: boolean
}

export function createRecipeFieldDraft(value: string): RecipeFieldDraft {
  return { value, committedValue: value, skipNextBlur: false }
}

export function finishRecipeFieldDraft(
  state: RecipeFieldDraft,
  event: 'enter' | 'blur',
): { state: RecipeFieldDraft; commitValue: string | null } {
  if (event === 'blur' && state.skipNextBlur) {
    return { state: { ...state, skipNextBlur: false }, commitValue: null }
  }
  if (state.value === state.committedValue) {
    return { state: { ...state, skipNextBlur: false }, commitValue: null }
  }
  return {
    state: {
      ...state,
      skipNextBlur: event === 'enter',
    },
    commitValue: state.value,
  }
}

function acceptRecipeFieldDraftCommit(state: RecipeFieldDraft): RecipeFieldDraft {
  return { ...state, committedValue: state.value }
}

export function selectRecipeWorkspaceRegion<T extends { region: RecipeWorkspaceRegion }>(
  state: T,
  region: RecipeWorkspaceRegion,
): T {
  return state.region === region ? state : { ...state, region }
}

export function approveActiveRecipeStage(
  recipe: StoryboardDirectorRecipe,
  now: string,
  runner: StoryboardRecipeSkillRunner = runCreatorSkill,
) {
  if (recipe.activeStage === 'scene-review') return approveSceneStage(recipe, now, runner)
  if (recipe.activeStage === 'beat-review') return approveBeatStage(recipe, now, runner)
  if (recipe.activeStage === 'shot-review') return approveShotStage(recipe, now)
  throw new TypeError('Current Recipe stage cannot be approved')
}

function stageDrafts(recipe: StoryboardDirectorRecipe, stageId: ReviewStageId) {
  if (stageId === 'scene-review') return recipe.scene.drafts
  if (stageId === 'beat-review') return recipe.beat.drafts
  return recipe.shot.drafts
}

function reviewItemId(stageId: ReviewStageId, item: Record<string, unknown>) {
  if (stageId === 'scene-review') return item.sceneId as string
  if (stageId === 'beat-review') return item.beatId as string
  return item.shotId as string
}

function reviewWarning(item: object) {
  if (!('needsReviewReason' in item)) return undefined
  return typeof item.needsReviewReason === 'string' ? item.needsReviewReason : undefined
}

export function batchDecideRecipeScene(
  recipe: StoryboardDirectorRecipe,
  sceneId: string,
  decision: Exclude<CreatorSkillReviewStatus, 'pending'>,
  now: string,
) {
  if (recipe.activeStage === 'source') {
    throw new TypeError('Source stage has no review decisions')
  }
  const stageId = recipe.activeStage
  const candidates = stageDrafts(recipe, stageId).filter((item) => (
    item.sceneId === sceneId && !reviewWarning(item)
  ))
  return candidates.reduce((next, item) => setRecipeDecision(
    next,
    stageId,
    reviewItemId(stageId, item as unknown as Record<string, unknown>),
    decision,
    now,
  ), recipe)
}

export function nextUnresolvedFinding(
  findings: StoryboardDirectorFinding[],
  selectedFindingId: string | null,
) {
  if (findings.length === 0) return null
  const index = findings.findIndex((item) => item.findingId === selectedFindingId)
  return findings[index < 0 ? 0 : (index + 1) % findings.length] ?? null
}

export function canImportLegacyDirectorState(
  legacyState: LegacyDirectorStateReadResult,
  cloudBoard: StoryboardState,
) {
  return legacyState.status === 'valid'
    && legacyState.state.shots.length > 0
    && cloudBoard.shots.length === 0
}

export function getStoryboardDirectorRecipeActions(recipe: StoryboardDirectorRecipe) {
  const summary = summarizeStoryboardDirectorRecipe(recipe)
  const sourceFresh = summary.sourceFresh
  const stage = recipe.activeStage === 'source' ? null : recipe[{
    'scene-review': 'scene',
    'beat-review': 'beat',
    'shot-review': 'shot',
  }[recipe.activeStage] as 'scene' | 'beat' | 'shot']
  const canApprove = Boolean(
    sourceFresh
    && stage?.status === 'needs-review'
    && stage.drafts.length > 0
    && stage.drafts.every((item) => item.decision !== 'pending')
    && stage.drafts.some((item) => item.decision === 'approved'),
  )
  return {
    materializeGrouped: sourceFresh && summary.ready,
    syncShotBoard: sourceFresh && summary.ready,
    createDraftNodes: sourceFresh && summary.ready,
    approveStage: canApprove,
    rerunStage: sourceFresh && Boolean(stage && stage.status !== 'idle'),
    focusSource: !sourceFresh,
    startNewVersion: !sourceFresh,
  }
}

const STAGE_LABELS: Array<{ id: StoryboardDirectorStageId; label: string }> = [
  { id: 'source', label: '来源' },
  { id: 'scene-review', label: '场景' },
  { id: 'beat-review', label: '节拍' },
  { id: 'shot-review', label: '镜头' },
]

const STATUS_LABELS = {
  idle: '未开始',
  running: '处理中',
  'needs-review': '待审核',
  approved: '已批准',
  stale: '已失效',
  blocked: '已阻塞',
} as const

const FILTERS: Array<{ id: ReviewFilter; label: string }> = [
  { id: 'pending', label: '待定' },
  { id: 'warnings', label: '警告' },
  { id: 'approved', label: '批准' },
  { id: 'rejected', label: '拒绝' },
  { id: 'all', label: '全部' },
]

const BEAT_TYPES = [
  ['setup', '建立'],
  ['goal', '目标'],
  ['action', '行动'],
  ['reaction', '反应'],
  ['turn', '转折'],
  ['closure', '收束'],
  ['unclassified', '待分类'],
] as const

const SHOT_SIZES = [
  ['wide', '远景'],
  ['full', '全景'],
  ['medium', '中景'],
  ['close', '近景'],
  ['extreme-close', '特写'],
] as const

const OUTPUT_KINDS = [
  ['image', '图片'],
  ['video', '视频'],
] as const

function stageStatus(recipe: StoryboardDirectorRecipe, stageId: StoryboardDirectorStageId) {
  if (stageId === 'source') {
    return summarizeStoryboardDirectorRecipe(recipe).sourceFresh ? 'approved' : 'stale'
  }
  if (stageId === 'scene-review') return recipe.scene.status
  if (stageId === 'beat-review') return recipe.beat.status
  return recipe.shot.status
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-[#0d0f12] px-3 py-2">
      <p className="text-[9px] font-semibold text-white/35">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold text-white/82">{value}</p>
    </div>
  )
}

function StageNavigation({
  recipe,
  selectedStage,
  onSelect,
}: {
  recipe: StoryboardDirectorRecipe
  selectedStage: StoryboardDirectorStageId
  onSelect: (stage: StoryboardDirectorStageId) => void
}) {
  return (
    <nav aria-label="Recipe 阶段" className="h-full overflow-y-auto border-r border-white/10 bg-white/[0.015] px-3 py-4">
      <p className="mb-2 px-2 text-[9px] font-semibold text-white/32">RECIPE 阶段</p>
      <div className="space-y-1">
        {STAGE_LABELS.map((stage, index) => {
          const status = stageStatus(recipe, stage.id)
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelect(stage.id)}
              className={`flex h-10 w-full items-center gap-2 rounded-md px-2 text-left transition ${selectedStage === stage.id ? 'bg-white/[0.09] text-white' : 'text-white/55 hover:bg-white/[0.05] hover:text-white/80'}`}
            >
              <span className={`flex h-5 w-5 flex-none items-center justify-center rounded border text-[9px] font-semibold ${status === 'approved' ? 'border-emerald-300/25 text-emerald-200' : status === 'stale' || status === 'blocked' ? 'border-rose-300/25 text-rose-200' : 'border-white/12 text-white/45'}`}>
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{stage.label}</span>
              <span className="text-[9px] text-white/32">{STATUS_LABELS[status]}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-5 border-t border-white/[0.07] pt-4">
        <p className="px-2 text-[9px] font-semibold text-white/30">来源</p>
        <p className="mt-1 break-words px-2 text-[11px] leading-5 text-white/62">{recipe.sourceNode.title}</p>
      </div>
    </nav>
  )
}

function DraftTextField({
  value,
  label,
  multiline = false,
  disabled = false,
  resetVersion,
  onCommit,
}: {
  value: string
  label: string
  multiline?: boolean
  disabled?: boolean
  resetVersion: number
  onCommit: (value: string) => boolean
}) {
  const controlId = useId()
  const [draft, setDraft] = useState(() => createRecipeFieldDraft(value))
  const draftRef = useRef(draft)
  useEffect(() => {
    const next = createRecipeFieldDraft(value)
    draftRef.current = next
    setDraft(next)
  }, [resetVersion, value])

  const update = (next: RecipeFieldDraft) => {
    draftRef.current = next
    setDraft(next)
  }
  const finish = (event: 'enter' | 'blur') => {
    const result = finishRecipeFieldDraft(draftRef.current, event)
    update(result.state)
    if (result.commitValue !== null && onCommit(result.commitValue)) {
      update(acceptRecipeFieldDraftCommit(result.state))
    }
  }
  const shared = {
    id: controlId,
    'aria-label': label,
    value: draft.value,
    disabled,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      update({ ...draftRef.current, value: event.target.value })
    },
    onBlur: () => finish('blur'),
    className: 'w-full rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[11px] leading-5 text-white/80 outline-none transition placeholder:text-white/22 focus:border-cyan-200/35 disabled:cursor-not-allowed disabled:opacity-45',
  }
  return (
    <label htmlFor={controlId} className="block min-w-0 space-y-1">
      <span className="block truncate text-[9px] font-semibold text-white/38">{label}</span>
      {multiline ? <textarea {...shared} rows={2} /> : (
        <input
          {...shared}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
            event.preventDefault()
            finish('enter')
            event.currentTarget.blur()
          }}
        />
      )}
    </label>
  )
}

function DraftSelectField({
  value,
  label,
  options,
  disabled = false,
  resetVersion,
  onCommit,
}: {
  value: string
  label: string
  options: ReadonlyArray<readonly [string, string]>
  disabled?: boolean
  resetVersion: number
  onCommit: (value: string) => boolean
}) {
  const controlId = useId()
  const [draft, setDraft] = useState(() => createRecipeFieldDraft(value))
  const draftRef = useRef(draft)
  useEffect(() => {
    const next = createRecipeFieldDraft(value)
    draftRef.current = next
    setDraft(next)
  }, [resetVersion, value])
  const finish = (event: 'enter' | 'blur') => {
    const result = finishRecipeFieldDraft(draftRef.current, event)
    draftRef.current = result.state
    setDraft(result.state)
    if (result.commitValue !== null && onCommit(result.commitValue)) {
      const accepted = acceptRecipeFieldDraftCommit(result.state)
      draftRef.current = accepted
      setDraft(accepted)
    }
  }
  return (
    <label htmlFor={controlId} className="block min-w-0 space-y-1">
      <span className="block truncate text-[9px] font-semibold text-white/38">{label}</span>
      <select
        id={controlId}
        aria-label={label}
        value={draft.value}
        disabled={disabled}
        onChange={(event) => {
          const next = { ...draftRef.current, value: event.target.value }
          draftRef.current = next
          setDraft(next)
        }}
        onBlur={() => finish('blur')}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
          event.preventDefault()
          finish('enter')
          event.currentTarget.blur()
        }}
        className="h-9 w-full rounded-md border border-white/10 bg-[#15181c] px-2 text-[10px] text-white/68 outline-none transition focus:border-cyan-200/35 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  )
}

function DecisionControls({
  decision,
  moveDisabled,
  decisionDisabled,
  onDecision,
  onMove,
}: {
  decision: CreatorSkillReviewStatus
  moveDisabled: boolean
  decisionDisabled: boolean
  onDecision: (decision: Exclude<CreatorSkillReviewStatus, 'pending'>) => void
  onMove: (direction: -1 | 1) => void
}) {
  const iconButton = 'flex h-7 w-7 flex-none items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-25'
  return (
    <div className="flex flex-none items-center gap-1">
      <button type="button" title="上移" aria-label="上移" disabled={moveDisabled} onClick={() => onMove(-1)} className={`${iconButton} border-white/10 text-white/45 hover:bg-white/[0.07] hover:text-white`}>
        <ArrowUp size={13} aria-hidden="true" />
      </button>
      <button type="button" title="下移" aria-label="下移" disabled={moveDisabled} onClick={() => onMove(1)} className={`${iconButton} border-white/10 text-white/45 hover:bg-white/[0.07] hover:text-white`}>
        <ArrowDown size={13} aria-hidden="true" />
      </button>
      <button type="button" title="批准" aria-label="批准" disabled={decisionDisabled} onClick={() => onDecision('approved')} className={`${iconButton} ${decision === 'approved' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-white/10 text-white/45 hover:bg-emerald-300/[0.08] hover:text-emerald-200'}`}>
        <Check size={14} aria-hidden="true" />
      </button>
      <button type="button" title="拒绝" aria-label="拒绝" disabled={decisionDisabled} onClick={() => onDecision('rejected')} className={`${iconButton} ${decision === 'rejected' ? 'border-rose-300/30 bg-rose-300/10 text-rose-200' : 'border-white/10 text-white/45 hover:bg-rose-300/[0.08] hover:text-rose-200'}`}>
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

type PendingAction = {
  kind: 'edit'
  stageId: Extract<ReviewStageId, 'scene-review' | 'beat-review'>
  itemId: string
  patch: Record<string, unknown>
} | {
  kind: 'move'
  stageId: Extract<ReviewStageId, 'scene-review' | 'beat-review'>
  itemId: string
  direction: -1 | 1
}

function RecipeReviewEditor({
  recipe,
  selectedStage,
  onCommit,
  onPendingActionChange,
}: {
  recipe: StoryboardDirectorRecipe
  selectedStage: StoryboardDirectorStageId
  onCommit: (recipe: StoryboardDirectorRecipe) => void
  onPendingActionChange: (pending: boolean) => void
}) {
  const [filter, setFilter] = useState<ReviewFilter>('pending')
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const pendingActionRef = useRef<PendingAction | null>(null)
  const [draftResetVersion, setDraftResetVersion] = useState(0)
  const sourceFresh = summarizeStoryboardDirectorRecipe(recipe).sourceFresh
  const activeReviewStage = selectedStage === 'source' ? null : selectedStage
  const stage = activeReviewStage === 'scene-review'
    ? recipe.scene
    : activeReviewStage === 'beat-review'
      ? recipe.beat
      : activeReviewStage === 'shot-review'
        ? recipe.shot
        : null
  const drafts = stage?.drafts ?? []
  const sceneIds = Array.from(new Set(drafts.map((item) => item.sceneId)))

  useEffect(() => {
    if (!sceneIds.includes(expandedSceneId ?? '')) setExpandedSceneId(sceneIds[0] ?? null)
  }, [expandedSceneId, sceneIds])

  const commitMutation = (next: StoryboardDirectorRecipe) => {
    if (pendingActionRef.current) return false
    if (next === recipe) return false
    onCommit(next)
    return true
  }
  const requestPendingAction = (action: PendingAction) => {
    if (pendingActionRef.current) return false
    pendingActionRef.current = action
    setPendingAction(action)
    onPendingActionChange(true)
    return true
  }
  const clearPendingAction = () => {
    pendingActionRef.current = null
    setPendingAction(null)
    onPendingActionChange(false)
  }
  const commitEdit = (stageId: ReviewStageId, itemId: string, patch: Record<string, unknown>) => {
    if (pendingActionRef.current) return false
    if ((stageId === 'scene-review' || stageId === 'beat-review')
      && recipe[stageId === 'scene-review' ? 'scene' : 'beat'].status === 'approved') {
      requestPendingAction({ kind: 'edit', stageId, itemId, patch })
      return false
    }
    return commitMutation(updateRecipeDraft(recipe, stageId, itemId, patch, new Date().toISOString()))
  }
  const commitMove = (stageId: ReviewStageId, itemId: string, direction: -1 | 1) => {
    if (pendingActionRef.current) return
    if ((stageId === 'scene-review' || stageId === 'beat-review')
      && recipe[stageId === 'scene-review' ? 'scene' : 'beat'].status === 'approved') {
      requestPendingAction({ kind: 'move', stageId, itemId, direction })
      return
    }
    commitMutation(moveRecipeDraft(recipe, stageId, itemId, direction, new Date().toISOString()))
  }
  const visible = (item: { decision: CreatorSkillReviewStatus; needsReviewReason?: string }) => {
    if (filter === 'all') return true
    if (filter === 'warnings') return Boolean(item.needsReviewReason)
    return item.decision === filter
  }
  const stageEditable = Boolean(sourceFresh && stage && (
    stage.status === 'needs-review'
    || ((activeReviewStage === 'scene-review' || activeReviewStage === 'beat-review') && stage.status === 'approved')
  ))
  const interactionLocked = pendingAction !== null
  const fieldsDisabled = !stageEditable || interactionLocked

  if (selectedStage === 'source') {
    return (
      <main className="h-full overflow-y-auto px-5 py-5">
        <p className="text-[10px] font-semibold text-white/35">来源文本</p>
        <h3 className="mt-1 text-[14px] font-semibold text-white/85">{recipe.sourceNode.title}</h3>
        <pre className="mt-4 whitespace-pre-wrap break-words border-y border-white/[0.07] py-4 font-sans text-[11px] leading-6 text-white/55">{recipe.sourceNode.prompt}</pre>
      </main>
    )
  }

  if (!stage || !activeReviewStage) return null

  return (
    <main className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="flex flex-none items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
        <div className="grid min-w-0 flex-1 grid-cols-5 rounded-md border border-white/10 bg-white/[0.025] p-0.5" role="group" aria-label="审核筛选">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={`h-7 min-w-0 rounded px-1 text-[10px] font-medium transition ${filter === item.id ? 'bg-white/[0.11] text-white' : 'text-white/42 hover:text-white/70'}`}>
              {item.label}
            </button>
          ))}
        </div>
        <span className="flex-none text-[10px] text-white/35">{drafts.length} 项</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {sceneIds.map((sceneId) => {
          const sceneDrafts = drafts.filter((item) => item.sceneId === sceneId)
          const filtered = sceneDrafts.filter(visible)
          const expanded = expandedSceneId === sceneId
          return (
            <section key={sceneId} className="border-b border-white/[0.07]">
              <div className="flex min-h-12 items-center gap-2 px-4 py-2">
                <button type="button" title={expanded ? '收起场景' : '展开场景'} aria-label={expanded ? '收起场景' : '展开场景'} onClick={() => setExpandedSceneId(expanded ? null : sceneId)} className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-white/40 hover:bg-white/[0.06] hover:text-white/75">
                  {expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                </button>
                <button type="button" onClick={() => setExpandedSceneId(expanded ? null : sceneId)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[11px] font-semibold text-white/75">{sceneId}</span>
                  <span className="text-[9px] text-white/30">待定 {sceneDrafts.filter((item) => item.decision === 'pending').length} · 警告 {sceneDrafts.filter((item) => reviewWarning(item)).length} · 已决定 {sceneDrafts.filter((item) => item.decision !== 'pending').length}</span>
                </button>
                {expanded && stage.status === 'needs-review' && sourceFresh ? (
                  <div className="flex flex-none gap-1">
                    <button type="button" title="批量批准" aria-label="批量批准" disabled={interactionLocked} onClick={() => commitMutation(batchDecideRecipeScene(recipe, sceneId, 'approved', new Date().toISOString()))} className="flex h-8 items-center gap-1 rounded-md border border-emerald-300/20 px-2 text-[9px] font-semibold text-emerald-200 hover:bg-emerald-300/[0.08] disabled:cursor-not-allowed disabled:opacity-30"><Check size={13} aria-hidden="true" />批量批准</button>
                    <button type="button" title="批量拒绝" aria-label="批量拒绝" disabled={interactionLocked} onClick={() => commitMutation(batchDecideRecipeScene(recipe, sceneId, 'rejected', new Date().toISOString()))} className="flex h-8 items-center gap-1 rounded-md border border-rose-300/20 px-2 text-[9px] font-semibold text-rose-200 hover:bg-rose-300/[0.08] disabled:cursor-not-allowed disabled:opacity-30"><X size={13} aria-hidden="true" />批量拒绝</button>
                  </div>
                ) : null}
              </div>

              {expanded ? (
                <div className="divide-y divide-white/[0.05] border-t border-white/[0.05]">
                  {filtered.length === 0 ? <p className="px-12 py-5 text-[11px] text-white/28">当前筛选没有审核项。</p> : null}
                  {filtered.map((item, index) => {
                    const itemId = reviewItemId(activeReviewStage, item as unknown as Record<string, unknown>)
                    const warning = reviewWarning(item)
                    const sceneItem = activeReviewStage === 'scene-review'
                      ? item as StoryboardDirectorRecipe['scene']['drafts'][number]
                      : null
                    const beatItem = activeReviewStage === 'beat-review'
                      ? item as StoryboardDirectorRecipe['beat']['drafts'][number]
                      : null
                    const shotItem = activeReviewStage === 'shot-review'
                      ? item as StoryboardDirectorRecipe['shot']['drafts'][number]
                      : null
                    return (
                      <div key={itemId} className="px-4 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex min-h-6 items-center gap-2">
                              <span className="text-[9px] font-semibold text-white/28">{String(index + 1).padStart(2, '0')}</span>
                              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${item.decision === 'approved' ? 'border-emerald-300/20 text-emerald-200' : item.decision === 'rejected' ? 'border-rose-300/20 text-rose-200' : 'border-amber-300/20 text-amber-200'}`}>{item.decision === 'approved' ? '已批准' : item.decision === 'rejected' ? '已拒绝' : '待定'}</span>
                              {warning ? <span className="flex min-w-0 items-center gap-1 text-[9px] text-amber-200"><AlertTriangle size={11} aria-hidden="true" /><span className="truncate">{warning}</span></span> : null}
                            </div>

                            {sceneItem ? (
                              <>
                                <DraftTextField value={sceneItem.heading} label="场景标题" disabled={fieldsDisabled} resetVersion={draftResetVersion} onCommit={(value) => commitEdit('scene-review', itemId, { heading: value })} />
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <DraftTextField value={sceneItem.location ?? ''} label="场景地点" disabled={fieldsDisabled} resetVersion={draftResetVersion} onCommit={(value) => commitEdit('scene-review', itemId, { location: value || undefined })} />
                                  <DraftTextField value={sceneItem.timeOfDay ?? ''} label="场景时间" disabled={fieldsDisabled} resetVersion={draftResetVersion} onCommit={(value) => commitEdit('scene-review', itemId, { timeOfDay: value || undefined })} />
                                </div>
                                <DraftTextField value={sceneItem.characters.join(', ')} label="场景角色" disabled={fieldsDisabled} resetVersion={draftResetVersion} onCommit={(value) => commitEdit('scene-review', itemId, {
                                  characters: Array.from(new Set(value.split(/[,，]/).map((entry) => entry.trim()).filter(Boolean))),
                                })} />
                                <DraftTextField value={sceneItem.actionSummary} label="场景动作摘要" multiline disabled={fieldsDisabled} resetVersion={draftResetVersion} onCommit={(value) => commitEdit('scene-review', itemId, { actionSummary: value })} />
                              </>
                            ) : beatItem ? (
                              <>
                                <DraftSelectField value={beatItem.type} label="节拍类型" options={BEAT_TYPES} disabled={fieldsDisabled} resetVersion={draftResetVersion} onCommit={(value) => commitEdit('beat-review', itemId, { type: value })} />
                                <DraftTextField value={beatItem.summary} label="节拍摘要" multiline disabled={fieldsDisabled} resetVersion={draftResetVersion} onCommit={(value) => commitEdit('beat-review', itemId, { summary: value })} />
                              </>
                            ) : shotItem ? (
                              <div className="space-y-2">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <DraftTextField value={shotItem.objective} label="镜头目标" disabled={fieldsDisabled} resetVersion={draftResetVersion} onCommit={(value) => commitEdit('shot-review', itemId, { objective: value })} />
                                  <DraftTextField value={shotItem.subject} label="镜头主体" disabled={fieldsDisabled} resetVersion={draftResetVersion} onCommit={(value) => commitEdit('shot-review', itemId, { subject: value })} />
                                </div>
                                <DraftTextField value={shotItem.action} label="镜头动作" multiline disabled={fieldsDisabled} resetVersion={draftResetVersion} onCommit={(value) => commitEdit('shot-review', itemId, { action: value })} />
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                  <DraftSelectField value={shotItem.suggestedShotSize} label="镜头景别" options={SHOT_SIZES} disabled={fieldsDisabled} resetVersion={draftResetVersion} onCommit={(value) => commitEdit('shot-review', itemId, { suggestedShotSize: value })} />
                                  <DraftSelectField value={shotItem.outputKind} label="输出类型" options={OUTPUT_KINDS} disabled={fieldsDisabled} resetVersion={draftResetVersion} onCommit={(value) => commitEdit('shot-review', itemId, { outputKind: value })} />
                                  <DraftSelectField value={String(shotItem.duration)} label="镜头时长" options={[["5", "5 秒"], ["10", "10 秒"]]} disabled={fieldsDisabled} resetVersion={draftResetVersion} onCommit={(value) => commitEdit('shot-review', itemId, { duration: Number(value) })} />
                                </div>
                              </div>
                            ) : null}

                            <p className="border-l border-white/10 pl-2 text-[9px] leading-4 text-white/32">第 {item.lineStart}-{item.lineEnd} 行 · {item.sourceText}</p>
                          </div>
                          <DecisionControls
                            decision={item.decision}
                            moveDisabled={fieldsDisabled}
                            decisionDisabled={fieldsDisabled || stage.status === 'approved'}
                            onDecision={(decision) => commitMutation(setRecipeDecision(recipe, activeReviewStage, itemId, decision, new Date().toISOString()))}
                            onMove={(direction) => commitMove(activeReviewStage, itemId, direction)}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>

      {pendingAction ? (
        <div className="flex flex-none flex-wrap items-center gap-3 border-t border-amber-300/20 bg-amber-300/[0.06] px-4 py-3">
          <AlertTriangle size={15} className="flex-none text-amber-200" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[10px] leading-5 text-amber-100/75">
            此修改将使 {changeImpactForStage(recipe, pendingAction.stageId).beatCount} 个节拍和 {changeImpactForStage(recipe, pendingAction.stageId).shotCount} 个镜头失效。
          </p>
          <button type="button" onClick={() => {
            clearPendingAction()
            setDraftResetVersion((current) => current + 1)
          }} className="h-8 rounded-md border border-white/10 px-3 text-[10px] text-white/55">取消</button>
          <button type="button" onClick={() => {
            const action = pendingAction
            clearPendingAction()
            if (action.kind === 'edit') {
              commitMutation(updateRecipeDraft(recipe, action.stageId, action.itemId, action.patch, new Date().toISOString()))
              return
            }
            commitMutation(moveRecipeDraft(recipe, action.stageId, action.itemId, action.direction, new Date().toISOString()))
          }} className="h-8 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 text-[10px] font-semibold text-amber-100">{pendingAction.kind === 'edit' ? '确认修改' : '确认调整'}</button>
        </div>
      ) : null}
    </main>
  )
}

function RecipeEvidenceInspector({
  recipe,
  selectedFindingId,
  onSelectFinding,
}: {
  recipe: StoryboardDirectorRecipe
  selectedFindingId: string | null
  onSelectFinding: (findingId: string | null) => void
}) {
  const findings = useMemo(() => analyzeStoryboardDirectorRecipe(recipe), [recipe])
  const selected = findings.find((item) => item.findingId === selectedFindingId) ?? findings[0] ?? null
  const evidence = [recipe.scene.result, recipe.beat.result, recipe.shot.result]
    .flatMap((result) => result?.evidence ?? [])
    .filter((item) => selected?.evidenceIds.includes(item.evidenceId))
  return (
    <aside className="flex h-full flex-col overflow-hidden border-l border-white/10 bg-white/[0.015]">
      <div className="flex h-12 flex-none items-center justify-between border-b border-white/[0.07] px-4">
        <h3 className="flex items-center gap-1.5 text-[10px] font-semibold text-white/55"><FileSearch size={13} aria-hidden="true" />证据与问题</h3>
        <button type="button" disabled={findings.length === 0} onClick={() => onSelectFinding(nextUnresolvedFinding(findings, selected?.findingId ?? null)?.findingId ?? null)} className="h-7 rounded-md border border-white/10 px-2 text-[9px] text-white/50 disabled:opacity-30">下一个问题</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {findings.length === 0 ? <p className="px-4 py-6 text-[11px] text-white/30">当前没有 Intelligence 问题。</p> : null}
        <div className="divide-y divide-white/[0.06]">
          {findings.map((finding) => (
            <button key={finding.findingId} type="button" onClick={() => onSelectFinding(finding.findingId)} className={`w-full px-4 py-3 text-left transition ${selected?.findingId === finding.findingId ? 'bg-white/[0.07]' : 'hover:bg-white/[0.035]'}`}>
              <span className={`text-[9px] font-semibold ${finding.severity === 'blocking' ? 'text-rose-200' : 'text-amber-200'}`}>{finding.severity === 'blocking' ? '阻塞' : '建议'} · {finding.code}</span>
              <span className="mt-1 block break-words text-[10px] leading-5 text-white/58">{finding.message}</span>
            </button>
          ))}
        </div>
        {selected ? (
          <section className="border-t border-white/[0.08] px-4 py-4">
            <p className="text-[9px] font-semibold text-white/30">证据</p>
            {evidence.length === 0 ? <p className="mt-2 text-[10px] text-white/28">此问题没有行级证据。</p> : evidence.map((item) => (
              <blockquote key={item.evidenceId} className="mt-3 border-l border-cyan-200/25 pl-3 text-[10px] leading-5 text-white/52">
                <p>{item.excerpt}</p>
                <footer className="mt-1 text-[9px] text-white/28">第 {item.lineStart}-{item.lineEnd} 行 · {item.explanation}</footer>
              </blockquote>
            ))}
          </section>
        ) : null}
      </div>
    </aside>
  )
}

function RecipeSelection({
  availableRecipes,
  availableSources,
  onOpenRecipe,
  onStartRecipe,
}: Pick<StoryboardDirectorRecipePanelProps, 'availableRecipes' | 'availableSources' | 'onOpenRecipe' | 'onStartRecipe'>) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <section aria-labelledby="existing-recipes-title">
        <h3 id="existing-recipes-title" className="text-[11px] font-semibold text-white/65">已有 Recipe</h3>
        <div className="mt-2 divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {availableRecipes.length === 0 ? <p className="py-4 text-[11px] text-white/30">还没有 Storyboard Director Recipe。</p> : availableRecipes.map((item) => (
            <div key={item.nodeId} className="flex min-h-12 items-center gap-3 py-2">
              <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-medium text-white/72">{item.title}</p><p className="mt-0.5 text-[9px] text-white/30">{item.status} · {item.recipeId}</p></div>
              <button type="button" onClick={() => onOpenRecipe(item.nodeId)} className="flex h-8 items-center gap-1.5 rounded-md border border-white/12 px-3 text-[10px] font-semibold text-white/62 hover:bg-white/[0.06]"><ExternalLink size={12} aria-hidden="true" />打开</button>
            </div>
          ))}
        </div>
      </section>
      <section aria-labelledby="eligible-sources-title" className="mt-7">
        <h3 id="eligible-sources-title" className="text-[11px] font-semibold text-white/65">可用文本来源</h3>
        <div className="mt-2 divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {availableSources.length === 0 ? <p className="py-4 text-[11px] text-white/30">没有可用于新 Recipe 的文本节点。</p> : availableSources.map((item) => (
            <div key={item.id} className="flex min-h-12 items-center gap-3 py-2">
              <p className="min-w-0 flex-1 truncate text-[11px] text-white/68">{item.title}</p>
              <button type="button" onClick={() => onStartRecipe(item.id)} className="h-8 rounded-md border border-cyan-200/25 bg-cyan-200/[0.07] px-3 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-200/[0.12]">从此来源开始</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function StoryboardDirectorRecipePanel({
  recipe,
  availableSources,
  availableRecipes,
  legacyState,
  onStartRecipe,
  onOpenRecipe,
  onCommitRecipe,
  onFocusSource,
  onMaterializeGrouped,
  onSyncShotBoard,
  onCreateDraftNodes,
  onImportLegacy,
}: StoryboardDirectorRecipePanelProps) {
  const [regionState, setRegionState] = useState<{ region: RecipeWorkspaceRegion }>({ region: 'review' })
  const [selectedStage, setSelectedStage] = useState<StoryboardDirectorStageId>(recipe?.activeStage ?? 'source')
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null)
  const [reviewActionPending, setReviewActionPending] = useState(false)
  const reviewActionPendingRef = useRef(false)

  useEffect(() => setSelectedStage(recipe?.activeStage ?? 'source'), [recipe?.recipeId, recipe?.activeStage])
  useEffect(() => {
    reviewActionPendingRef.current = false
    setReviewActionPending(false)
  }, [recipe?.recipeId])

  const handlePendingActionChange = (pending: boolean) => {
    reviewActionPendingRef.current = pending
    setReviewActionPending(pending)
  }
  const runUnlockedAction = (action: () => void) => {
    if (!reviewActionPendingRef.current) action()
  }

  if (!recipe) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-10 flex-none items-center border-b border-white/[0.07] px-5">
          <p className="text-[10px] text-white/38">选择已有 Recipe，或从文本来源显式创建。</p>
        </div>
        <RecipeSelection availableRecipes={availableRecipes} availableSources={availableSources} onOpenRecipe={onOpenRecipe} onStartRecipe={onStartRecipe} />
        {legacyState.status === 'valid' && legacyState.state.shots.length > 0 ? (
          <div className="flex flex-none items-center justify-between border-t border-white/[0.07] px-5 py-3">
            <p className="text-[10px] text-white/38">检测到旧版本地镜头板</p>
            <button type="button" onClick={onImportLegacy} className="h-8 rounded-md border border-white/12 px-3 text-[10px] font-semibold text-white/62">导入旧版</button>
          </div>
        ) : null}
      </div>
    )
  }

  const summary = summarizeStoryboardDirectorRecipe(recipe)
  const actions = getStoryboardDirectorRecipeActions(recipe)
  const legacyEnabled = canImportLegacyDirectorState(legacyState, recipe.storyboard)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-none items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-2">
        <div className="min-w-0"><p className="truncate text-[11px] font-semibold text-white/72">{recipe.sourceNode.title}</p><p className="text-[9px] text-white/28">Recipe {recipe.recipeId}</p></div>
      </div>

      <div data-testid="director-intelligence" className="grid grid-cols-2 gap-px border-y border-white/10 bg-white/10 md:grid-cols-6">
        <Metric label="场景" value={summary.approvedScenes} />
        <Metric label="节拍" value={summary.approvedBeats} />
        <Metric label="镜头" value={summary.approvedShots} />
        <Metric label="覆盖" value={`${summary.coveredBeats}/${summary.approvedBeats}`} />
        <Metric label="问题" value={summary.blockingCount + summary.advisoryCount} />
        <Metric label="状态" value={summary.ready ? '可落地' : '需处理'} />
      </div>

      {!summary.sourceFresh ? (
        <div className="flex flex-none flex-wrap items-center gap-2 border-b border-rose-300/20 bg-rose-300/[0.06] px-4 py-3">
          <AlertTriangle size={14} className="text-rose-200" aria-hidden="true" />
          <p className="min-w-[180px] flex-1 text-[10px] leading-5 text-rose-100/72">来源已变化。当前版本仅供检查，不能审核或落地。</p>
          <button type="button" onClick={() => onFocusSource(recipe.sourceNode.id)} className="h-8 rounded-md border border-white/12 px-3 text-[10px] text-white/65">定位来源</button>
          <button type="button" onClick={() => onStartRecipe(recipe.sourceNode.id)} className="h-8 rounded-md border border-rose-300/25 bg-rose-300/10 px-3 text-[10px] font-semibold text-rose-100">开始新版本</button>
        </div>
      ) : null}

      <div className="grid flex-none grid-cols-3 border-b border-white/[0.07] p-1 lg:hidden" role="group" aria-label="Recipe 工作区">
        {([['stages', '阶段'], ['review', '审核'], ['evidence', '证据']] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={regionState.region === id} onClick={() => setRegionState((current) => selectRecipeWorkspaceRegion(current, id))} className={`h-8 rounded-md text-[10px] font-semibold ${regionState.region === id ? 'bg-white/[0.1] text-white' : 'text-white/40'}`}>{label}</button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[180px_minmax(0,1fr)_300px]">
        <div className={`${regionState.region === 'stages' ? 'block' : 'hidden'} min-h-0 lg:block`}><StageNavigation recipe={recipe} selectedStage={selectedStage} onSelect={(stage) => { setSelectedStage(stage); setRegionState({ region: 'review' }) }} /></div>
        <div className={`${regionState.region === 'review' ? 'block' : 'hidden'} min-h-0 lg:block`}><RecipeReviewEditor key={recipe.recipeId} recipe={recipe} selectedStage={selectedStage} onCommit={onCommitRecipe} onPendingActionChange={handlePendingActionChange} /></div>
        <div className={`${regionState.region === 'evidence' ? 'block' : 'hidden'} min-h-0 lg:block`}><RecipeEvidenceInspector recipe={recipe} selectedFindingId={selectedFindingId} onSelectFinding={setSelectedFindingId} /></div>
      </div>

      {summary.sourceFresh ? (
        <div className="flex flex-none flex-wrap items-center gap-2 border-t border-white/[0.08] px-4 py-3">
          <button type="button" title="重新运行当前阶段" aria-label="重新运行当前阶段" disabled={!actions.rerunStage || reviewActionPending} onClick={() => runUnlockedAction(() => {
            if (recipe.activeStage === 'source') return
            onCommitRecipe(rerunRecipeStage(recipe, recipe.activeStage, new Date().toISOString()))
          })} className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/48 hover:bg-white/[0.06] disabled:opacity-25"><RefreshCw size={14} aria-hidden="true" /></button>
          <button type="button" title="批准当前阶段" aria-label="批准当前阶段" disabled={!actions.approveStage || reviewActionPending} onClick={() => runUnlockedAction(() => onCommitRecipe(approveActiveRecipeStage(recipe, new Date().toISOString())))} className="flex h-8 items-center gap-1 rounded-md border border-emerald-300/25 bg-emerald-300/[0.07] px-3 text-[10px] font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-30"><Check size={13} aria-hidden="true" />批准当前阶段</button>
          <div className="mx-1 h-5 w-px bg-white/10" />
          <button type="button" disabled={!actions.materializeGrouped || reviewActionPending} onClick={() => runUnlockedAction(() => onMaterializeGrouped(['scene', 'beat', 'shot-plan']))} className="h-8 rounded-md border border-cyan-200/25 bg-cyan-200/[0.07] px-3 text-[10px] font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-30">落地审核结果</button>
          <button type="button" disabled={!actions.syncShotBoard || reviewActionPending} onClick={() => runUnlockedAction(onSyncShotBoard)} className="h-8 rounded-md border border-white/12 px-3 text-[10px] font-semibold text-white/60 disabled:opacity-30">同步镜头板</button>
          <button type="button" disabled={!actions.createDraftNodes || reviewActionPending} onClick={() => runUnlockedAction(onCreateDraftNodes)} className="h-8 rounded-md border border-white/12 px-3 text-[10px] font-semibold text-white/60 disabled:opacity-30">创建草稿节点</button>
          {legacyState.status === 'valid' && legacyState.state.shots.length > 0 ? <button type="button" disabled={!legacyEnabled || reviewActionPending} onClick={() => runUnlockedAction(onImportLegacy)} className="ml-auto h-8 rounded-md border border-white/10 px-3 text-[10px] text-white/45 disabled:cursor-not-allowed disabled:opacity-30">导入旧版</button> : null}
        </div>
      ) : null}
    </div>
  )
}
