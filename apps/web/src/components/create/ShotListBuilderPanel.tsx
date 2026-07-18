'use client'

import { useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Copy,
  FileSearch,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import { VisualTagPicker } from '@/components/toolkit/VisualTagPicker'
import type { VisualTagOption } from '@/components/toolkit/VisualTagPicker'
import {
  readApprovedCreatorSkillArtifact,
  runCreatorSkill,
  SHOT_PLANNING_MANIFEST,
  type CreatorSkillArtifact,
  type CreatorSkillEvidence,
  type CreatorSkillNodeMetadata,
  type CreatorSkillReviewStatus,
  type CreatorSkillRunResult,
  type CreatorSkillSourceNode,
  type PlannedShotSize,
  type ShotOutputKind,
  type ShotPlanDraft,
  type ShotPlanningOptions,
  type ShotPlanPayload,
} from '@/lib/skills'
import {
  buildShotListReport,
  DEFAULT_SHOT_OPTIONS,
  SHOT_SIZE_LABELS,
  type ShotDraft,
  type ShotListOptions,
} from '@/lib/canvas/shot-list'
import { CreatorSkillRunPanel } from './canvas/skills/CreatorSkillRunPanel'
import {
  planShotPlanMaterialization,
  type ApprovedShotPlanScene,
  type GroupedSkillNodePlan,
  type ShotPlanReviewedSource,
} from './canvas/skills/groupedSkillMaterialization'

export type ShotListSourceNode = {
  id: string
  title?: string
  kind: string
  prompt?: string
  resultText?: string
  metadataJson?: unknown
}

export type CompatibilityShotNodeOptions = {
  title?: string
  prompt?: string
  parentNodeId?: string
  index?: number
  total?: number
  metadataJson: CreatorSkillNodeMetadata & {
    duration: 5 | 10
    outputKind: ShotOutputKind
    shotId: string
  }
}

export type ShotListBuilderPanelProps = {
  nodes: ShotListSourceNode[]
  initialNodeId?: string
  existingNodes?: Array<{ metadataJson?: unknown }>
  onApplyShotPlans?: (
    plans: GroupedSkillNodePlan[],
    reviewedSource: ShotPlanReviewedSource,
  ) => void | Promise<void>
  onCreateNode: (
    kind: VisualCanvasNodeKind,
    options: CompatibilityShotNodeOptions,
  ) => string | Promise<string>
  onAutoGenerateNodes?: (nodeIds: string[]) => void | Promise<void>
  onClose: () => void
}

export type ShotReviewDraft = ShotPlanDraft & {
  decision: CreatorSkillReviewStatus
}

type ShotPlanArtifact = CreatorSkillArtifact<ShotPlanPayload>

export type ShotReview = {
  sourceIdentity: string
  sourceNodeId: string
  sourceTitle: string
  sourceText: string
  options: ShotPlanningOptions
  approvedArtifactStatus: 'absent' | 'valid' | 'valid-unused-edited' | 'invalid'
  result: CreatorSkillRunResult
  displayResult: CreatorSkillRunResult
  artifact: ShotPlanArtifact | null
  drafts: ShotReviewDraft[]
}

export type ShotListPanelState = {
  review: ShotReview
  removedShotIds: string[]
  duplicateSceneIds: string[]
  duplicateShotIds: string[]
  materializedShotIds: string[]
  applyError: string
  applyLocked: boolean
  createdCount: number | null
}

export type ApprovedShotDraftCreationOutcome = {
  createdIds: string[]
  createdShotIds: string[]
  duplicateShotIds: string[]
  error: string
  applyLocked: boolean
}

export type ShotOperationToken = {
  sourceIdentity: string
  runFingerprint: string
  reviewGeneration: number
  operationId: number
}

export type ShotOperationContext = ShotOperationToken

const OUTPUT_MODE_OPTIONS: VisualTagOption<ShotPlanningOptions['outputMode']>[] = [
  { value: 'image', label: '纯图片', icon: '🖼' },
  { value: 'mixed', label: '图+视频', icon: '🎬' },
  { value: 'video', label: '纯视频', icon: '📹' },
]

const PACING_OPTIONS: VisualTagOption<ShotPlanningOptions['pacing']>[] = [
  { value: 'slow_cinematic', label: '慢', sublabel: '电影感', icon: '🐢' },
  { value: 'standard', label: '标准', icon: '⚡' },
  { value: 'fast_social', label: '快', sublabel: '短视频', icon: '🚀' },
]

const STRATEGY_OPTIONS: VisualTagOption<ShotPlanningOptions['shotSizeStrategy']>[] = [
  { value: 'auto', label: '自动', icon: '🎯' },
  { value: 'wide_to_close', label: '全→特', icon: '📐' },
  { value: 'close_heavy', label: '特写重', icon: '🔍' },
  { value: 'wide_heavy', label: '全景重', icon: '🌅' },
]

const SHOT_SIZE_OPTIONS: VisualTagOption<PlannedShotSize>[] = [
  { value: 'wide', label: '全景' },
  { value: 'full', label: '全身' },
  { value: 'medium', label: '中景' },
  { value: 'close', label: '近景' },
  { value: 'extreme-close', label: '特写' },
]

const REVIEW_DECISIONS: Array<{
  value: CreatorSkillReviewStatus
  label: string
}> = [
  { value: 'pending', label: '待定' },
  { value: 'approved', label: '批准' },
  { value: 'rejected', label: '拒绝' },
]

const COUNT_PRESETS = [3, 5, 8] as const
type CountPreset = typeof COUNT_PRESETS[number]

export const SHOT_PLAN_PLANNING_ERROR = '无法规划当前镜头节点，请检查审核内容后再试。'
export const SHOT_PLAN_PARTIAL_APPLY_ERROR = '节点创建过程中发生错误，部分节点可能已创建。请检查画布中的实际结果；当前审核批次已锁定。'

const txClass = 'w-full resize-none rounded-md border border-white/10 bg-[#181b20] px-3 py-2 text-[11px] leading-relaxed text-white/78 placeholder:text-white/25 outline-none focus:border-cyan-200/35'
const selClass = 'h-8 w-full rounded-md border border-white/10 bg-[#181b20] px-2 text-[11px] text-white/78 outline-none focus:border-cyan-200/35'

function getNodeText(node: ShotListSourceNode): string {
  return (node.resultText?.trim() ? node.resultText : node.prompt ?? '').trim()
}

function getNodeLabel(node: ShotListSourceNode): string {
  return node.title?.trim() || '文本节点'
}

function sourceSnapshot(
  sourceNode: ShotListSourceNode,
  sourceDraftText: string,
): CreatorSkillSourceNode {
  return {
    id: sourceNode.id,
    kind: 'text',
    title: sourceNode.title ?? '文本节点',
    prompt: sourceDraftText,
  }
}

function invalidApprovedArtifactResult(sourceNodeId: string): CreatorSkillRunResult {
  return {
    skillId: SHOT_PLANNING_MANIFEST.id,
    skillVersion: SHOT_PLANNING_MANIFEST.version,
    runFingerprint: 'csf1_00000000',
    status: 'blocked',
    artifacts: [],
    evidence: [],
    warnings: [],
    blockers: [{
      code: 'APPROVED_ARTIFACT_INVALID',
      message: '已批准的 Creator Skill Artifact 无法安全读取。',
      sourceNodeId,
    }],
  }
}

function isShotPlanDraft(value: unknown): value is ShotPlanDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const shot = value as Partial<ShotPlanDraft>
  return typeof shot.shotId === 'string'
    && shot.shotId.trim().length > 0
    && typeof shot.sceneId === 'string'
    && shot.sceneId.trim().length > 0
    && Number.isInteger(shot.order)
    && (shot.order ?? 0) > 0
    && typeof shot.objective === 'string'
    && typeof shot.subject === 'string'
    && typeof shot.action === 'string'
    && SHOT_SIZE_OPTIONS.some(({ value }) => value === shot.suggestedShotSize)
    && typeof shot.sourceText === 'string'
    && Number.isInteger(shot.lineStart)
    && (shot.lineStart ?? 0) > 0
    && Number.isInteger(shot.lineEnd)
    && (shot.lineEnd ?? 0) >= (shot.lineStart ?? 0)
    && (shot.outputKind === 'image' || shot.outputKind === 'video')
    && (shot.duration === 5 || shot.duration === 10)
    && shot.reviewStatus === 'pending'
    && (shot.beatId === undefined || typeof shot.beatId === 'string')
    && (shot.needsReviewReason === undefined
      || typeof shot.needsReviewReason === 'string')
}

