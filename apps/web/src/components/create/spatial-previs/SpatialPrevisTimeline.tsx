'use client'

import * as React from 'react'
import { sampleCamera } from '@/lib/spatial-previs/sampler'
import type { CameraKeyframe, SpatialPrevisBeat, SpatialPrevisState, Vec3 } from '@/lib/spatial-previs/types'

type SpatialPrevisTimelineProps = {
  state: SpatialPrevisState
  currentTimeSec: number
  onCurrentTimeChange: (timeSec: number) => void
  onBeatPatch: (beatId: string, patch: { position: Vec3; target: Vec3 }) => void
}

function formatTime(timeSec: number) {
  return `${Number.isInteger(timeSec) ? timeSec : timeSec.toFixed(1)}s`
}

function timelinePosition(timeSec: number, durationSec: number) {
  if (durationSec <= 0) return 0
  return Math.min(100, Math.max(0, (timeSec / durationSec) * 100))
}

function sampledBeatCamera(state: SpatialPrevisState, beat: SpatialPrevisBeat): CameraKeyframe | null {
  try {
    return sampleCamera(state.masterTake.cameraTrack.keyframes, (beat.startSec + beat.endSec) / 2)
  } catch {
    return null
  }
}

export function clampSpatialPrevisTime(timeSec: number, durationSec: number) {
  const duration = Number.isFinite(durationSec) ? Math.max(0, durationSec) : 0
  if (!Number.isFinite(timeSec)) return 0
  return Math.min(duration, Math.max(0, timeSec))
}

