'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  FileSearch,
  Trash2,
} from 'lucide-react'
import {
  NARRATIVE_BEAT_ANALYSIS_MANIFEST,
  readApprovedCreatorSkillArtifact,
  runCreatorSkill,
  type CreatorSkillArtifact,
  type CreatorSkillEvidence,
  type CreatorSkillReviewStatus,
  type CreatorSkillRunResult,
  type CreatorSkillSourceNode,
  type NarrativeBeatDraft,
  type NarrativeBeatMapPayload,
  type NarrativeBeatType,
} from '@/lib/skills'
import { CreatorSkillRunPanel } from './CreatorSkillRunPanel'
import {
  planNarrativeBeatMaterialization,
  type ApprovedNarrativeBeatScene,
  type GroupedSkillNodePlan,
} from './groupedSkillMaterialization'

export type NarrativeBeatAnalysisPanelProps = {
  sourceNode: CreatorSkillSourceNode
  existingNodes: Array<{ metadataJson?: unknown }>
  onApply: (plans: GroupedSkillNodePlan[]) => void
  onClose: () => void
}

export type NarrativeBeatReviewDraft = NarrativeBeatDraft & {
  decision: CreatorSkillReviewStatus
}

type NarrativeBeatMapArtifact = CreatorSkillArtifact<NarrativeBeatMapPayload>

type NarrativeBeatReview = {
  sourceIdentity: string
  sourceNodeId: string
  approvedArtifactStatus: 'absent' | 'valid' | 'invalid'
  result: CreatorSkillRunResult
  displayResult: CreatorSkillRunResult
  artifact: NarrativeBeatMapArtifact | null
  drafts: NarrativeBeatReviewDraft[]
}

export type NarrativeBeatPanelState = {
  review: NarrativeBeatReview
  removedBeatIds: string[]
  duplicateSceneIds: string[]
  applyError: string
  applyLocked: boolean
}

type NarrativeBeatApplicationOutcome = {
  error: string
  applyLocked: boolean
}

const BEAT_TYPES: Array<{ value: NarrativeBeatType; label: string }> = [
  { value: 'setup', label: '建立' },
  { value: 'goal', label: '目标' },
  { value: 'action', label: '行动' },
  { value: 'reaction', label: '反应' },
  { value: 'turn', label: '转折' },
  { value: 'closure', label: '收束' },
  { value: 'unclassified', label: '待分类' },
]

const REVIEW_DECISIONS: Array<{
  value: CreatorSkillReviewStatus
  label: string
}> = [
  { value: 'pending', label: '待定' },
  { value: 'approved', label: '批准' },
  { value: 'rejected', label: '拒绝' },
]

export const NARRATIVE_BEAT_PLANNING_ERROR = '无法规划当前叙事节拍，请检查审核内容后再试。'
export const NARRATIVE_BEAT_PARTIAL_APPLY_ERROR = '节点创建过程中发生错误，部分节点可能已创建。请检查画布中的实际结果；当前审核批次已锁定。'

function sourceNodeSnapshot(
  sourceNode: CreatorSkillSourceNode,
): CreatorSkillSourceNode {
  return {
    id: sourceNode.id,
    kind: sourceNode.kind,
    title: sourceNode.title,
    prompt: sourceNode.prompt,
    ...(sourceNode.resultText !== undefined
      ? { resultText: sourceNode.resultText }
      : {}),
    ...(sourceNode.metadataJson !== undefined
      ? { metadataJson: sourceNode.metadataJson }
      : {}),
  }
}