function isShotPlanArtifact(
  artifact: CreatorSkillArtifact,
): artifact is ShotPlanArtifact {
  if (artifact.artifactType !== 'shot-plan'
    || artifact.artifactVersion !== 1
    || !artifact.payload
    || typeof artifact.payload !== 'object'
    || Array.isArray(artifact.payload)) {
    return false
  }
  const payload = artifact.payload as Partial<ShotPlanPayload>
  return Array.isArray(payload.scenes)
    && payload.scenes.length > 0
    && payload.scenes.every((scene) => (
      Boolean(scene)
      && typeof scene.sceneId === 'string'
      && Number.isInteger(scene.order)
      && scene.order > 0
      && typeof scene.heading === 'string'
      && Array.isArray(scene.shots)
      && scene.shots.every(isShotPlanDraft)
    ))
}

function narrowShotPlan(result: CreatorSkillRunResult): ShotPlanArtifact | null {
  const artifacts = result.artifacts.filter(isShotPlanArtifact)
  return artifacts.length === 1 ? artifacts[0]! : null
}

function resultForDisplay(
  result: CreatorSkillRunResult,
  artifact: ShotPlanArtifact | null,
): CreatorSkillRunResult {
  if (artifact || result.status === 'blocked') return result
  return {
    ...result,
    status: 'blocked',
    blockers: [
      ...result.blockers,
      {
        code: 'SHOT_PLAN_INVALID',
        message: '镜头规划结果无法安全读取，请重新运行。',
      },
    ],
  }
}

export function getShotListSourceIdentity(
  sourceNode: ShotListSourceNode,
  sourceDraftText: string,
  options: ShotPlanningOptions,
) {
  const approvedArtifact = readApprovedCreatorSkillArtifact(
    sourceNode.metadataJson,
  )
  const artifactIdentity = approvedArtifact.status === 'valid'
    ? JSON.stringify(approvedArtifact.artifact)
    : approvedArtifact.status
  return JSON.stringify([
    sourceNode.id,
    sourceNode.kind,
    getNodeText(sourceNode),
    sourceDraftText,
    options,
    artifactIdentity,
  ])
}

export function runShotListReview(
  sourceNode: ShotListSourceNode,
  sourceDraftText: string,
  options: ShotPlanningOptions,
): ShotReview {
  const approvedArtifact = readApprovedCreatorSkillArtifact(
    sourceNode.metadataJson,
  )
  const sourceIdentity = getShotListSourceIdentity(
    sourceNode,
    sourceDraftText,
    options,
  )
  if (approvedArtifact.status === 'invalid') {
    const blocked = invalidApprovedArtifactResult(sourceNode.id)
    return {
      sourceIdentity,
      sourceNodeId: sourceNode.id,
      sourceTitle: getNodeLabel(sourceNode),
      sourceText: sourceDraftText,
      options: { ...options },
      approvedArtifactStatus: 'invalid',
      result: blocked,
      displayResult: blocked,
      artifact: null,
      drafts: [],
    }
  }

  const originalText = getNodeText(sourceNode)
  const draftMatchesSource = sourceDraftText.trim() === originalText
  const approvedSourceArtifact = approvedArtifact.status === 'valid'
    && draftMatchesSource
    ? approvedArtifact.artifact
    : null
  const inputSource = sourceSnapshot(sourceNode, sourceDraftText)
  const result = approvedSourceArtifact
    ? runCreatorSkill('shot-planning', {
      sourceNodes: [inputSource],
      artifacts: [approvedSourceArtifact],
      options,
    })
    : runCreatorSkill('shot-planning', {
      sourceNodes: [inputSource],
      options,
    })
  const artifact = narrowShotPlan(result)
  const drafts = artifact
    ? artifact.payload.scenes.flatMap((scene) => scene.shots.map((shot) => ({
      ...shot,
      decision: 'pending' as const,
    })))
    : []

  return {
    sourceIdentity,
    sourceNodeId: sourceNode.id,
    sourceTitle: getNodeLabel(sourceNode),
    sourceText: sourceDraftText,
    options: { ...options },
    approvedArtifactStatus: approvedArtifact.status === 'valid'
      ? (draftMatchesSource ? 'valid' : 'valid-unused-edited')
      : 'absent',
    result,
    displayResult: resultForDisplay(result, artifact),
    artifact,
    drafts,
  }
}

