'use client'

import { Aperture, CircleDot, Footprints, MousePointer2, Move3d, Rotate3d, Timer, Waypoints } from 'lucide-react'
import * as React from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { applyCameraLens, clearActorRoute, deleteActorRoutePoint, ensureActorKeyframeAt, ensureCameraKeyframeAt } from '@/lib/spatial-previs/direct-manipulation'
import { setMasterTakeDuration } from '@/lib/spatial-previs/normalize'
import type { ShotScale, SpatialPrevisCameraMode, SpatialPrevisState } from '@/lib/spatial-previs/types'
import {
  applySpatialCameraAction,
  SpatialCameraControlStrip,
  type SpatialCameraAction,
} from './SpatialCameraControlStrip'

export const DIRECTOR_DURATION_OPTIONS = [5, 10, 15, 30, 45, 60, 90, 120, 180] as const

export const DIRECTOR_SHOT_SCALES: ReadonlyArray<{ label: string; value: ShotScale }> = [
  { label: '极近景', value: 'extreme-close-up' },
  { label: '特写', value: 'close-up' },
  { label: '近景', value: 'near' },
  { label: '中近景', value: 'medium-close' },
  { label: '中景', value: 'medium' },
  { label: '中全景', value: 'medium-wide' },
  { label: '全景', value: 'wide' },
  { label: '远景', value: 'long' },
  { label: '大远景', value: 'extreme-long' },
  { label: '建立镜头', value: 'establishing' },
]

export const DIRECTOR_LENS_FAMILIES = [
  [8, 10, 12, 14, 16, 18],
  [20, 21, 24, 25, 28, 32],
  [35, 40, 45, 50],
  [65, 75, 85, 100, 135],
  [150, 180, 200, 300, 400, 600],
] as const

export const DIRECTOR_CONTROL_POPOVERS = ['selection', 'duration', 'lens', 'camera-actions', 'actor-route'] as const

type DirectorControlPopover = typeof DIRECTOR_CONTROL_POPOVERS[number]
type DirectorSelectionTool = 'actor' | 'camera' | 'target'
type DirectorLensPatch = { focalLengthMm?: number; shotScale?: ShotScale }

type SpatialPrevisDirectorControlsProps = {
  state: SpatialPrevisState
  currentTimeSec: number
  actorTrackId?: string
  cameraMode?: SpatialPrevisCameraMode
  selectionTool?: DirectorSelectionTool
  actorSelectable?: boolean
  disabled?: boolean
  onChange: (next: SpatialPrevisState) => void
  onCurrentTimeChange?: (timeSec: number, destinationDurationSec?: number) => void
  onCameraModeChange?: (mode: SpatialPrevisCameraMode) => void
  onSelectionToolChange?: (tool: DirectorSelectionTool) => void
}

export function toggleDirectorPopover(
  activePopover: DirectorControlPopover | null,
  nextPopover: DirectorControlPopover,
): DirectorControlPopover | null {
  return activePopover === nextPopover ? null : nextPopover
}

export function closeDirectorPopover(
  _activePopover: DirectorControlPopover | null,
  _reason: 'escape' | 'outside-pointer',
): null {
  return null
}

export function changeDirectorDuration(
  state: SpatialPrevisState,
  currentTimeSec: number,
  durationSec: typeof DIRECTOR_DURATION_OPTIONS[number],
) {
  const nextState = setMasterTakeDuration(state, durationSec)
  const previousDurationSec = state.masterTake.durationSec
  const nextCurrentTimeSec = previousDurationSec > 0
    ? Math.min(nextState.masterTake.durationSec, Math.max(0, currentTimeSec * nextState.masterTake.durationSec / previousDurationSec))
    : currentTimeSec
  return { state: nextState, currentTimeSec: nextCurrentTimeSec }
}

export function recordDirectorCameraKeyframe(
  state: SpatialPrevisState,
  mode: SpatialPrevisCameraMode,
  currentTimeSec: number,
): SpatialPrevisState {
  return ensureCameraKeyframeAt(state, mode, currentTimeSec)?.state ?? state
}

export function applyDirectorLens(
  state: SpatialPrevisState,
  mode: SpatialPrevisCameraMode,
  currentTimeSec: number,
  patch: DirectorLensPatch,
): SpatialPrevisState {
  return applyCameraLens(state, mode, currentTimeSec, patch)
}