function invalidApprovedArtifactResult(
  sourceNodeId: string,
): CreatorSkillRunResult {
  return {
    skillId: NARRATIVE_BEAT_ANALYSIS_MANIFEST.id,
    skillVersion: NARRATIVE_BEAT_ANALYSIS_MANIFEST.version,
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

function isNarrativeBeatDraft(value: unknown): value is NarrativeBeatDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const beat = value as Partial<NarrativeBeatDraft>
  return typeof beat.beatId === 'string'
    && beat.beatId.trim().length > 0
    && typeof beat.sceneId === 'string'
    && beat.sceneId.trim().length > 0
    && Number.isInteger(beat.order)
    && (beat.order ?? 0) > 0
    && BEAT_TYPES.some(({ value: type }) => type === beat.type)
    && typeof beat.sourceText === 'string'
    && typeof beat.summary === 'string'
    && Number.isInteger(beat.lineStart)
    && (beat.lineStart ?? 0) > 0
    && Number.isInteger(beat.lineEnd)
    && (beat.lineEnd ?? 0) >= (beat.lineStart ?? 0)
    && beat.reviewStatus === 'pending'
    && (beat.needsReviewReason === undefined
      || typeof beat.needsReviewReason === 'string')
}

function isNarrativeBeatMapArtifact(
  artifact: CreatorSkillArtifact,
): artifact is NarrativeBeatMapArtifact {
  if (artifact.artifactType !== 'narrative-beat-map'
    || artifact.artifactVersion !== 1
    || !artifact.payload
    || typeof artifact.payload !== 'object'
    || Array.isArray(artifact.payload)) {
    return false
  }
  const payload = artifact.payload as Partial<NarrativeBeatMapPayload>
  if (!Array.isArray(payload.scenes) || payload.scenes.length === 0) return false
  return payload.scenes.every((scene) => (
    Boolean(scene)
    && typeof scene.sceneId === 'string'
    && scene.sceneId.trim().length > 0
    && Number.isInteger(scene.order)
    && scene.order > 0
    && typeof scene.heading === 'string'
    && Array.isArray(scene.beats)
    && scene.beats.every(isNarrativeBeatDraft)
  ))
}

function narrowNarrativeBeatMap(
  result: CreatorSkillRunResult,
): NarrativeBeatMapArtifact | null {
  const artifacts = result.artifacts.filter(isNarrativeBeatMapArtifact)
  return artifacts.length === 1 ? artifacts[0]! : null
}

function resultForDisplay(
  result: CreatorSkillRunResult,
  artifact: NarrativeBeatMapArtifact | null,
): CreatorSkillRunResult {
  if (artifact || result.status === 'blocked') return result
  return {
    ...result,
    status: 'blocked',
    blockers: [
      ...result.blockers,
      {
        code: 'NARRATIVE_BEAT_MAP_INVALID',
        message: '叙事节拍结果无法安全读取，请重新运行。',
      },
    ],
  }
}

function effectiveSourceText(sourceNode: CreatorSkillSourceNode) {
  return sourceNode.resultText?.trim()
    ? sourceNode.resultText
    : sourceNode.prompt
}

export function getNarrativeBeatSourceIdentity(
  sourceNode: CreatorSkillSourceNode,
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
    effectiveSourceText(sourceNode),
    artifactIdentity,
  ])
}

export function runNarrativeBeatReview(
  sourceNode: CreatorSkillSourceNode,
): NarrativeBeatReview {
  const sourceSnapshot = sourceNodeSnapshot(sourceNode)
  const approvedArtifact = readApprovedCreatorSkillArtifact(
    sourceSnapshot.metadataJson,
  )
  if (approvedArtifact.status === 'invalid') {
    const blocked = invalidApprovedArtifactResult(sourceSnapshot.id)
    return {
      sourceIdentity: getNarrativeBeatSourceIdentity(sourceSnapshot),
      sourceNodeId: sourceSnapshot.id,
      approvedArtifactStatus: 'invalid',
      result: blocked,
      displayResult: blocked,
      artifact: null,
      drafts: [],
    }
  }

  const approvedSceneArtifact = approvedArtifact.status === 'valid'
    ? approvedArtifact.artifact
    : null
  const result = approvedSceneArtifact
    ? runCreatorSkill('narrative-beat-analysis', {
      sourceNodes: [sourceSnapshot],
      artifacts: [approvedSceneArtifact],
    })
    : runCreatorSkill('narrative-beat-analysis', {
      sourceNodes: [sourceSnapshot],
    })
  const artifact = narrowNarrativeBeatMap(result)
  const drafts = artifact
    ? artifact.payload.scenes.flatMap((scene) => scene.beats.map((beat) => ({
      ...beat,
      decision: 'pending' as const,
    })))
    : []

  return {
    sourceIdentity: getNarrativeBeatSourceIdentity(sourceSnapshot),
    sourceNodeId: sourceSnapshot.id,
    approvedArtifactStatus: approvedArtifact.status,
    result,
    displayResult: resultForDisplay(result, artifact),
    artifact,
    drafts,
  }
}