export function createShotListPanelState(
  sourceNode: ShotListSourceNode,
  sourceDraftText: string,
  options: ShotPlanningOptions,
): ShotListPanelState {
  return {
    review: runShotListReview(sourceNode, sourceDraftText, options),
    removedShotIds: [],
    duplicateSceneIds: [],
    duplicateShotIds: [],
    materializedShotIds: [],
    applyError: '',
    applyLocked: false,
    createdCount: null,
  }
}

export function rerunShotListPanelState(
  sourceNode: ShotListSourceNode,
  sourceDraftText: string,
  options: ShotPlanningOptions,
) {
  return createShotListPanelState(sourceNode, sourceDraftText, options)
}

export function createShotOperationToken(
  review: ShotReview,
  reviewGeneration: number,
  operationId: number,
): ShotOperationToken {
  return {
    sourceIdentity: review.sourceIdentity,
    runFingerprint: review.result.runFingerprint,
    reviewGeneration,
    operationId,
  }
}

export function isShotOperationTokenCurrent(
  token: ShotOperationToken,
  context: ShotOperationContext,
) {
  return token.sourceIdentity === context.sourceIdentity
    && token.runFingerprint === context.runFingerprint
    && token.reviewGeneration === context.reviewGeneration
    && token.operationId === context.operationId
}

export function updateShotReviewDraft(
  drafts: ShotReviewDraft[],
  shotId: string,
  patch: Partial<Pick<
    ShotReviewDraft,
    'objective' | 'subject' | 'action' | 'suggestedShotSize' | 'outputKind' | 'duration'
  >>,
) {
  let changed = false
  const next = drafts.map((shot) => {
    if (shot.shotId !== shotId) return shot
    const updated = { ...shot, ...patch }
    if (updated.objective === shot.objective
      && updated.subject === shot.subject
      && updated.action === shot.action
      && updated.suggestedShotSize === shot.suggestedShotSize
      && updated.outputKind === shot.outputKind
      && updated.duration === shot.duration) {
      return shot
    }
    changed = true
    return updated
  })
  return changed ? next : drafts
}

export function setShotReviewDecision(
  drafts: ShotReviewDraft[],
  shotId: string,
  decision: CreatorSkillReviewStatus,
) {
  let changed = false
  const next = drafts.map((shot) => {
    if (shot.shotId !== shotId || shot.decision === decision) return shot
    changed = true
    return { ...shot, decision }
  })
  return changed ? next : drafts
}

export function moveShotReviewDraft(
  drafts: ShotReviewDraft[],
  shotId: string,
  direction: -1 | 1,
) {
  const index = drafts.findIndex((shot) => shot.shotId === shotId)
  if (index === -1) return drafts
  const target = index + direction
  if (target < 0 || target >= drafts.length) return drafts
  if (drafts[target]!.sceneId !== drafts[index]!.sceneId) return drafts
  const next = drafts.slice()
  const current = next[index]!
  next[index] = next[target]!
  next[target] = current
  return next
}

export function removeShotReviewDraft(
  drafts: ShotReviewDraft[],
  shotId: string,
) {
  if (!drafts.some((shot) => shot.shotId === shotId)) return drafts
  return drafts.filter((shot) => shot.shotId !== shotId)
}

export function approvedShotPlanScenes(
  drafts: ShotReviewDraft[],
  artifact: ShotPlanArtifact | null,
): ApprovedShotPlanScene[] {
  if (!artifact) return []
  return artifact.payload.scenes.flatMap((scene) => {
    const shots = drafts
      .filter((shot) => (
        shot.sceneId === scene.sceneId
        && shot.decision === 'approved'
      ))
      .map((shot) => ({
        shotId: shot.shotId,
        sceneId: shot.sceneId,
        ...(shot.beatId !== undefined ? { beatId: shot.beatId } : {}),
        order: shot.order,
        objective: shot.objective,
        subject: shot.subject,
        action: shot.action,
        suggestedShotSize: shot.suggestedShotSize,
        sourceText: shot.sourceText,
        lineStart: shot.lineStart,
        lineEnd: shot.lineEnd,
        outputKind: shot.outputKind,
        duration: shot.duration,
        reviewStatus: 'approved' as const,
        ...(shot.needsReviewReason !== undefined
          ? { needsReviewReason: shot.needsReviewReason }
          : {}),
      }))
    return shots.length > 0
      ? [{
        sceneId: scene.sceneId,
        order: scene.order,
        heading: scene.heading,
        shots,
      }]
      : []
  })
}

function ownData(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ? descriptor.value
      : undefined
  } catch {
    return undefined
  }
}

export function existingCompatibilityShotIds(
  nodes: Array<{ metadataJson?: unknown }>,
  result: CreatorSkillRunResult,
) {
  const ids = new Set<string>()
  for (const node of nodes) {
    const creatorSkill = ownData(node.metadataJson, 'creatorSkill')
    if (ownData(creatorSkill, 'skillId') !== result.skillId
      || ownData(creatorSkill, 'runFingerprint') !== result.runFingerprint) {
      continue
    }
    const resultId = ownData(creatorSkill, 'resultId')
    if (typeof resultId === 'string' && resultId.trim()) ids.add(resultId)
  }
  return [...ids]
}

