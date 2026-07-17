'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, FileSearch } from 'lucide-react'
import {
  runCreatorSkill,
  SCRIPT_SEGMENTATION_MANIFEST,
  type CreatorSkillArtifact,
  type CreatorSkillEvidence,
  type CreatorSkillRunResult,
  type CreatorSkillSourceNode,
  type SceneBreakdownPayload,
  type ScriptSceneDraft,
} from '@/lib/skills'
import { CreatorSkillRunPanel } from './CreatorSkillRunPanel'
import {
  planScriptSceneMaterialization,
  type ApprovedSceneDraft,
  type SceneNodeMaterializationPlan,
} from './scriptSegmentationMaterialization'

export type ScriptSegmentationPanelProps = {
  sourceNode: CreatorSkillSourceNode
  existingNodes: Array<{ metadataJson?: unknown }>
  onApply: (plans: SceneNodeMaterializationPlan[]) => void
  onClose: () => void
}

type SceneBreakdownArtifact = CreatorSkillArtifact<SceneBreakdownPayload>

type SceneReviewDraft = ScriptSceneDraft & {
  approved: boolean
}

type ScriptSegmentationReview = {
  sourceIdentity: string
  sourceNodeId: string
  result: CreatorSkillRunResult
  displayResult: CreatorSkillRunResult
  artifact: SceneBreakdownArtifact | null
  drafts: SceneReviewDraft[]
}

type ScriptSegmentationPanelState = {
  review: ScriptSegmentationReview
  duplicateSceneIds: string[]
  applyError: string
  applyLocked: boolean
}

type ScriptSegmentationApplicationOutcome = {
  error: string
  applyLocked: boolean
}

export const SCRIPT_SEGMENTATION_PLANNING_ERROR = '无法规划当前审核结果，请检查场景内容后再试。'
export const SCRIPT_SEGMENTATION_PARTIAL_APPLY_ERROR = '场景创建过程中发生错误，部分节点可能已创建。请检查画布中的实际结果；当前审核批次已锁定。'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === 'string'
}

function isScriptSceneDraft(value: unknown): value is ScriptSceneDraft {
  if (!isRecord(value)) return false
  return typeof value.sceneId === 'string'
    && value.sceneId.trim().length > 0
    && Number.isInteger(value.order)
    && (value.order as number) > 0
    && typeof value.heading === 'string'
    && isOptionalString(value.location)
    && isOptionalString(value.timeOfDay)
    && Array.isArray(value.characters)
    && value.characters.every((character) => typeof character === 'string')
    && typeof value.actionSummary === 'string'
    && typeof value.sourceText === 'string'
    && value.sourceText.trim().length > 0
    && Number.isInteger(value.lineStart)
    && (value.lineStart as number) > 0
    && Number.isInteger(value.lineEnd)
    && (value.lineEnd as number) >= (value.lineStart as number)
    && value.reviewStatus === 'pending'
}

function isSceneBreakdownArtifact(
  artifact: CreatorSkillArtifact,
  sourceNodeId: string,
): artifact is SceneBreakdownArtifact {
  if (artifact.artifactType !== 'scene-breakdown') return false
  if (artifact.artifactVersion !== 1) return false
  if (!artifact.artifactId.trim()) return false
  if (artifact.sourceNodeIds.length !== 1 || artifact.sourceNodeIds[0] !== sourceNodeId) {
    return false
  }
  if (!isRecord(artifact.payload)) return false

  const { format, scenes } = artifact.payload
  if (format !== 'headed-script' && format !== 'paragraph-fallback') return false
  if (!Array.isArray(scenes) || scenes.length === 0 || !scenes.every(isScriptSceneDraft)) {
    return false
  }

  const sceneIds = new Set<string>()
  const sceneOrders = new Set<number>()
  const lineRanges = new Set<string>()
  for (const scene of scenes) {
    const range = `${scene.lineStart}:${scene.lineEnd}`
    if (sceneIds.has(scene.sceneId) || sceneOrders.has(scene.order) || lineRanges.has(range)) {
      return false
    }
    sceneIds.add(scene.sceneId)
    sceneOrders.add(scene.order)
    lineRanges.add(range)
  }
  return true
}

