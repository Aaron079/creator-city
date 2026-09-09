'use client'

import * as React from 'react'
import { useId, useMemo, useRef, useState } from 'react'
import { DirectorToolPanelFrame } from '@/components/canvas/tools/DirectorToolPanelFrame'
import { assessAuthoringRisks } from '@/lib/spatial-previs/coverage'
import { applyBeatPatch } from '@/lib/spatial-previs/normalize'
import type { BeatPatch, SpatialPrevisMode, SpatialPrevisState, Vec3 } from '@/lib/spatial-previs/types'
import { SpatialPrevisTimeline, clampSpatialPrevisTime } from './SpatialPrevisTimeline'
import { SpatialPrevisViewport } from './SpatialPrevisViewport'

export type SpatialPrevisDirectorPanelProps = {
  initialState: SpatialPrevisState
  onSave: (state: SpatialPrevisState) => void | 'success' | 'failed' | Promise<void | 'success' | 'failed'>
  onClose: () => void
}

type SpatialPrevisSaveResult = 'success' | 'failed' | 'pending'

type SpatialPrevisSaveCallback = SpatialPrevisDirectorPanelProps['onSave']

export function createSpatialPrevisSaveGuard() {
  let pending = false

  return {
    isPending: () => pending,
    async save(state: SpatialPrevisState, onSave: SpatialPrevisSaveCallback): Promise<SpatialPrevisSaveResult> {
      if (pending) return 'pending'
      pending = true
      try {
        return await onSave(state) === 'failed' ? 'failed' : 'success'
      } catch {
        return 'failed'
      } finally {
        pending = false
      }
    },
  }
}

export function selectSpatialPrevisEditorMode(state: SpatialPrevisState, editorMode: SpatialPrevisMode): SpatialPrevisState {
  return state.editorMode === editorMode ? state : { ...state, editorMode }
}

export function nextSpatialPrevisEditorMode(editorMode: SpatialPrevisMode, key: string): SpatialPrevisMode | null {
  if (key === 'ArrowLeft' || key === 'ArrowRight') return editorMode === 'continuous' ? 'beats' : 'continuous'
  if (key === 'Home') return 'continuous'
  if (key === 'End') return 'beats'
  return null
}

export function applySpatialPrevisBeatPatch(state: SpatialPrevisState, beatId: string, patch: BeatPatch) {
  try {
    return { state: applyBeatPatch(state, beatId, patch), error: null }
  } catch {
    return { state, error: '无法更新节拍。' }
  }
}