function evidenceForShot(
  evidence: CreatorSkillEvidence[],
  shot: ShotReviewDraft,
) {
  return evidence.filter((item) => (
    item.lineStart === shot.lineStart
    && item.lineEnd === shot.lineEnd
    && item.excerpt === shot.sourceText
  ))
}

function compatibilityMetadata(
  result: CreatorSkillRunResult,
  shot: ShotReviewDraft,
): CompatibilityShotNodeOptions['metadataJson'] {
  return {
    duration: shot.duration,
    outputKind: shot.outputKind,
    shotId: shot.shotId,
    creatorSkill: {
      skillId: result.skillId,
      skillVersion: result.skillVersion,
      runFingerprint: result.runFingerprint,
      sourceNodeIds: [result.artifacts[0]?.sourceNodeIds[0] ?? ''],
      sourceArtifactIds: result.artifacts[0]
        ? [result.artifacts[0].artifactId]
        : [],
      resultType: 'shot-draft',
      resultId: shot.shotId,
      reviewStatus: 'approved',
      evidence: evidenceForShot(result.evidence, shot),
    },
  }
}

function compatibilityPrompt(shot: ShotReviewDraft) {
  const details = [
    shot.subject.trim() ? `主体：${shot.subject.trim()}` : '',
    shot.action.trim() ? `行动：${shot.action.trim()}` : '',
    `景别：${SHOT_SIZE_LABELS[shot.suggestedShotSize]}`,
  ].filter(Boolean)
  return `${shot.objective.trim() || shot.sourceText}\n\n[${details.join(' · ')}]`
}

export async function createApprovedShotDrafts({
  drafts,
  result,
  sourceNodeId,
  duplicateShotIds,
  onCreateNode,
}: {
  drafts: ShotReviewDraft[]
  result: CreatorSkillRunResult
  sourceNodeId: string
  duplicateShotIds: string[]
  onCreateNode: ShotListBuilderPanelProps['onCreateNode']
}): Promise<ApprovedShotDraftCreationOutcome> {
  const approved = drafts.filter((shot) => shot.decision === 'approved')
  const duplicateSet = new Set(duplicateShotIds)
  const skipped = approved
    .filter((shot) => duplicateSet.has(shot.shotId))
    .map((shot) => shot.shotId)
  const toCreate = approved.filter((shot) => !duplicateSet.has(shot.shotId))
  const createdIds: string[] = []
  const createdShotIds: string[] = []
  try {
    for (let index = 0; index < toCreate.length; index += 1) {
      const shot = toCreate[index]!
      const kindLabel = shot.outputKind === 'video'
        ? `视频 ${shot.duration}s`
        : '图片'
      const nodeId = await onCreateNode(shot.outputKind, {
        title: `镜头 · ${SHOT_SIZE_LABELS[shot.suggestedShotSize]} · ${kindLabel}`,
        prompt: compatibilityPrompt(shot),
        parentNodeId: sourceNodeId || undefined,
        index,
        total: toCreate.length,
        metadataJson: compatibilityMetadata(result, shot),
      })
      if (nodeId) {
        if (!createdIds.includes(nodeId)) createdIds.push(nodeId)
        createdShotIds.push(shot.shotId)
      }
    }
    return {
      createdIds,
      createdShotIds,
      duplicateShotIds: skipped,
      error: '',
      applyLocked: false,
    }
  } catch {
    return {
      createdIds,
      createdShotIds,
      duplicateShotIds: skipped,
      error: SHOT_PLAN_PARTIAL_APPLY_ERROR,
      applyLocked: true,
    }
  }
}

function compatibilityReportDrafts(drafts: ShotReviewDraft[]): ShotDraft[] {
  return drafts
    .filter((shot) => shot.decision === 'approved')
    .map((shot) => ({
      id: shot.shotId,
      kind: shot.outputKind,
      shotSize: shot.suggestedShotSize,
      description: shot.objective,
      cinematicNote: [shot.subject, shot.action].filter(Boolean).join(' · '),
      duration: shot.duration,
      selected: true,
    }))
}

export function canCopyShotReview(
  review: ShotReview,
  currentSourceIdentity: string,
) {
  return review.sourceIdentity === currentSourceIdentity
    && review.drafts.some((shot) => shot.decision === 'approved')
}

export function buildShotReviewReport(review: ShotReview) {
  const reportOptions: ShotListOptions = {
    ...DEFAULT_SHOT_OPTIONS,
    shotCount: review.options.requestedShotCount,
    outputMode: review.options.outputMode,
    pacing: review.options.pacing,
    shotSizeStrategy: review.options.shotSizeStrategy,
    userInstruction: review.options.userInstruction,
  }
  return buildShotListReport(
    compatibilityReportDrafts(review.drafts),
    review.sourceTitle,
    reportOptions,
    review.sourceText,
  )
}

function decisionClass(decision: CreatorSkillReviewStatus, selected: boolean) {
  if (!selected) return 'text-white/42 hover:bg-white/[0.06] hover:text-white/72'
  if (decision === 'approved') return 'bg-emerald-300/12 text-emerald-200'
  if (decision === 'rejected') return 'bg-rose-300/12 text-rose-200'
  return 'bg-white/[0.09] text-white/78'
}

function lineLabel(shot: ShotReviewDraft) {
  return shot.lineStart === shot.lineEnd
    ? `第 ${shot.lineStart} 行`
    : `第 ${shot.lineStart}-${shot.lineEnd} 行`
}

function temporarySource(): ShotListSourceNode {
  return {
    id: 'shot-list-draft-source',
    kind: 'text',
    title: '临时文本',
    prompt: '',
  }
}

