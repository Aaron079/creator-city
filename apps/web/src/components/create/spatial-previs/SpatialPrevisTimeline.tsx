'use client'

import * as React from 'react'
import { sampleCamera } from '@/lib/spatial-previs/sampler'
import type { CameraKeyframe, SpatialPrevisBeat, SpatialPrevisCameraMode, SpatialPrevisState, Vec3 } from '@/lib/spatial-previs/types'

const CURVE_VIEWBOX_HEIGHT = 28

type SpatialPrevisTimelineProps = {
  state: SpatialPrevisState
  currentTimeSec: number
  disabled?: boolean
  cameraMode?: SpatialPrevisCameraMode
  onCurrentTimeChange: (timeSec: number) => void
  onCameraKeyframeRetime?: (keyframeId: string, timeSec: number) => void
  onActorKeyframeRetime?: (actorTrackId: string, keyframeId: string, timeSec: number) => void
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

export function commitSpatialNumericDraft(draft: string, previousValue: number) {
  if (draft.trim() === '') return previousValue
  const parsed = Number(draft)
  return Number.isFinite(parsed) ? parsed : previousValue
}

function curveCoordinates(keyframes: Array<{ timeSec: number; position: Vec3 }>, durationSec: number) {
  const zValues = keyframes.map((keyframe) => keyframe.position.z)
  const minZ = Math.min(...zValues)
  const maxZ = Math.max(...zValues)
  const span = maxZ - minZ
  return keyframes.map((keyframe) => {
    const x = timelinePosition(keyframe.timeSec, durationSec)
    const y = span < 1e-6 ? 14 : 23 - ((keyframe.position.z - minZ) / span) * 18
    return { x, y }
  })
}

function CurveTrack({
  label,
  kind,
  keyframes,
  durationSec,
  disabled = false,
  onSelectTime,
  onRetime,
}: {
  label: string
  kind: 'actor' | 'camera'
  keyframes: Array<{ id: string; timeSec: number; position: Vec3 }>
  durationSec: number
  disabled?: boolean
  onSelectTime: (timeSec: number) => void
  onRetime?: (keyframeId: string, timeSec: number) => void
}) {
  const dragRef = React.useRef<{ id: string; pointerId: number; moved: boolean } | null>(null)
  const suppressClickRef = React.useRef<string | null>(null)
  const stroke = kind === 'camera' ? '#fbbf24' : '#22d3ee'
  const coordinates = curveCoordinates(keyframes, durationSec)
  const resolveTime = (clientX: number, element: HTMLButtonElement) => {
    const rect = element.parentElement?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return 0
    return clampSpatialPrevisTime(((clientX - rect.left) / rect.width) * durationSec, durationSec)
  }

  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2" data-spatial-curve={kind}>
      <span className="truncate text-[11px] font-medium text-white/52">{label}</span>
      <div className="relative h-9 border-y border-white/[0.06] bg-white/[0.02]">
        <svg viewBox={`0 0 100 ${CURVE_VIEWBOX_HEIGHT}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <polyline points={coordinates.map(({ x, y }) => `${x},${y}`).join(' ')} fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.82" vectorEffect="non-scaling-stroke" />
        </svg>
        {keyframes.map((keyframe, index) => (
          <button
            key={keyframe.id}
            type="button"
            aria-label={`调整${label}关键帧 ${index + 1}，${formatTime(keyframe.timeSec)}`}
            aria-keyshortcuts="ArrowLeft ArrowRight Home End"
            disabled={disabled}
            onPointerDown={(event) => {
              if (disabled) return
              event.currentTarget.setPointerCapture(event.pointerId)
              dragRef.current = { id: keyframe.id, pointerId: event.pointerId, moved: false }
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current
              if (!drag || drag.id !== keyframe.id || drag.pointerId !== event.pointerId || !onRetime) return
              drag.moved = true
              const timeSec = resolveTime(event.clientX, event.currentTarget)
              onRetime(keyframe.id, timeSec)
              onSelectTime(timeSec)
            }}
            onPointerUp={(event) => {
              const drag = dragRef.current
              if (!drag || drag.id !== keyframe.id || drag.pointerId !== event.pointerId) return
              event.currentTarget.releasePointerCapture(event.pointerId)
              dragRef.current = null
              if (drag.moved) suppressClickRef.current = keyframe.id
              else onSelectTime(keyframe.timeSec)
            }}
            onPointerCancel={() => { dragRef.current = null }}
            onKeyDown={(event) => {
              if (disabled || !onRetime) return
              const step = event.shiftKey ? 1 : 0.5
              const nextTimeSec = event.key === 'ArrowLeft'
                ? keyframe.timeSec - step
                : event.key === 'ArrowRight'
                  ? keyframe.timeSec + step
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? durationSec
                      : null
              if (nextTimeSec === null) return
              event.preventDefault()
              const timeSec = clampSpatialPrevisTime(nextTimeSec, durationSec)
              onRetime(keyframe.id, timeSec)
              onSelectTime(timeSec)
            }}
            onClick={() => {
              if (suppressClickRef.current === keyframe.id) {
                suppressClickRef.current = null
                return
              }
              onSelectTime(keyframe.timeSec)
            }}
            className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/75 bg-[#0b1014] shadow-[0_0_0_2px_rgba(8,15,20,0.75)] transition hover:scale-110 focus:outline-none focus:ring-1 focus:ring-white"
            style={{
              left: `${timelinePosition(keyframe.timeSec, durationSec)}%`,
              top: `${((coordinates[index]?.y ?? 14) / CURVE_VIEWBOX_HEIGHT) * 100}%`,
              borderColor: stroke,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function VectorInputs({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string
  value: Vec3
  disabled?: boolean
  onChange: (next: Vec3) => void
}) {
  const [drafts, setDrafts] = React.useState(() => ({
    x: String(value.x),
    y: String(value.y),
    z: String(value.z),
  }))

  React.useEffect(() => {
    setDrafts({ x: String(value.x), y: String(value.y), z: String(value.z) })
  }, [value.x, value.y, value.z])

  const commitDraft = (axis: keyof Vec3) => {
    if (disabled) return
    const nextValue = commitSpatialNumericDraft(drafts[axis], value[axis])
    setDrafts((current) => ({ ...current, [axis]: String(nextValue) }))
    if (nextValue !== value[axis]) onChange({ ...value, [axis]: nextValue })
  }

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-[10px] text-white/38">{label}</legend>
      <div className="grid grid-cols-3 gap-1.5">
        {(['x', 'y', 'z'] as const).map((axis) => (
          <label key={axis} className="flex min-w-0 items-center gap-1 rounded-md border border-white/[0.08] bg-black/15 px-1.5 py-1 text-[10px] text-white/38">
            {axis.toUpperCase()}
            <input
              type="text"
              inputMode="decimal"
              aria-label={`${label} ${axis.toUpperCase()}`}
              value={drafts[axis]}
              readOnly={disabled}
              onChange={(event) => {
                if (!disabled) setDrafts((current) => ({ ...current, [axis]: event.target.value }))
              }}
              onBlur={() => commitDraft(axis)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
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
  disabled = false,
  onCurrentTimeChange,
  cameraMode = 'director',
  onCameraKeyframeRetime,
  onActorKeyframeRetime,
}: Omit<SpatialPrevisTimelineProps, 'onBeatPatch'>) {
  const { masterTake } = state
  const durationSec = masterTake.durationSec
  const activeCameraTrack = cameraMode === 'aerial' ? masterTake.aerialCameraTrack : masterTake.cameraTrack

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
          disabled={disabled}
          onChange={(event) => onCurrentTimeChange(Number(event.target.value))}
          className="h-1.5 w-full accent-cyan-200"
        />
        <div className="mt-1 flex justify-between font-mono text-[9px] text-white/30" aria-hidden="true">
          <span>0s</span>
          <span>{formatTime(durationSec / 2)}</span>
          <span>{formatTime(durationSec)}</span>
        </div>
      </div>

      <div className="space-y-2" aria-label="演员与相机曲线">
        <CurveTrack
          label="相机"
          kind="camera"
          keyframes={activeCameraTrack.keyframes}
          durationSec={durationSec}
          disabled={disabled}
          onSelectTime={onCurrentTimeChange}
          onRetime={onCameraKeyframeRetime}
        />
        {masterTake.actorTracks.map((track, index) => (
          <CurveTrack
            key={track.id}
            label={`演员 ${index + 1}`}
            kind="actor"
            keyframes={track.keyframes}
            durationSec={durationSec}
            disabled={disabled}
            onSelectTime={onCurrentTimeChange}
            onRetime={(keyframeId, timeSec) => onActorKeyframeRetime?.(track.id, keyframeId, timeSec)}
          />
        ))}
      </div>
    </section>
  )
}

function BeatTimeline({ state, disabled = false, onBeatPatch }: Pick<SpatialPrevisTimelineProps, 'state' | 'disabled' | 'onBeatPatch'>) {
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
                <VectorInputs label="相机位置" value={position} disabled={disabled} onChange={patchPosition} />
                <VectorInputs label="相机目标" value={target} disabled={disabled} onChange={patchTarget} />
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
  disabled = false,
  cameraMode = 'director',
  onCurrentTimeChange,
  onCameraKeyframeRetime,
  onActorKeyframeRetime,
  onBeatPatch,
}: SpatialPrevisTimelineProps) {
  const safeCurrentTimeSec = clampSpatialPrevisTime(currentTimeSec, state.masterTake.durationSec)
  const selectTime = (timeSec: number) => {
    if (!disabled) onCurrentTimeChange(clampSpatialPrevisTime(timeSec, state.masterTake.durationSec))
  }

  return (
    <section data-spatial-previs-timeline="true" data-master-take-id={state.masterTake.id} className="rounded-lg border border-white/12 bg-[#0b1014] p-3 text-white">
      {state.editorMode === 'continuous' ? (
        <ContinuousTimeline
          state={state}
          currentTimeSec={safeCurrentTimeSec}
          disabled={disabled}
          cameraMode={cameraMode}
          onCurrentTimeChange={selectTime}
          onCameraKeyframeRetime={onCameraKeyframeRetime}
          onActorKeyframeRetime={onActorKeyframeRetime}
        />
      ) : (
        <BeatTimeline state={state} disabled={disabled} onBeatPatch={onBeatPatch} />
      )}
    </section>
  )
}