export function SpatialPrevisDirectorPanel({ initialState, onSave, onClose }: SpatialPrevisDirectorPanelProps) {
  const [state, setState] = useState(initialState)
  const [currentTimeSec, setCurrentTimeSec] = useState(() => clampSpatialPrevisTime(0, initialState.masterTake.durationSec))
  const [beatError, setBeatError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const saveGuard = useRef(createSpatialPrevisSaveGuard())
  const tabId = useId()
  const timelinePanelId = `spatial-previs-${tabId}-timeline`
  const tabIds: Record<SpatialPrevisMode, string> = {
    continuous: `spatial-previs-${tabId}-continuous-tab`,
    beats: `spatial-previs-${tabId}-beats-tab`,
  }
  const tabRefs = useRef<Record<SpatialPrevisMode, HTMLButtonElement | null>>({ continuous: null, beats: null })
  const risks = useMemo(() => assessAuthoringRisks(
    state.scene.coverage,
    state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.position),
  ), [state.masterTake.cameraTrack.keyframes, state.scene.coverage])

  const handleStateChange = (next: SpatialPrevisState) => {
    setState(next)
    setBeatError(null)
  }

  const handleCurrentTimeChange = (timeSec: number) => {
    setCurrentTimeSec(clampSpatialPrevisTime(timeSec, state.masterTake.durationSec))
  }

  const handleBeatPatch = (beatId: string, patch: { position: Vec3; target: Vec3 }) => {
    const result = applySpatialPrevisBeatPatch(state, beatId, patch)
    if (result.state !== state) setState(result.state)
    setBeatError(result.error)
  }

  const selectEditorMode = (editorMode: SpatialPrevisMode, focus = false) => {
    setState((current) => selectSpatialPrevisEditorMode(current, editorMode))
    if (focus) tabRefs.current[editorMode]?.focus()
  }

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const nextMode = nextSpatialPrevisEditorMode(state.editorMode, event.key)
    if (!nextMode) return
    event.preventDefault()
    selectEditorMode(nextMode, true)
  }

  const handleSave = async () => {
    if (saveGuard.current.isPending()) return
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(null)
    const result = await saveGuard.current.save(state, onSave)
    setIsSaving(false)
    if (result === 'success') setSaveSuccess('预演已保存')
    if (result === 'failed') setSaveError('保存预演失败。')
  }

  return (
    <DirectorToolPanelFrame
      title="三维预演"
      titleEn="SPATIAL PREVIS"
      icon="3D"
      accentColor="indigo"
      count={state.masterTake.beats.length}
      summary={`${state.masterTake.id} · ${state.masterTake.durationSec}s`}
      primaryLabel="保存预演"
      busy={isSaving}
      onPrimary={() => { void handleSave() }}
      onClose={onClose}
      ariaLabel="三维预演 / SPATIAL PREVIS"
      bodyClassName="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
    >
      <section data-master-take-id={state.masterTake.id} className="space-y-3">
        <div className="inline-flex overflow-hidden rounded-md border border-white/12" role="tablist" aria-label="预演编辑模式">
          <button
            type="button"
            role="tab"
            id={tabIds.continuous}
            aria-controls={timelinePanelId}
            aria-selected={state.editorMode === 'continuous'}
            tabIndex={state.editorMode === 'continuous' ? 0 : -1}
            ref={(element) => { tabRefs.current.continuous = element }}
            onClick={() => selectEditorMode('continuous')}
            onKeyDown={handleTabKeyDown}
            className={`px-3 py-1.5 text-[11px] font-medium transition ${state.editorMode === 'continuous' ? 'bg-indigo-300/15 text-indigo-100' : 'bg-white/[0.025] text-white/48 hover:bg-white/[0.07] hover:text-white/75'}`}
          >
            连续走位
          </button>
          <button
            type="button"
            role="tab"
            id={tabIds.beats}
            aria-controls={timelinePanelId}
            aria-selected={state.editorMode === 'beats'}
            tabIndex={state.editorMode === 'beats' ? 0 : -1}
            ref={(element) => { tabRefs.current.beats = element }}
            onClick={() => selectEditorMode('beats')}
            onKeyDown={handleTabKeyDown}
            className={`border-l border-white/10 px-3 py-1.5 text-[11px] font-medium transition ${state.editorMode === 'beats' ? 'bg-indigo-300/15 text-indigo-100' : 'bg-white/[0.025] text-white/48 hover:bg-white/[0.07] hover:text-white/75'}`}
          >
            剧情节拍
          </button>
        </div>

        <SpatialPrevisViewport state={state} currentTimeSec={currentTimeSec} onChange={handleStateChange} />
        <div role="tabpanel" id={timelinePanelId} aria-labelledby={tabIds[state.editorMode]}>
          <SpatialPrevisTimeline
            state={state}
            currentTimeSec={currentTimeSec}
            onCurrentTimeChange={handleCurrentTimeChange}
            onBeatPatch={handleBeatPatch}
          />
        </div>

        {beatError ? <p role="alert" className="text-[11px] text-amber-200/80">{beatError}</p> : null}
        {saveError ? <p role="alert" className="text-[11px] text-amber-200/80">{saveError}</p> : null}
        {saveSuccess ? <p role="status" className="text-[11px] text-emerald-200/80">{saveSuccess}</p> : null}

        <section aria-label="覆盖风险" className="border-t border-white/[0.08] pt-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">覆盖风险</p>
          {risks.length > 0 ? (
            <ul className="mt-1.5 space-y-1.5">
              {risks.map((risk) => (
                <li key={risk.code} className="text-[11px] leading-relaxed text-amber-100/70">
                  {risk.message} {risk.remedy}
                </li>
              ))}
            </ul>
          ) : <p className="mt-1.5 text-[11px] text-white/38">暂无覆盖风险。</p>}
        </section>
      </section>
    </DirectorToolPanelFrame>
  )
}