export function ShotListBuilderPanel({
  nodes,
  initialNodeId,
  existingNodes = nodes,
  onApplyShotPlans,
  onCreateNode,
  onAutoGenerateNodes,
  onClose,
}: ShotListBuilderPanelProps) {
  const textNodes = nodes.filter((node) => (
    node.kind === 'text' && getNodeText(node).length > 0
  ))
  const firstId = initialNodeId && textNodes.some((node) => node.id === initialNodeId)
    ? initialNodeId
    : textNodes[0]?.id ?? ''
  const firstNode = textNodes.find((node) => node.id === firstId) ?? temporarySource()
  const firstText = getNodeText(firstNode)

  const [selectedNodeId, setSelectedNodeId] = useState(firstId)
  const [sourceDraftText, setSourceDraftText] = useState(firstText)
  const [countPreset, setCountPreset] = useState<CountPreset | 'custom'>(5)
  const [customCountStr, setCustomCountStr] = useState('6')
  const [outputMode, setOutputMode] = useState<ShotPlanningOptions['outputMode']>('mixed')
  const [pacing, setPacing] = useState<ShotPlanningOptions['pacing']>('standard')
  const [strategy, setStrategy] = useState<ShotPlanningOptions['shotSizeStrategy']>('auto')
  const [instruction, setInstruction] = useState('')
  const [copyDone, setCopyDone] = useState(false)
  const [isConfirmingGenerate, setIsConfirmingGenerate] = useState(false)
  const [isOperating, setIsOperating] = useState(false)
  const reviewGenerationRef = useRef(1)
  const nextOperationIdRef = useRef(0)
  const activeOperationIdsRef = useRef(new Set<number>())
  const currentOperationRef = useRef<ShotOperationToken | null>(null)

  const effectiveCount = countPreset === 'custom'
    ? Math.min(120, Math.max(1, Number.parseInt(customCountStr, 10) || 5))
    : countPreset
  const options: ShotPlanningOptions = {
    requestedShotCount: effectiveCount,
    outputMode,
    pacing,
    shotSizeStrategy: strategy,
    userInstruction: instruction,
  }
  const selectedNode = textNodes.find((node) => node.id === selectedNodeId)
    ?? temporarySource()
  const [panelState, setPanelState] = useState(() => (
    createShotListPanelState(firstNode, firstText, options)
  ))
  const { review, duplicateSceneIds, duplicateShotIds, applyError } = panelState
  const { result, displayResult, artifact, drafts } = review
  const currentIdentity = getShotListSourceIdentity(
    selectedNode,
    sourceDraftText,
    options,
  )
  const sourceIsCurrent = review.sourceIdentity === currentIdentity
  const approvedCount = drafts.filter((shot) => shot.decision === 'approved').length
  const liveOperationContextRef = useRef({
    sourceIdentity: currentIdentity,
    runFingerprint: result.runFingerprint,
  })
  liveOperationContextRef.current = {
    sourceIdentity: currentIdentity,
    runFingerprint: result.runFingerprint,
  }
  const canApply = sourceIsCurrent
    && result.status !== 'blocked'
    && artifact !== null
    && approvedCount > 0
    && !panelState.applyLocked
    && !isOperating
    && Boolean(onApplyShotPlans)

  const invalidateOperationContext = () => {
    reviewGenerationRef.current += 1
    currentOperationRef.current = null
    setIsConfirmingGenerate(false)
    setCopyDone(false)
  }

  const beginOperation = () => {
    if (activeOperationIdsRef.current.size > 0) return null
    const operationId = nextOperationIdRef.current + 1
    nextOperationIdRef.current = operationId
    const token = createShotOperationToken(
      review,
      reviewGenerationRef.current,
      operationId,
    )
    activeOperationIdsRef.current.add(operationId)
    currentOperationRef.current = token
    setIsOperating(true)
    return token
  }

  const operationIsCurrent = (token: ShotOperationToken) => (
    isShotOperationTokenCurrent(token, {
      ...liveOperationContextRef.current,
      reviewGeneration: reviewGenerationRef.current,
      operationId: currentOperationRef.current?.operationId ?? -1,
    })
  )

  const finishOperation = (token: ShotOperationToken) => {
    activeOperationIdsRef.current.delete(token.operationId)
    if (currentOperationRef.current?.operationId === token.operationId) {
      currentOperationRef.current = null
    }
    if (activeOperationIdsRef.current.size === 0) setIsOperating(false)
  }

  const updateSourceDraft = (next: string) => {
    if (next === sourceDraftText) return
    invalidateOperationContext()
    setSourceDraftText(next)
  }

  const replaceDrafts = (
    transform: (current: ShotReviewDraft[]) => ShotReviewDraft[],
  ) => {
    invalidateOperationContext()
    setPanelState((current) => ({
      ...current,
      applyError: current.applyLocked ? current.applyError : '',
      review: {
        ...current.review,
        drafts: transform(current.review.drafts),
      },
    }))
  }

  const rerun = (node = selectedNode, text = sourceDraftText) => {
    invalidateOperationContext()
    setPanelState(rerunShotListPanelState(node, text, options))
  }

  const handleNodeChange = (nodeId: string) => {
    const node = textNodes.find((item) => item.id === nodeId) ?? temporarySource()
    const text = getNodeText(node)
    invalidateOperationContext()
    setSelectedNodeId(nodeId)
    setSourceDraftText(text)
    setPanelState(createShotListPanelState(node, text, options))
  }

  const handleGroupedApply = async () => {
    if (!canApply || !artifact || !onApplyShotPlans) return
    let planned: ReturnType<typeof planShotPlanMaterialization>
    try {
      planned = planShotPlanMaterialization({
        result,
        approvalContext: {
          runFingerprint: result.runFingerprint,
          sourceArtifactId: artifact.artifactId,
        },
        approvedScenes: approvedShotPlanScenes(drafts, artifact),
        existingNodes,
      })
    } catch {
      setPanelState((current) => ({
        ...current,
        duplicateSceneIds: [],
        applyError: SHOT_PLAN_PLANNING_ERROR,
        applyLocked: false,
      }))
      return
    }
    const token = beginOperation()
    if (!token) return
    try {
      if (planned.create.length > 0) {
        await onApplyShotPlans(planned.create, {
          sourceNodeId: review.sourceNodeId,
          sourceText: review.sourceText,
        })
      }
      if (operationIsCurrent(token)) {
        setPanelState((current) => ({
          ...current,
          duplicateSceneIds: [...planned.duplicates],
          applyError: '',
        }))
      }
    } catch {
      if (operationIsCurrent(token)) {
        setPanelState((current) => ({
          ...current,
          duplicateSceneIds: [...planned.duplicates],
          applyError: SHOT_PLAN_PARTIAL_APPLY_ERROR,
          applyLocked: true,
        }))
      }
    } finally {
      finishOperation(token)
    }
  }

  const runCompatibilityCreate = async (generateAfterCreate: boolean) => {
    if (!sourceIsCurrent
      || approvedCount === 0
      || panelState.applyLocked) return
    const token = beginOperation()
    if (!token) return
    setIsConfirmingGenerate(false)
    const knownDuplicates = [
      ...new Set([
        ...existingCompatibilityShotIds(existingNodes, result),
        ...panelState.materializedShotIds,
      ]),
    ]
    try {
      const outcome = await createApprovedShotDrafts({
        drafts,
        result,
        sourceNodeId: selectedNode.id === 'shot-list-draft-source'
          ? ''
          : selectedNode.id,
        duplicateShotIds: knownDuplicates,
        onCreateNode,
      })
      let callbackError = ''
      let callbackLocked = outcome.applyLocked
      if (operationIsCurrent(token)
        && !outcome.error
        && generateAfterCreate
        && outcome.createdIds.length > 0
        && onAutoGenerateNodes) {
        try {
          await onAutoGenerateNodes(outcome.createdIds)
        } catch {
          callbackError = SHOT_PLAN_PARTIAL_APPLY_ERROR
          callbackLocked = true
        }
      }
      if (operationIsCurrent(token)) {
        setPanelState((current) => ({
          ...current,
          duplicateShotIds: outcome.duplicateShotIds,
          materializedShotIds: [
            ...new Set([
              ...current.materializedShotIds,
              ...outcome.createdShotIds,
            ]),
          ],
          createdCount: outcome.createdIds.length,
          applyError: outcome.error || callbackError,
          applyLocked: callbackLocked,
        }))
      }
    } finally {
      finishOperation(token)
    }
  }

  const handleCopy = () => {
    if (!canCopyShotReview(review, currentIdentity)) return
    const reportIdentity = review.sourceIdentity
    const report = buildShotReviewReport(review)
    void navigator.clipboard.writeText(report).then(() => {
      if (liveOperationContextRef.current.sourceIdentity === reportIdentity) {
        setCopyDone(true)
        window.setTimeout(() => setCopyDone(false), 2000)
      }
    })
  }

  return (
    <CreatorSkillRunPanel
      manifest={SHOT_PLANNING_MANIFEST}
      result={displayResult}
      canApply={canApply}
      applyLabel={`创建镜头规划节点 (${approvedCount})`}
      onRerun={() => rerun()}
      onApply={() => { void handleGroupedApply() }}
      onClose={onClose}
    >
      <div className="space-y-4">
        <section aria-labelledby="shot-source-heading" className="space-y-3">
          <h3 id="shot-source-heading" className="text-[11px] font-semibold text-white/72">
            来源与规划设置
          </h3>
          {textNodes.length > 0 ? (
            <select
              value={selectedNodeId}
              onChange={(event) => handleNodeChange(event.target.value)}
              className={selClass}
              aria-label="来源节点"
            >
              {textNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {getNodeLabel(node)} — {getNodeText(node).slice(0, 38)}
                </option>
              ))}
            </select>
          ) : (
            <p className="border-y border-white/[0.08] py-2 text-[11px] text-white/42">
              当前没有可用文本节点，可在下方输入临时文本进行规划。
            </p>
          )}

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="shot-list-source-draft" className="text-[10px] text-white/42">
                分镜文本
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="恢复来源文本"
                  onClick={() => updateSourceDraft(getNodeText(selectedNode))}
                  className="flex h-7 items-center gap-1 rounded-md px-2 text-[10px] text-white/42 hover:bg-white/[0.06] hover:text-white/72"
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  恢复
                </button>
                <button
                  type="button"
                  title="清空"
                  onClick={() => updateSourceDraft('')}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-white/42 hover:bg-rose-300/[0.08] hover:text-rose-200"
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
            <textarea
              id="shot-list-source-draft"
              value={sourceDraftText}
              onChange={(event) => updateSourceDraft(event.target.value)}
              rows={5}
              className={txClass}
              placeholder="粘贴剧本、故事梗概或镜头需求"
            />
            <p className="mt-1 text-[9px] text-white/28">
              草稿编辑仅影响本次规划，不会修改来源节点。编辑后请重新运行。
            </p>
          </div>

          <div className="grid gap-3 border-y border-white/[0.08] py-3 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-[10px] text-white/42">目标数量</span>
              <div className="flex items-center gap-1">
                {COUNT_PRESETS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      if (countPreset === count) return
                      invalidateOperationContext()
                      setCountPreset(count)
                    }}
                    className={`h-7 min-w-8 rounded-md px-2 text-[10px] font-semibold ${countPreset === count ? 'bg-cyan-200/12 text-cyan-100' : 'bg-white/[0.04] text-white/42 hover:bg-white/[0.08]'}`}
                  >
                    {count}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={countPreset === 'custom' ? customCountStr : ''}
                  placeholder="自定"
                  onFocus={() => {
                    if (countPreset === 'custom') return
                    invalidateOperationContext()
                    setCountPreset('custom')
                  }}
                  onChange={(event) => {
                    if (countPreset !== 'custom'
                      || customCountStr !== event.target.value) {
                      invalidateOperationContext()
                    }
                    setCountPreset('custom')
                    setCustomCountStr(event.target.value)
                  }}
                  className="h-7 w-16 rounded-md border border-white/10 bg-[#181b20] px-1 text-center text-[10px] text-white/72 outline-none focus:border-cyan-200/35"
                />
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-[10px] text-white/42">输出类型</span>
              <VisualTagPicker
                options={OUTPUT_MODE_OPTIONS}
                value={outputMode}
                onChange={(value) => {
                  if (value === outputMode) return
                  invalidateOperationContext()
                  setOutputMode(value)
                }}
              />
            </div>
            <div>
              <span className="mb-1.5 block text-[10px] text-white/42">节奏</span>
              <VisualTagPicker
                options={PACING_OPTIONS}
                value={pacing}
                onChange={(value) => {
                  if (value === pacing) return
                  invalidateOperationContext()
                  setPacing(value)
                }}
              />
            </div>
            <div>
              <span className="mb-1.5 block text-[10px] text-white/42">景别策略</span>
              <VisualTagPicker
                options={STRATEGY_OPTIONS}
                value={strategy}
                onChange={(value) => {
                  if (value === strategy) return
                  invalidateOperationContext()
                  setStrategy(value)
                }}
              />
            </div>
            <label className="sm:col-span-2 text-[10px] text-white/42">
              补充要求
              <textarea
                value={instruction}
                onChange={(event) => {
                  if (event.target.value === instruction) return
                  invalidateOperationContext()
                  setInstruction(event.target.value)
                }}
                rows={2}
                className={`mt-1.5 ${txClass}`}
                placeholder="仅用于选择与呈现，不会补写来源中不存在的情节"
              />
            </label>
          </div>
        </section>

        {!sourceIsCurrent ? (
          <p role="alert" className="border-y border-amber-300/15 bg-amber-300/[0.05] px-2.5 py-2 text-[11px] leading-5 text-amber-100/80">
            来源或规划设置已变化，请重新运行后再创建节点。
          </p>
        ) : null}

        {duplicateSceneIds.length > 0 ? (
          <div role="status" data-testid="shot-plan-duplicates" className="flex items-start gap-2 border-y border-amber-300/15 bg-amber-300/[0.05] px-2.5 py-2 text-[11px] leading-5 text-amber-100/80">
            <AlertTriangle size={13} className="mt-0.5 flex-none" aria-hidden="true" />
            <p>已存在并跳过镜头规划：{duplicateSceneIds.join('、')}</p>
          </div>
        ) : null}

        {applyError ? (
          <p role="alert" className="border-y border-rose-300/15 bg-rose-300/[0.05] px-2.5 py-2 text-[11px] leading-5 text-rose-100/80">
            {applyError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-semibold text-white/72">镜头审核</h3>
          <span className="text-[10px] text-white/35">
            {approvedCount}/{drafts.length} 已批准
            {panelState.removedShotIds.length > 0
              ? ` · ${panelState.removedShotIds.length} 已移除`
              : ''}
          </span>
        </div>

        {artifact ? (
          <div data-testid="shot-plan-scene-list" className="divide-y divide-white/[0.1] border-y border-white/[0.1]">
            {artifact.payload.scenes.map((scene) => {
              const sceneDrafts = drafts.filter((shot) => shot.sceneId === scene.sceneId)
              return (
                <section key={scene.sceneId} className="py-3 first:pt-2 last:pb-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="text-[11px] font-semibold text-white/74">
                      场景 {scene.order}{scene.heading ? ` · ${scene.heading}` : ''}
                    </h4>
                    <span className="text-[9px] text-white/30">{sceneDrafts.length} 个镜头</span>
                  </div>
                  <ol className="mt-2 divide-y divide-white/[0.07]">
                    {sceneDrafts.map((shot, index) => {
                      const evidence = evidenceForShot(result.evidence, shot)
                      return (
                        <li key={shot.shotId} className="py-3 first:pt-1 last:pb-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-white/52">
                              镜头 {index + 1} · {lineLabel(shot)}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="上移"
                                aria-label={`上移镜头 ${index + 1}`}
                                disabled={index === 0}
                                onClick={() => replaceDrafts((current) => moveShotReviewDraft(current, shot.shotId, -1))}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-white/42 hover:bg-white/[0.07] hover:text-white/78 disabled:opacity-25"
                              >
                                <ArrowUp size={13} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                title="下移"
                                aria-label={`下移镜头 ${index + 1}`}
                                disabled={index === sceneDrafts.length - 1}
                                onClick={() => replaceDrafts((current) => moveShotReviewDraft(current, shot.shotId, 1))}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-white/42 hover:bg-white/[0.07] hover:text-white/78 disabled:opacity-25"
                              >
                                <ArrowDown size={13} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                title="移除"
                                aria-label={`移除镜头 ${index + 1}`}
                                onClick={() => {
                                  invalidateOperationContext()
                                  setPanelState((current) => ({
                                    ...current,
                                    removedShotIds: current.removedShotIds.includes(shot.shotId)
                                      ? current.removedShotIds
                                      : [...current.removedShotIds, shot.shotId],
                                    review: {
                                      ...current.review,
                                      drafts: removeShotReviewDraft(current.review.drafts, shot.shotId),
                                    },
                                  }))
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-white/42 hover:bg-rose-300/[0.08] hover:text-rose-200"
                              >
                                <Trash2 size={13} aria-hidden="true" />
                              </button>
                            </div>
                          </div>

                          <div data-testid="shot-plan-decision" role="group" aria-label={`镜头 ${index + 1} 审核状态`} className="mt-2 inline-grid grid-cols-3 overflow-hidden rounded-md border border-white/10 bg-[#181b20]">
                            {REVIEW_DECISIONS.map((decision) => (
                              <button
                                key={decision.value}
                                type="button"
                                aria-pressed={shot.decision === decision.value}
                                onClick={() => replaceDrafts((current) => setShotReviewDecision(current, shot.shotId, decision.value))}
                                className={`min-h-7 border-r border-white/[0.08] px-2 text-[10px] font-medium last:border-r-0 ${decisionClass(decision.value, shot.decision === decision.value)}`}
                              >
                                {decision.label}
                              </button>
                            ))}
                          </div>

                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <label className="text-[9px] text-white/38 sm:col-span-2">
                              镜头目标
                              <input
                                value={shot.objective}
                                onChange={(event) => replaceDrafts((current) => updateShotReviewDraft(current, shot.shotId, { objective: event.target.value }))}
                                className={`${selClass} mt-1`}
                              />
                            </label>
                            <label className="text-[9px] text-white/38">
                              主体
                              <input
                                value={shot.subject}
                                onChange={(event) => replaceDrafts((current) => updateShotReviewDraft(current, shot.shotId, { subject: event.target.value }))}
                                className={`${selClass} mt-1`}
                              />
                            </label>
                            <label className="text-[9px] text-white/38">
                              行动
                              <input
                                value={shot.action}
                                onChange={(event) => replaceDrafts((current) => updateShotReviewDraft(current, shot.shotId, { action: event.target.value }))}
                                className={`${selClass} mt-1`}
                              />
                            </label>
                          </div>

                          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                            <div>
                              <span className="mb-1 block text-[9px] text-white/38">景别</span>
                              <VisualTagPicker
                                size="sm"
                                options={SHOT_SIZE_OPTIONS}
                                value={shot.suggestedShotSize}
                                onChange={(value) => replaceDrafts((current) => updateShotReviewDraft(current, shot.shotId, { suggestedShotSize: value }))}
                              />
                            </div>
                            <div className="inline-grid grid-cols-2 overflow-hidden rounded-md border border-white/10">
                              {(['image', 'video'] as ShotOutputKind[]).map((kind) => (
                                <button
                                  key={kind}
                                  type="button"
                                  aria-pressed={shot.outputKind === kind}
                                  onClick={() => replaceDrafts((current) => updateShotReviewDraft(current, shot.shotId, { outputKind: kind }))}
                                  className={`h-7 px-2 text-[10px] ${shot.outputKind === kind ? 'bg-white/[0.1] text-white/82' : 'text-white/38'}`}
                                >
                                  {kind === 'image' ? '图片' : '视频'}
                                </button>
                              ))}
                            </div>
                            {shot.outputKind === 'video' ? (
                              <div className="inline-grid grid-cols-2 overflow-hidden rounded-md border border-white/10">
                                {([5, 10] as const).map((duration) => (
                                  <button
                                    key={duration}
                                    type="button"
                                    aria-pressed={shot.duration === duration}
                                    onClick={() => replaceDrafts((current) => updateShotReviewDraft(current, shot.shotId, { duration }))}
                                    className={`h-7 px-2 text-[10px] ${shot.duration === duration ? 'bg-white/[0.1] text-white/82' : 'text-white/38'}`}
                                  >
                                    {duration}s
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          <details className="mt-2">
                            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[10px] font-medium text-white/38 hover:text-white/62">
                              <FileSearch size={12} aria-hidden="true" />
                              来源与证据 ({evidence.length})
                            </summary>
                            <blockquote className="mt-2 whitespace-pre-wrap break-words border-l border-cyan-200/25 pl-3 text-[11px] leading-5 text-white/58">
                              {shot.sourceText}
                            </blockquote>
                            {shot.needsReviewReason ? (
                              <p className="mt-1.5 text-[10px] text-amber-100/65">{shot.needsReviewReason}</p>
                            ) : null}
                          </details>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              )
            })}
          </div>
        ) : null}

        <section aria-labelledby="shot-compatibility-heading" className="w-full border-t border-white/[0.1] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="shot-compatibility-heading" className="text-[11px] font-semibold text-white/72">
              兼容草案动作
            </h3>
            <button
              type="button"
              title="复制已批准分镜清单"
              disabled={!canCopyShotReview(review, currentIdentity)}
              onClick={handleCopy}
              className="flex h-7 items-center gap-1 rounded-md px-2 text-[10px] text-white/42 hover:bg-white/[0.06] hover:text-white/72 disabled:opacity-30"
            >
              <Copy size={12} aria-hidden="true" />
              {copyDone ? '已复制' : '复制清单'}
            </button>
          </div>
          <div className="mt-2 grid w-full gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={!sourceIsCurrent || approvedCount === 0 || isOperating || panelState.applyLocked}
              onClick={() => { void runCompatibilityCreate(false) }}
              className="min-h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-[11px] font-semibold text-white/68 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-35"
            >
              创建已批准分镜节点
            </button>
            {onAutoGenerateNodes ? (
              <button
                type="button"
                disabled={!sourceIsCurrent || approvedCount === 0 || isOperating || panelState.applyLocked}
                onClick={() => setIsConfirmingGenerate(true)}
                className="min-h-9 w-full rounded-md border border-violet-300/20 bg-violet-300/[0.08] px-3 text-[11px] font-semibold text-violet-100/78 hover:bg-violet-300/[0.13] disabled:cursor-not-allowed disabled:opacity-35"
              >
                生成已批准镜头
              </button>
            ) : null}
          </div>

          {duplicateShotIds.length > 0 ? (
            <p role="status" className="mt-2 text-[10px] leading-4 text-amber-100/65">
              已存在并跳过 {duplicateShotIds.length} 个镜头：{duplicateShotIds.join('、')}
            </p>
          ) : null}
          {panelState.createdCount !== null ? (
            <p role="status" className="mt-2 text-[10px] text-emerald-200/70">
              本次实际创建 {panelState.createdCount} 个草案节点
            </p>
          ) : null}

          {isConfirmingGenerate ? (
            <div className="mt-3 border-y border-violet-300/15 bg-violet-300/[0.05] px-3 py-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-100/82">
                <Sparkles size={13} aria-hidden="true" />
                二次确认生成已批准镜头
              </p>
              <p className="mt-1 text-[10px] leading-4 text-violet-100/55">
                将调用当前生成服务，可能消耗 API 配额或平台积分。只会提交本次实际新建且未重复的节点。
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={isOperating}
                  onClick={() => { void runCompatibilityCreate(true) }}
                  className="h-8 rounded-md border border-violet-300/25 bg-violet-300/[0.12] px-3 text-[10px] font-semibold text-violet-100/82 hover:bg-violet-300/[0.18] disabled:opacity-35"
                >
                  确认生成
                </button>
                <button
                  type="button"
                  disabled={isOperating}
                  onClick={() => setIsConfirmingGenerate(false)}
                  className="h-8 rounded-md border border-white/10 bg-white/[0.04] px-3 text-[10px] font-semibold text-white/55 hover:bg-white/[0.08] disabled:opacity-35"
                >
                  取消
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </CreatorSkillRunPanel>
  )
}
