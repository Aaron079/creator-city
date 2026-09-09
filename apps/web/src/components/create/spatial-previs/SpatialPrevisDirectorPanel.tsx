'use client'

import * as React from 'react'
import { useMemo, useState } from 'react'
import { DirectorToolPanelFrame } from '@/components/canvas/tools/DirectorToolPanelFrame'
import { assessAuthoringRisks } from '@/lib/spatial-previs/coverage'
import { applyBeatPatch } from '@/lib/spatial-previs/normalize'
import type { SpatialPrevisMode, SpatialPrevisState, Vec3 } from '@/lib/spatial-previs/types'
import { SpatialPrevisTimeline, clampSpatialPrevisTime } from './SpatialPrevisTimeline'
import { SpatialPrevisViewport } from './SpatialPrevisViewport'

export type SpatialPrevisDirectorPanelProps = {
  initialState: SpatialPrevisState
  onSave: (state: SpatialPrevisState) => void | Promise<void>
  onClose: () => void
}

export function selectSpatialPrevisEditorMode(state: SpatialPrevisState, editorMode: SpatialPrevisMode): SpatialPrevisState {
  return state.editorMode === editorMode ? state : { ...state, editorMode }
}

export function SpatialPrevisDirectorPanel({ initialState, onSave, onClose }: SpatialPrevisDirectorPanelProps) {
  const [state, setState] = useState(initialState)
  const [currentTimeSec, setCurrentTimeSec] = useState(() => clampSpatialPrevisTime(0, initialState.masterTake.durationSec))
  const [beatError, setBeatError] = useState<string | null>(null)
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
    try {
      setState(applyBeatPatch(state, beatId, patch))
      setBeatError(null)
    } catch {
      setBeatError('无法更新节拍。')
    }
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
      onPrimary={() => onSave(state)}
      onClose={onClose}
      ariaLabel="三维预演 / SPATIAL PREVIS"
      bodyClassName="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
    >
      <section data-master-take-id={state.masterTake.id} className="space-y-3">
        <div className="inline-flex overflow-hidden rounded-md border border-white/12" role="tablist" aria-label="预演编辑模式">
          <button
            type="button"
            role="tab"
            aria-selected={state.editorMode === 'continuous'}
            onClick={() => setState((current) => selectSpatialPrevisEditorMode(current, 'continuous'))}
            className={`px-3 py-1.5 text-[11px] font-medium transition ${state.editorMode === 'continuous' ? 'bg-indigo-300/15 text-indigo-100' : 'bg-white/[0.025] text-white/48 hover:bg-white/[0.07] hover:text-white/75'}`}
          >
            连续走位
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={state.editorMode === 'beats'}
            onClick={() => setState((current) => selectSpatialPrevisEditorMode(current, 'beats'))}
            className={`border-l border-white/10 px-3 py-1.5 text-[11px] font-medium transition ${state.editorMode === 'beats' ? 'bg-indigo-300/15 text-indigo-100' : 'bg-white/[0.025] text-white/48 hover:bg-white/[0.07] hover:text-white/75'}`}
          >
            剧情节拍
          </button>
        </div>

        <SpatialPrevisViewport state={state} currentTimeSec={currentTimeSec} onChange={handleStateChange} />
        <SpatialPrevisTimeline
          state={state}
          currentTimeSec={currentTimeSec}
          onCurrentTimeChange={handleCurrentTimeChange}
          onBeatPatch={handleBeatPatch}
        />

        {beatError ? <p role="alert" className="text-[11px] text-amber-200/80">{beatError}</p> : null}

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