export function applyDirectorCameraAction(
  state: SpatialPrevisState,
  mode: SpatialPrevisCameraMode,
  currentTimeSec: number,
  action: SpatialCameraAction,
  actorTrackId?: string,
): SpatialPrevisState {
  return applySpatialCameraAction(state, currentTimeSec, action, actorTrackId, mode)
}

function DirectorToolButton({
  label,
  title,
  active = false,
  disabled = false,
  ariaExpanded,
  ariaControls,
  buttonRef,
  onClick,
  children,
}: {
  label: string
  title: string
  active?: boolean
  disabled?: boolean
  ariaExpanded?: boolean
  ariaControls?: string
  buttonRef?: React.Ref<HTMLButtonElement>
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      title={title}
      aria-pressed={active}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center border border-white/12 text-white/68 transition hover:border-cyan-200/35 hover:bg-cyan-200/[0.09] hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-35 ${active ? 'bg-cyan-300/15 text-cyan-50' : 'bg-white/[0.025]'}`}
    >
      {children}
    </button>
  )
}

export function SpatialPrevisDirectorControls({
  state,
  currentTimeSec,
  actorTrackId,
  cameraMode = 'director',
  selectionTool = 'camera',
  actorSelectable = Boolean(actorTrackId),
  disabled = false,
  onChange,
  onCurrentTimeChange,
  onCameraModeChange,
  onSelectionToolChange,
}: SpatialPrevisDirectorControlsProps) {
  const [activePopover, setActivePopover] = useState<DirectorControlPopover | null>(null)
  const [customFocalLength, setCustomFocalLength] = useState('')
  const controlsRef = useRef<HTMLElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRefs = useRef<Partial<Record<DirectorControlPopover, HTMLButtonElement | null>>>({})
  const controlsId = useId()

  const popoverId = (popover: DirectorControlPopover) => `${controlsId}-${popover}`

  useEffect(() => {
    if (!activePopover) return
    const frame = window.requestAnimationFrame(() => {
      const firstAction = popoverRef.current?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')
      ;(firstAction ?? popoverRef.current)?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activePopover])

  useEffect(() => {
    if (!activePopover) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePopover(closeDirectorPopover(activePopover, 'escape'))
        triggerRefs.current[activePopover]?.focus()
      }
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) {
        setActivePopover(closeDirectorPopover(activePopover, 'outside-pointer'))
      }
    }

    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
    }
  }, [activePopover])

  const togglePopover = (popover: DirectorControlPopover) => {
    if (!disabled) setActivePopover((active) => toggleDirectorPopover(active, popover))
  }
  const applyLens = (patch: DirectorLensPatch) => {
    const next = applyDirectorLens(state, cameraMode, currentTimeSec, patch)
    if (next !== state) onChange(next)
    setActivePopover(null)
  }

  const activePanelId = activePopover ? `${controlsId}-${activePopover}` : undefined

  return (
    <nav ref={controlsRef} aria-label="导演镜头控制" className="relative flex items-center gap-1 border-b border-white/10 bg-[#0b1014] px-3 py-2">
      <DirectorToolButton
        label="选择与拖拽"
        title="选择与拖拽"
        active={activePopover === 'selection'}
        disabled={disabled}
        ariaExpanded={activePopover === 'selection'}
        ariaControls={popoverId('selection')}
        buttonRef={(node) => { triggerRefs.current.selection = node }}
        onClick={() => togglePopover('selection')}
      >
        <MousePointer2 size={15} aria-hidden="true" />
      </DirectorToolButton>
      <DirectorToolButton
        label="摄影机位移与高度"
        title="摄影机位移与高度"
        active={selectionTool === 'camera'}
        disabled={disabled}
        onClick={() => {
          onSelectionToolChange?.('camera')
          setActivePopover(null)
        }}
      >
        <Move3d size={15} aria-hidden="true" />
      </DirectorToolButton>
      <DirectorToolButton
        label="摄影机角度"
        title="摄影机角度"
        active={selectionTool === 'target'}
        disabled={disabled}
        onClick={() => {
          onSelectionToolChange?.('target')
          setActivePopover(null)
        }}
      >
        <Rotate3d size={15} aria-hidden="true" />
      </DirectorToolButton>
      <DirectorToolButton
        label="记录相机关键帧"
        title="记录相机关键帧"
        disabled={disabled}
        onClick={() => {
          const next = recordDirectorCameraKeyframe(state, cameraMode, currentTimeSec)
          if (next !== state) onChange(next)
          setActivePopover(null)
        }}
      >
        <CircleDot size={15} aria-hidden="true" />
      </DirectorToolButton>
      <DirectorToolButton
        label="人物走位"
        title="人物走位"
        active={activePopover === 'actor-route'}
        disabled={disabled || !actorSelectable}
        ariaExpanded={activePopover === 'actor-route'}
        ariaControls={popoverId('actor-route')}
        buttonRef={(node) => { triggerRefs.current['actor-route'] = node }}
        onClick={() => { onSelectionToolChange?.('actor'); togglePopover('actor-route') }}
      >
        <Footprints size={15} aria-hidden="true" />
      </DirectorToolButton>
      <DirectorToolButton
        label="调整时长"
        title="调整时长"
        active={activePopover === 'duration'}
        disabled={disabled}
        ariaExpanded={activePopover === 'duration'}
        ariaControls={popoverId('duration')}
        buttonRef={(node) => { triggerRefs.current.duration = node }}
        onClick={() => togglePopover('duration')}
      >
        <Timer size={15} aria-hidden="true" />
      </DirectorToolButton>
      <div className="inline-flex shrink-0 overflow-hidden whitespace-nowrap border border-white/12" role="group" aria-label="机位模式">
        {([
          { label: 'Director', value: 'director' },
          { label: '航拍', value: 'aerial' },
        ] as const).map((mode) => (
          <button
            key={mode.value}
            type="button"
            aria-label={mode.label}
            aria-pressed={cameraMode === mode.value}
            disabled={disabled}
            onClick={() => {
              onCameraModeChange?.(mode.value)
              setActivePopover(null)
            }}
            className={`h-8 border-r border-white/10 px-2 text-[11px] font-medium transition last:border-r-0 hover:bg-cyan-200/[0.09] hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-35 ${cameraMode === mode.value ? 'bg-cyan-300/15 text-cyan-50' : 'bg-white/[0.025] text-white/68'}`}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <DirectorToolButton
        label="镜头参数"
        title="镜头参数"
        active={activePopover === 'lens'}
        disabled={disabled}
        ariaExpanded={activePopover === 'lens'}
        ariaControls={popoverId('lens')}
        buttonRef={(node) => { triggerRefs.current.lens = node }}
        onClick={() => togglePopover('lens')}
      >
        <Aperture size={15} aria-hidden="true" />
      </DirectorToolButton>
      <DirectorToolButton
        label="相机动作"
        title="相机动作"
        active={activePopover === 'camera-actions'}
        disabled={disabled}
        ariaExpanded={activePopover === 'camera-actions'}
        ariaControls={popoverId('camera-actions')}
        buttonRef={(node) => { triggerRefs.current['camera-actions'] = node }}
        onClick={() => togglePopover('camera-actions')}
      >
        <Waypoints size={15} aria-hidden="true" />
      </DirectorToolButton>

      {activePopover ? (
        <div ref={popoverRef} id={activePanelId} role="dialog" tabIndex={-1} aria-label={`${activePopover} 控制`} className="absolute left-3 top-full z-20 mt-1.5 max-w-[calc(100vw-3rem)] border border-white/15 bg-[#10171d] p-2 shadow-2xl">
          {activePopover === 'actor-route' ? (
            <div className="flex flex-col gap-1 text-left text-[11px]" role="group" aria-label="人物走位操作">
              <button type="button" disabled={disabled || !actorTrackId} className="px-2 py-1.5 text-left hover:bg-white/10" onClick={() => {
                const next = ensureActorKeyframeAt(state, actorTrackId!, currentTimeSec)?.state
                if (next && next !== state) onChange(next)
                setActivePopover(null)
              }}>记录走位点</button>
              <button type="button" disabled={disabled || !state.masterTake.actorTracks.some(t => t.id === actorTrackId && t.keyframes.length > 1 && t.keyframes.some(k => k.timeSec === currentTimeSec))} className="px-2 py-1.5 text-left hover:bg-white/10 disabled:opacity-35" onClick={() => {
                onChange(deleteActorRoutePoint(state, actorTrackId!, currentTimeSec))
                setActivePopover(null)
              }}>删除当前走位点</button>
              <button type="button" disabled={disabled || !actorTrackId} className="px-2 py-1.5 text-left hover:bg-white/10" onClick={() => {
                if (!window.confirm('清除所选人物的全部走位点，并保持当前位置？人物动作和摄影机轨道不会改变。')) return
                onChange(clearActorRoute(state, actorTrackId!, currentTimeSec))
                setActivePopover(null)
              }}>清除走位，保持当前位置</button>
            </div>
          ) : null}
          {activePopover === 'selection' ? (
            <div className="flex items-center gap-1" role="group" aria-label="选择与拖拽对象">
              {([
                { label: '演员', value: 'actor' },
                { label: '机位', value: 'camera' },
                { label: '视线', value: 'target' },
              ] as const).map((tool) => (
                <button
                  key={tool.value}
                  type="button"
                  aria-pressed={selectionTool === tool.value}
                  disabled={disabled || (tool.value === 'actor' && !actorSelectable)}
                  onClick={() => {
                    onSelectionToolChange?.(tool.value)
                    setActivePopover(null)
                  }}
                  className={`h-7 border border-white/12 px-2 text-[11px] transition hover:border-cyan-200/35 hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-35 ${selectionTool === tool.value ? 'bg-cyan-300/15 text-cyan-50' : 'bg-white/[0.025] text-white/68'}`}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          ) : null}

          {activePopover === 'duration' ? (
            <div className="flex items-center gap-1" role="group" aria-label="预演时长">
              {DIRECTOR_DURATION_OPTIONS.map((durationSec) => (
                <button
                  key={durationSec}
                  type="button"
                  aria-pressed={state.masterTake.durationSec === durationSec}
                  onClick={() => {
                    const next = changeDirectorDuration(state, currentTimeSec, durationSec)
                    onChange(next.state)
                    onCurrentTimeChange?.(next.currentTimeSec, next.state.masterTake.durationSec)
                    setActivePopover(null)
                  }}
                  className="h-7 border border-white/12 bg-white/[0.025] px-2 text-[11px] text-white/68 transition hover:border-cyan-200/35 hover:text-cyan-50"
                >
                  {durationSec}s
                </button>
              ))}
            </div>
          ) : null}

          {activePopover === 'lens' ? (
            <div className="w-72 space-y-2">
              <div className="grid grid-cols-5 gap-1" role="group" aria-label="景别">
                {DIRECTOR_SHOT_SCALES.map((shotScale) => (
                  <button
                    key={shotScale.value}
                    type="button"
                    aria-label={`选择${shotScale.label}`}
                    onClick={() => applyLens({ shotScale: shotScale.value })}
                    className="h-7 border border-white/12 bg-white/[0.025] px-1 text-[10px] text-white/68 transition hover:border-cyan-200/35 hover:text-cyan-50"
                  >
                    {shotScale.label}
                  </button>
                ))}
              </div>
              <div className="space-y-1" role="group" aria-label="焦段">
                {DIRECTOR_LENS_FAMILIES.map((family) => (
                  <div key={family.join('-')} className="flex flex-wrap gap-1">
                    {family.map((focalLengthMm) => (
                      <button
                        key={focalLengthMm}
                        type="button"
                        aria-label={`选择 ${focalLengthMm} mm`}
                        onClick={() => applyLens({ focalLengthMm })}
                        className="h-7 min-w-8 border border-white/12 bg-white/[0.025] px-1.5 text-[10px] text-white/68 transition hover:border-cyan-200/35 hover:text-cyan-50"
                      >
                        {focalLengthMm}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  type="number"
                  min="8"
                  max="600"
                  inputMode="numeric"
                  aria-label="自定义焦段"
                  value={customFocalLength}
                  onChange={(event) => setCustomFocalLength(event.target.value)}
                  className="h-7 min-w-0 flex-1 border border-white/12 bg-black/20 px-2 text-[11px] text-white outline-none focus:border-cyan-200/55"
                />
                <button
                  type="button"
                  aria-label="应用自定义焦段"
                  onClick={() => applyLens({ focalLengthMm: Number(customFocalLength) })}
                  className="h-7 border border-white/12 bg-white/[0.025] px-2 text-[11px] text-white/68 transition hover:border-cyan-200/35 hover:text-cyan-50"
                >
                  应用
                </button>
              </div>
            </div>
          ) : null}

          {activePopover === 'camera-actions' ? (
            <SpatialCameraControlStrip
              state={state}
              currentTimeSec={currentTimeSec}
              actorTrackId={actorTrackId}
              mode={cameraMode}
              disabled={disabled}
              onChange={onChange}
              onActionSelected={() => setActivePopover(null)}
            />
          ) : null}
        </div>
      ) : null}
    </nav>
  )
}