export function createNarrativeBeatPanelState(
  sourceNode: CreatorSkillSourceNode,
): NarrativeBeatPanelState {
  return {
    review: runNarrativeBeatReview(sourceNode),
    removedBeatIds: [],
    duplicateSceneIds: [],
    applyError: '',
    applyLocked: false,
  }
}

export function resetNarrativeBeatPanelStateForSource(
  current: NarrativeBeatPanelState,
  sourceNode: CreatorSkillSourceNode,
): NarrativeBeatPanelState {
  return current.review.sourceIdentity === getNarrativeBeatSourceIdentity(sourceNode)
    ? current
    : createNarrativeBeatPanelState(sourceNode)
}

export function updateNarrativeBeatDraft(
  drafts: NarrativeBeatReviewDraft[],
  beatId: string,
  patch: Partial<Pick<NarrativeBeatReviewDraft, 'summary' | 'type'>>,
) {
  let changed = false
  const next = drafts.map((beat) => {
    if (beat.beatId !== beatId) return beat
    const summary = patch.summary ?? beat.summary
    const type = patch.type ?? beat.type
    if (summary === beat.summary && type === beat.type) return beat
    changed = true
    return { ...beat, summary, type }
  })
  return changed ? next : drafts
}

export function setNarrativeBeatDecision(
  drafts: NarrativeBeatReviewDraft[],
  beatId: string,
  decision: CreatorSkillReviewStatus,
) {
  let changed = false
  const next = drafts.map((beat) => {
    if (beat.beatId !== beatId || beat.decision === decision) return beat
    changed = true
    return { ...beat, decision }
  })
  return changed ? next : drafts
}