function narrowSceneBreakdown(
  result: CreatorSkillRunResult,
  sourceNodeId: string,
): SceneBreakdownArtifact | null {
  const candidates = result.artifacts.filter((artifact): artifact is SceneBreakdownArtifact => (
    isSceneBreakdownArtifact(artifact, sourceNodeId)
  ))
  return candidates.length === 1 ? candidates[0]! : null
}

function resultForDisplay(
  result: CreatorSkillRunResult,
  artifact: SceneBreakdownArtifact | null,
): CreatorSkillRunResult {
  if (artifact || result.status === 'blocked') return result
  return {
    ...result,
    status: 'blocked',
    blockers: [
      ...result.blockers,
      {
        code: 'SCENE_BREAKDOWN_INVALID',
        message: '分场结果无法安全读取，请重新运行。',
        sourceNodeId: result.artifacts[0]?.sourceNodeIds[0],
      },
    ],
  }
}

function sourceNodeSnapshot(sourceNode: CreatorSkillSourceNode): CreatorSkillSourceNode {
  return {
    id: sourceNode.id,
    kind: sourceNode.kind,
    title: sourceNode.title,
    prompt: sourceNode.prompt,
    ...(sourceNode.resultText !== undefined ? { resultText: sourceNode.resultText } : {}),
    ...(sourceNode.metadataJson !== undefined ? { metadataJson: sourceNode.metadataJson } : {}),
  }
}

export function getScriptSegmentationSourceIdentity(
  sourceNode: CreatorSkillSourceNode,
) {
  const effectiveText = sourceNode.resultText?.trim()
    ? sourceNode.resultText
    : sourceNode.prompt
  return JSON.stringify([sourceNode.id, sourceNode.kind, effectiveText])
}

export function runScriptSegmentationReview(
  sourceNode: CreatorSkillSourceNode,
): ScriptSegmentationReview {
  const sourceSnapshot = sourceNodeSnapshot(sourceNode)
  const result = runCreatorSkill('script-segmentation', {
    sourceNodes: [sourceSnapshot],
  })
  const artifact = narrowSceneBreakdown(result, sourceSnapshot.id)
  const drafts = artifact
    ? artifact.payload.scenes.map((scene) => ({
      ...scene,
      characters: [...scene.characters],
      approved: false,
    }))
    : []

  return {
    sourceIdentity: getScriptSegmentationSourceIdentity(sourceSnapshot),
    sourceNodeId: sourceSnapshot.id,
    result,
    displayResult: resultForDisplay(result, artifact),
    artifact,
    drafts,
  }
}

export function createScriptSegmentationPanelState(
  sourceNode: CreatorSkillSourceNode,
): ScriptSegmentationPanelState {
  return {
    review: runScriptSegmentationReview(sourceNode),
    duplicateSceneIds: [],
    applyError: '',
    applyLocked: false,
  }
}

export function resetScriptSegmentationPanelStateForSource(
  current: ScriptSegmentationPanelState,
  sourceNode: CreatorSkillSourceNode,
): ScriptSegmentationPanelState {
  return current.review.sourceIdentity === getScriptSegmentationSourceIdentity(sourceNode)
    ? current
    : createScriptSegmentationPanelState(sourceNode)
}

export function applyScriptSegmentationPlans(
  plans: SceneNodeMaterializationPlan[],
  onApply: (plans: SceneNodeMaterializationPlan[]) => void,
): ScriptSegmentationApplicationOutcome {
  if (plans.length === 0) return { error: '', applyLocked: false }
  try {
    onApply(plans)
    return { error: '', applyLocked: false }
  } catch {
    return {
      error: SCRIPT_SEGMENTATION_PARTIAL_APPLY_ERROR,
      applyLocked: true,
    }
  }
}