function TimelineTrack({
  label,
  keyframes,
  durationSec,
  onSelectTime,
}: {
  label: string
  keyframes: Array<{ id: string; timeSec: number }>
  durationSec: number
  onSelectTime: (timeSec: number) => void
}) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2" data-timeline-row={label}>
      <span className="truncate text-[11px] font-medium text-white/52">{label}</span>
      <div className="relative h-7 border-y border-white/[0.06] bg-white/[0.02]">
        {keyframes.map((keyframe) => (
          <button
            key={keyframe.id}
            type="button"
            aria-label={`${label} ${formatTime(keyframe.timeSec)}`}
            onClick={() => onSelectTime(keyframe.timeSec)}
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-cyan-100/60 bg-cyan-200/35 transition hover:bg-cyan-100/75 focus:outline-none focus:ring-1 focus:ring-cyan-100"
            style={{ left: `${timelinePosition(keyframe.timeSec, durationSec)}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function VectorInputs({
  label,
  value,
  onChange,
}: {
  label: string
  value: Vec3
  onChange: (next: Vec3) => void
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-[10px] text-white/38">{label}</legend>
      <div className="grid grid-cols-3 gap-1.5">
        {(['x', 'y', 'z'] as const).map((axis) => (
          <label key={axis} className="flex min-w-0 items-center gap-1 rounded-md border border-white/[0.08] bg-black/15 px-1.5 py-1 text-[10px] text-white/38">
            {axis.toUpperCase()}
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              aria-label={`${label} ${axis.toUpperCase()}`}
              value={value[axis]}
              onChange={(event) => {
                if (event.target.value === '') return
                const nextValue = Number(event.target.value)
                if (Number.isFinite(nextValue)) onChange({ ...value, [axis]: nextValue })
              }}
              className="min-w-0 flex-1 bg-transparent text-right text-[11px] text-white/78 outline-none focus:text-cyan-50"
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function ContinuousTimeline({
  state,
  currentTimeSec,
  onCurrentTimeChange,
}: Omit<SpatialPrevisTimelineProps, 'onBeatPatch'>) {
  const { masterTake } = state
  const durationSec = masterTake.durationSec

  return (
    <section aria-label="连续走位时间线" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-white/75">连续走位</h3>
          <p className="mt-0.5 text-[10px] text-white/35">主时间尺驱动预览与全部轨道。</p>
        </div>
        <output aria-live="polite" className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-cyan-100/80">
          {formatTime(currentTimeSec)} / {formatTime(durationSec)}
        </output>
      </div>

      <div className="rounded-md border border-white/[0.08] bg-black/15 p-2.5" role="group" aria-label="主时间尺">
        <label htmlFor="spatial-previs-current-time" className="mb-2 flex items-center justify-between text-[10px] text-white/42">
          <span>当前时间</span>
          <span>主时间尺</span>
        </label>
        <input
          id="spatial-previs-current-time"
          type="range"
          min="0"
          max={durationSec}
          step="0.1"
          value={currentTimeSec}
          onChange={(event) => onCurrentTimeChange(Number(event.target.value))}
          className="h-1.5 w-full accent-cyan-200"
        />
        <div className="mt-1 flex justify-between font-mono text-[9px] text-white/30" aria-hidden="true">
          <span>0s</span>
          <span>{formatTime(durationSec / 2)}</span>
          <span>{formatTime(durationSec)}</span>
        </div>
      </div>

      <div className="space-y-2" aria-label="演员与相机轨道">
        <TimelineTrack
          label="相机"
          keyframes={masterTake.cameraTrack.keyframes}
          durationSec={durationSec}
          onSelectTime={onCurrentTimeChange}
        />
        {masterTake.actorTracks.map((track, index) => (
          <TimelineTrack
            key={track.id}
            label={`演员 ${index + 1}`}
            keyframes={track.keyframes}
            durationSec={durationSec}
            onSelectTime={onCurrentTimeChange}
          />
        ))}
      </div>
    </section>
  )
}

function BeatTimeline({ state, onBeatPatch }: Pick<SpatialPrevisTimelineProps, 'state' | 'onBeatPatch'>) {
  return (
    <section aria-label="剧情节拍时间线" className="space-y-2.5">
      <div>
        <h3 className="text-xs font-semibold text-white/75">剧情节拍</h3>
        <p className="mt-0.5 text-[10px] text-white/35">在每个节拍区间的中点调整相机位置与目标。</p>
      </div>

      <div className="space-y-2" data-beat-intervals="true">
        {state.masterTake.beats.map((beat) => {
          const camera = sampledBeatCamera(state, beat)
          const midpoint = (beat.startSec + beat.endSec) / 2
          const position = camera?.position ?? { x: 0, y: 0, z: 0 }
          const target = camera?.target ?? { x: 0, y: 0, z: 0 }
          const patchPosition = (nextPosition: Vec3) => onBeatPatch(beat.id, { position: nextPosition, target })
          const patchTarget = (nextTarget: Vec3) => onBeatPatch(beat.id, { position, target: nextTarget })

          return (
            <article key={beat.id} data-beat-id={beat.id} className="rounded-md border border-white/[0.08] bg-white/[0.025] p-2.5">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1.5">
                <h4 className="text-[11px] font-medium text-white/75">{beat.label}</h4>
                <span className="font-mono text-[10px] text-cyan-100/60">
                  {formatTime(beat.startSec)} - {formatTime(beat.endSec)} · 中点 {formatTime(midpoint)}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <VectorInputs label="相机位置" value={position} onChange={patchPosition} />
                <VectorInputs label="相机目标" value={target} onChange={patchTarget} />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function SpatialPrevisTimeline({
  state,
  currentTimeSec,
  onCurrentTimeChange,
  onBeatPatch,
}: SpatialPrevisTimelineProps) {
  const safeCurrentTimeSec = clampSpatialPrevisTime(currentTimeSec, state.masterTake.durationSec)
  const selectTime = (timeSec: number) => onCurrentTimeChange(clampSpatialPrevisTime(timeSec, state.masterTake.durationSec))

  return (
    <section data-spatial-previs-timeline="true" data-master-take-id={state.masterTake.id} className="rounded-lg border border-white/12 bg-[#0b1014] p-3 text-white">
      {state.editorMode === 'continuous' ? (
        <ContinuousTimeline state={state} currentTimeSec={safeCurrentTimeSec} onCurrentTimeChange={selectTime} />
      ) : (
        <BeatTimeline state={state} onBeatPatch={onBeatPatch} />
      )}
    </section>
  )
}