export function moveNarrativeBeatDraft(
  drafts: NarrativeBeatReviewDraft[],
  beatId: string,
  direction: -1 | 1,
): NarrativeBeatReviewDraft[] {
  const index = drafts.findIndex((beat) => beat.beatId === beatId)
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

export function removeNarrativeBeatDraft(
  state: NarrativeBeatPanelState,
  beatId: string,
): NarrativeBeatPanelState {
  if (!state.review.drafts.some((beat) => beat.beatId === beatId)) return state
  return {
    ...state,
    applyError: state.applyLocked ? state.applyError : '',
    removedBeatIds: state.removedBeatIds.includes(beatId)
      ? state.removedBeatIds
      : [...state.removedBeatIds, beatId],
    review: {
      ...state.review,
      drafts: state.review.drafts.filter((beat) => beat.beatId !== beatId),
    },
  }
}

export function approvedNarrativeBeatScenes(
  drafts: NarrativeBeatReviewDraft[],
  artifact: NarrativeBeatMapArtifact | null,
): ApprovedNarrativeBeatScene[] {
  if (!artifact) return []
  return artifact.payload.scenes.flatMap((scene) => {
    const beats = drafts
      .filter((beat) => (
        beat.sceneId === scene.sceneId
        && beat.decision === 'approved'
      ))
      .map((beat) => ({
        beatId: beat.beatId,
        sceneId: beat.sceneId,
        order: beat.order,
        type: beat.type,
        sourceText: beat.sourceText,
        summary: beat.summary,
        lineStart: beat.lineStart,
        lineEnd: beat.lineEnd,
        reviewStatus: 'approved' as const,
        ...(beat.needsReviewReason !== undefined
          ? { needsReviewReason: beat.needsReviewReason }
          : {}),
      }))
    return beats.length > 0
      ? [{
        sceneId: scene.sceneId,
        order: scene.order,
        heading: scene.heading,
        beats,
      }]
      : []
  })
}

export function applyNarrativeBeatPlans(
  plans: GroupedSkillNodePlan[],
  onApply: (plans: GroupedSkillNodePlan[]) => void,
): NarrativeBeatApplicationOutcome {
  if (plans.length === 0) return { error: '', applyLocked: false }
  try {
    onApply(plans)
    return { error: '', applyLocked: false }
  } catch {
    return {
      error: NARRATIVE_BEAT_PARTIAL_APPLY_ERROR,
      applyLocked: true,
    }
  }
}

export function canApplyNarrativeBeatReview(
  state: NarrativeBeatPanelState,
  sourceNode: CreatorSkillSourceNode,
) {
  return state.review.sourceIdentity === getNarrativeBeatSourceIdentity(sourceNode)
    && state.review.result.status !== 'blocked'
    && state.review.artifact !== null
    && state.review.drafts.some((beat) => (
      beat.decision === 'approved' && beat.summary.trim().length > 0
    ))
    && !state.review.drafts.some((beat) => (
      beat.decision === 'approved' && !beat.summary.trim()
    ))
    && !state.applyLocked
}

function evidenceForBeat(
  evidenceList: CreatorSkillEvidence[],
  beat: NarrativeBeatReviewDraft,
) {
  return evidenceList.filter((evidence) => (
    evidence.lineStart === beat.lineStart
    && evidence.lineEnd === beat.lineEnd
    && evidence.excerpt === beat.sourceText
  ))
}

function lineLabel(beat: NarrativeBeatReviewDraft) {
  return beat.lineStart === beat.lineEnd
    ? `第 ${beat.lineStart} 行`
    : `第 ${beat.lineStart}-${beat.lineEnd} 行`
}

function decisionClass(decision: CreatorSkillReviewStatus, selected: boolean) {
  if (!selected) return 'text-white/42 hover:bg-white/[0.06] hover:text-white/72'
  if (decision === 'approved') return 'bg-emerald-300/12 text-emerald-200'
  if (decision === 'rejected') return 'bg-rose-300/12 text-rose-200'
  return 'bg-white/[0.09] text-white/78'
}

export function NarrativeBeatAnalysisPanel({
  sourceNode,
  existingNodes,
  onApply,
  onClose,
}: NarrativeBeatAnalysisPanelProps) {
  const [panelState, setPanelState] = useState(() => (
    createNarrativeBeatPanelState(sourceNode)
  ))
  const latestSourceNodeRef = useRef(sourceNode)
  latestSourceNodeRef.current = sourceNode
  const incomingSourceIdentity = getNarrativeBeatSourceIdentity(sourceNode)
  const {
    review,
    removedBeatIds,
    duplicateSceneIds,
    applyError,
  } = panelState
  const { result, displayResult, artifact, drafts } = review
  const approvedCount = drafts.filter((beat) => (
    beat.decision === 'approved'
  )).length
  const sourceIsCurrent = review.sourceIdentity === incomingSourceIdentity
  const canApply = sourceIsCurrent
    && canApplyNarrativeBeatReview(panelState, sourceNode)

  useEffect(() => {
    setPanelState((current) => resetNarrativeBeatPanelStateForSource(
      current,
      latestSourceNodeRef.current,
    ))
  }, [incomingSourceIdentity])

  const replaceDrafts = (
    transform: (current: NarrativeBeatReviewDraft[]) => NarrativeBeatReviewDraft[],
  ) => {
    setPanelState((current) => ({
      ...current,
      applyError: current.applyLocked ? current.applyError : '',
      review: {
        ...current.review,
        drafts: transform(current.review.drafts),
      },
    }))
  }

  const handleRerun = () => {
    setPanelState(createNarrativeBeatPanelState(sourceNode))
  }

  const handleRemove = (beatId: string) => {
    setPanelState((current) => removeNarrativeBeatDraft(current, beatId))
  }

  const handleApply = () => {
    if (!canApply || !artifact) return
    const approvedScenes = approvedNarrativeBeatScenes(drafts, artifact)
    let planned: ReturnType<typeof planNarrativeBeatMaterialization>
    try {
      planned = planNarrativeBeatMaterialization({
        result,
        approvalContext: {
          runFingerprint: result.runFingerprint,
          sourceArtifactId: artifact.artifactId,
        },
        approvedScenes,
        existingNodes,
      })
    } catch {
      setPanelState((current) => ({
        ...current,
        duplicateSceneIds: [],
        applyError: NARRATIVE_BEAT_PLANNING_ERROR,
        applyLocked: false,
      }))
      return
    }

    const outcome = applyNarrativeBeatPlans(planned.create, onApply)
    setPanelState((current) => ({
      ...current,
      duplicateSceneIds: [...planned.duplicates],
      applyError: outcome.error,
      applyLocked: outcome.applyLocked,
    }))
  }

  return (
    <CreatorSkillRunPanel
      manifest={NARRATIVE_BEAT_ANALYSIS_MANIFEST}
      result={displayResult}
      canApply={canApply}
      applyLabel={`创建叙事节拍节点 (${approvedCount})`}
      onRerun={handleRerun}
      onApply={handleApply}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-semibold text-white/72">叙事节拍审核</h3>
          <span className="text-[10px] text-white/35">
            {approvedCount}/{drafts.length} 已批准
            {removedBeatIds.length > 0 ? ` · ${removedBeatIds.length} 已移除` : ''}
          </span>
        </div>

        {!sourceIsCurrent ? (
          <p role="alert" className="border-y border-amber-300/15 bg-amber-300/[0.05] px-2.5 py-2 text-[11px] leading-5 text-amber-100/80">
            来源内容已变化，请重新运行后再创建节点。
          </p>
        ) : null}

        {duplicateSceneIds.length > 0 ? (
          <div
            role="status"
            data-testid="narrative-beat-duplicates"
            className="flex items-start gap-2 border-y border-amber-300/15 bg-amber-300/[0.05] px-2.5 py-2 text-[11px] leading-5 text-amber-100/80"
          >
            <AlertTriangle size={13} className="mt-0.5 flex-none" aria-hidden="true" />
            <p className="min-w-0 break-words">
              已存在并跳过：{duplicateSceneIds.join('、')}
            </p>
          </div>
        ) : null}

        {applyError ? (
          <p role="alert" className="border-y border-rose-300/15 bg-rose-300/[0.05] px-2.5 py-2 text-[11px] leading-5 text-rose-100/80">
            {applyError}
          </p>
        ) : null}

        {artifact ? (
          <div data-testid="narrative-beat-scene-list" className="divide-y divide-white/[0.1] border-y border-white/[0.1]">
            {artifact.payload.scenes.map((scene) => {
              const sceneDrafts = drafts.filter((beat) => (
                beat.sceneId === scene.sceneId
              ))
              return (
                <section
                  key={scene.sceneId}
                  aria-labelledby={`narrative-scene-${scene.sceneId}`}
                  className="py-3 first:pt-2 last:pb-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4
                      id={`narrative-scene-${scene.sceneId}`}
                      className="min-w-0 break-words text-[11px] font-semibold text-white/74"
                    >
                      场景 {scene.order}{scene.heading ? ` · ${scene.heading}` : ''}
                    </h4>
                    <span className="text-[9px] text-white/30">
                      {sceneDrafts.length} 个节拍
                    </span>
                  </div>

                  {sceneDrafts.length > 0 ? (
                    <ol className="mt-2 divide-y divide-white/[0.07]">
                      {sceneDrafts.map((beat, index) => {
                        const evidence = evidenceForBeat(result.evidence, beat)
                        const summaryId = `narrative-beat-${beat.beatId}-summary`
                        const typeId = `narrative-beat-${beat.beatId}-type`
                        return (
                          <li key={beat.beatId} className="py-3 first:pt-1 last:pb-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold text-white/52">
                                节拍 {index + 1} · {lineLabel(beat)}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  title="上移"
                                  aria-label={`上移节拍 ${index + 1}`}
                                  disabled={index === 0}
                                  onClick={() => replaceDrafts((current) => (
                                    moveNarrativeBeatDraft(current, beat.beatId, -1)
                                  ))}
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-white/42 transition hover:bg-white/[0.07] hover:text-white/78 disabled:cursor-not-allowed disabled:opacity-25"
                                >
                                  <ArrowUp size={13} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  title="下移"
                                  aria-label={`下移节拍 ${index + 1}`}
                                  disabled={index === sceneDrafts.length - 1}
                                  onClick={() => replaceDrafts((current) => (
                                    moveNarrativeBeatDraft(current, beat.beatId, 1)
                                  ))}
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-white/42 transition hover:bg-white/[0.07] hover:text-white/78 disabled:cursor-not-allowed disabled:opacity-25"
                                >
                                  <ArrowDown size={13} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  title="移除"
                                  aria-label={`移除节拍 ${index + 1}`}
                                  onClick={() => handleRemove(beat.beatId)}
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-white/42 transition hover:bg-rose-300/[0.08] hover:text-rose-200"
                                >
                                  <Trash2 size={13} aria-hidden="true" />
                                </button>
                              </div>
                            </div>

                            <div
                              data-testid="narrative-beat-decision"
                              role="group"
                              aria-label={`节拍 ${index + 1} 审核状态`}
                              className="mt-2 inline-grid grid-cols-3 overflow-hidden rounded-md border border-white/10 bg-[#181b20]"
                            >
                              {REVIEW_DECISIONS.map((decision) => (
                                <button
                                  key={decision.value}
                                  type="button"
                                  aria-pressed={beat.decision === decision.value}
                                  onClick={() => replaceDrafts((current) => (
                                    setNarrativeBeatDecision(
                                      current,
                                      beat.beatId,
                                      decision.value,
                                    )
                                  ))}
                                  className={`min-h-7 border-r border-white/[0.08] px-2 text-[10px] font-medium transition last:border-r-0 ${decisionClass(decision.value, beat.decision === decision.value)}`}
                                >
                                  {decision.label}
                                </button>
                              ))}
                            </div>

                            <div className="mt-2 grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
                              <div>
                                <label htmlFor={typeId} className="text-[9px] font-medium text-white/38">
                                  类型
                                </label>
                                <select
                                  id={typeId}
                                  value={beat.type}
                                  onChange={(event) => replaceDrafts((current) => (
                                    updateNarrativeBeatDraft(current, beat.beatId, {
                                      type: event.target.value as NarrativeBeatType,
                                    })
                                  ))}
                                  className="mt-1 h-8 w-full rounded-md border border-white/10 bg-[#181b20] px-2 text-[11px] text-white/78 outline-none focus:border-cyan-200/35"
                                >
                                  {BEAT_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                      {type.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="min-w-0">
                                <label htmlFor={summaryId} className="text-[9px] font-medium text-white/38">
                                  摘要
                                </label>
                                <input
                                  id={summaryId}
                                  type="text"
                                  value={beat.summary}
                                  onChange={(event) => replaceDrafts((current) => (
                                    updateNarrativeBeatDraft(current, beat.beatId, {
                                      summary: event.target.value,
                                    })
                                  ))}
                                  className="mt-1 h-8 w-full min-w-0 rounded-md border border-white/10 bg-[#181b20] px-2.5 text-[11px] text-white/78 outline-none placeholder:text-white/25 focus:border-cyan-200/35"
                                />
                              </div>
                            </div>

                            <details className="mt-2">
                              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[10px] font-medium text-white/38 hover:text-white/62">
                                <FileSearch size={12} aria-hidden="true" />
                                来源与证据 ({evidence.length})
                              </summary>
                              <blockquote className="mt-2 whitespace-pre-wrap break-words border-l border-cyan-200/25 pl-3 text-[11px] leading-5 text-white/58">
                                {beat.sourceText}
                              </blockquote>
                              {evidence.map((item, evidenceIndex) => (
                                <p
                                  key={`${item.evidenceId}:${evidenceIndex}`}
                                  className="mt-1.5 break-words text-[10px] leading-4 text-white/38"
                                >
                                  {item.explanation} · {item.evidenceId}
                                  <span className="sr-only">{item.excerpt}</span>
                                </p>
                              ))}
                            </details>
                          </li>
                        )
                      })}
                    </ol>
                  ) : (
                    <p className="mt-2 text-[10px] text-white/32">此场景的节拍已全部移除。</p>
                  )}
                </section>
              )
            })}
          </div>
        ) : null}
      </div>
    </CreatorSkillRunPanel>
  )
}