function approvedSceneDrafts(drafts: SceneReviewDraft[]): ApprovedSceneDraft[] {
  return drafts
    .filter((scene) => scene.approved)
    .map((scene) => ({
      sceneId: scene.sceneId,
      order: scene.order,
      heading: scene.heading,
      ...(scene.location !== undefined ? { location: scene.location } : {}),
      ...(scene.timeOfDay !== undefined ? { timeOfDay: scene.timeOfDay } : {}),
      characters: [...scene.characters],
      actionSummary: scene.actionSummary,
      sourceText: scene.sourceText,
      lineStart: scene.lineStart,
      lineEnd: scene.lineEnd,
      reviewStatus: 'approved',
    }))
}

function evidenceForScene(
  evidenceList: CreatorSkillEvidence[],
  sourceNodeId: string,
  scene: ScriptSceneDraft,
) {
  return evidenceList.filter((evidence) => (
    evidence.sourceNodeId === sourceNodeId
    && evidence.lineStart === scene.lineStart
    && evidence.lineEnd === scene.lineEnd
  ))
}

function lineLabel(scene: ScriptSceneDraft) {
  return scene.lineStart === scene.lineEnd
    ? `第 ${scene.lineStart} 行`
    : `第 ${scene.lineStart}-${scene.lineEnd} 行`
}

export function ScriptSegmentationPanel({
  sourceNode,
  existingNodes,
  onApply,
  onClose,
}: ScriptSegmentationPanelProps) {
  const [panelState, setPanelState] = useState(() => (
    createScriptSegmentationPanelState(sourceNode)
  ))
  const latestSourceNodeRef = useRef(sourceNode)
  latestSourceNodeRef.current = sourceNode
  const incomingSourceIdentity = getScriptSegmentationSourceIdentity(sourceNode)
  const { review, duplicateSceneIds, applyError, applyLocked } = panelState
  const { sourceNodeId, result, displayResult, artifact, drafts } = review
  const approvedCount = drafts.filter((scene) => scene.approved).length
  const hasBlankApprovedScene = drafts.some((scene) => (
    scene.approved && !scene.sourceText.trim()
  ))
  const sourceIsCurrent = review.sourceIdentity === incomingSourceIdentity
  const canApply = sourceIsCurrent
    && result.status !== 'blocked'
    && artifact !== null
    && approvedCount > 0
    && !hasBlankApprovedScene
    && !applyLocked

  useEffect(() => {
    setPanelState((current) => resetScriptSegmentationPanelStateForSource(
      current,
      latestSourceNodeRef.current,
    ))
  }, [incomingSourceIdentity])

  const handleRerun = () => {
    setPanelState(createScriptSegmentationPanelState(sourceNode))
  }

  const updateDraft = (
    sceneId: string,
    field: 'heading' | 'sourceText',
    value: string,
  ) => {
    setPanelState((current) => ({
      ...current,
      applyError: current.applyLocked ? current.applyError : '',
      review: {
        ...current.review,
        drafts: current.review.drafts.map((scene) => (
          scene.sceneId === sceneId ? { ...scene, [field]: value } : scene
        )),
      },
    }))
  }

  const toggleApproval = (sceneId: string) => {
    setPanelState((current) => ({
      ...current,
      applyError: current.applyLocked ? current.applyError : '',
      review: {
        ...current.review,
        drafts: current.review.drafts.map((scene) => (
          scene.sceneId === sceneId ? { ...scene, approved: !scene.approved } : scene
        )),
      },
    }))
  }

  const handleApply = () => {
    if (!canApply || !artifact) return
    const approvedScenes = approvedSceneDrafts(drafts)
    let planned: ReturnType<typeof planScriptSceneMaterialization>
    try {
      planned = planScriptSceneMaterialization({
        sourceNodeId,
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
        applyError: SCRIPT_SEGMENTATION_PLANNING_ERROR,
        applyLocked: false,
      }))
      return
    }

    const outcome = applyScriptSegmentationPlans(planned.create, onApply)
    setPanelState((current) => ({
      ...current,
      duplicateSceneIds: [...planned.duplicates],
      applyError: outcome.error,
      applyLocked: outcome.applyLocked,
    }))
  }

  return (
    <CreatorSkillRunPanel
      manifest={SCRIPT_SEGMENTATION_MANIFEST}
      result={displayResult}
      canApply={canApply}
      applyLabel={approvedCount > 0 ? `创建已批准场景 (${approvedCount})` : '请选择场景'}
      onRerun={handleRerun}
      onApply={handleApply}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-semibold text-white/72">
            场景审核
          </h3>
          <span className="text-[10px] text-white/35">
            {approvedCount}/{drafts.length} 已批准
          </span>
        </div>

        {duplicateSceneIds.length > 0 ? (
          <div
            role="status"
            data-testid="script-segmentation-duplicates"
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

        {drafts.length > 0 ? (
          <ol
            data-testid="script-segmentation-scene-list"
            className="divide-y divide-white/[0.08] border-y border-white/[0.08]"
          >
            {drafts.map((scene) => {
              const sceneEvidence = evidenceForScene(result.evidence, sourceNodeId, scene)
              const headingId = `script-scene-${scene.sceneId}-heading`
              const textId = `script-scene-${scene.sceneId}-text`
              return (
                <li key={scene.sceneId} className="py-3 first:pt-2 last:pb-2">
                  <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-2.5 gap-y-2">
                    <input
                      type="checkbox"
                      data-testid="script-segmentation-scene-checkbox"
                      data-scene-id={scene.sceneId}
                      aria-label={`批准场景 ${scene.order}`}
                      checked={scene.approved}
                      onChange={() => toggleApproval(scene.sceneId)}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-[#181b20] accent-cyan-300"
                    />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <label htmlFor={headingId} className="text-[10px] font-semibold text-white/52">
                          场景 {scene.order}
                        </label>
                        <span className="text-[9px] text-white/28">
                          {lineLabel(scene)}
                        </span>
                      </div>
                      <input
                        id={headingId}
                        type="text"
                        value={scene.heading}
                        onChange={(event) => updateDraft(scene.sceneId, 'heading', event.target.value)}
                        aria-label={`场景 ${scene.order} 标题`}
                        className="mt-1.5 h-8 w-full min-w-0 rounded-md border border-white/10 bg-[#181b20] px-2.5 text-[11px] text-white/82 outline-none transition placeholder:text-white/25 focus:border-cyan-200/35"
                      />
                    </div>

                    <div aria-hidden="true" />
                    <div className="min-w-0">
                      <label htmlFor={textId} className="sr-only">
                        场景 {scene.order} 文本
                      </label>
                      <textarea
                        id={textId}
                        value={scene.sourceText}
                        onChange={(event) => updateDraft(scene.sceneId, 'sourceText', event.target.value)}
                        rows={5}
                        className="w-full min-w-0 resize-y rounded-md border border-white/10 bg-[#181b20] px-2.5 py-2 text-[11px] leading-5 text-white/72 outline-none transition placeholder:text-white/25 focus:border-cyan-200/35"
                      />

                      {sceneEvidence.length > 0 ? (
                        <details className="mt-2">
                          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[10px] font-medium text-white/38 hover:text-white/62">
                            <FileSearch size={12} aria-hidden="true" />
                            证据 ({sceneEvidence.length})
                          </summary>
                          <div className="mt-2 space-y-2 border-l border-cyan-200/20 pl-2.5">
                            {sceneEvidence.map((evidence, index) => (
                              <blockquote
                                key={[scene.sceneId, evidence.evidenceId, index].join(':')}
                                className="whitespace-pre-wrap break-words text-[10px] leading-4 text-white/48"
                              >
                                {evidence.excerpt}
                              </blockquote>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="py-6 text-center text-[11px] text-white/38">
            暂无可审核场景
          </p>
        )}
      </div>
    </CreatorSkillRunPanel>
  )
}
