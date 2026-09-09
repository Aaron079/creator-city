'use client'

import * as React from 'react'
import type { CameraKeyframe, SpatialPrevisState, Vec3 } from '@/lib/spatial-previs/types'

const KEYFRAME_EPSILON = 1e-6
const POSITION_DELTA = 0.35
const TARGET_DELTA = 0.2

export const SPATIAL_CAMERA_ACTIONS = ['推/拉', '摇/俯仰', '移', '跟拍', '升/降'] as const

export type SpatialCameraAction = typeof SPATIAL_CAMERA_ACTIONS[number]

type SpatialCameraControlStripProps = {
  state: SpatialPrevisState
  currentTimeSec: number
  actorTrackId?: string
  disabled?: boolean
  disabledReason?: string
  onChange: (next: SpatialPrevisState) => void
}

function exactCameraKeyframe(keyframes: CameraKeyframe[], timeSec: number) {
  const matches = keyframes.filter((keyframe) => Math.abs(keyframe.timeSec - timeSec) <= KEYFRAME_EPSILON)
  return matches.length === 1 ? matches[0] : null
}

function exactActorPosition(state: SpatialPrevisState, timeSec: number, actorTrackId?: string) {
  const tracks = actorTrackId
    ? state.masterTake.actorTracks.filter((track) => track.id === actorTrackId)
    : state.masterTake.actorTracks
  for (const track of tracks) {
    const matches = track.keyframes.filter((keyframe) => Math.abs(keyframe.timeSec - timeSec) <= KEYFRAME_EPSILON)
    if (matches.length === 1) return matches[0]?.position ?? null
  }

  return null
}

function addVector(vector: Vec3, delta: Vec3): Vec3 {
  return { x: vector.x + delta.x, y: vector.y + delta.y, z: vector.z + delta.z }
}

function scaleVector(vector: Vec3, scale: number): Vec3 {
  return { x: vector.x * scale, y: vector.y * scale, z: vector.z * scale }
}

function direction(from: Vec3, to: Vec3): Vec3 {
  const delta = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
  const length = Math.hypot(delta.x, delta.y, delta.z)
  return length > 1e-6 ? scaleVector(delta, 1 / length) : { x: 0, y: 0, z: -1 }
}

function lateralDirection(forward: Vec3): Vec3 {
  const right = { x: -forward.z, y: 0, z: forward.x }
  const length = Math.hypot(right.x, right.z)
  return length > 1e-6 ? scaleVector(right, 1 / length) : { x: 1, y: 0, z: 0 }
}

function stepToward(from: Vec3, to: Vec3, maxDistance: number): Vec3 {
  const forward = direction(from, to)
  const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z)
  return addVector(from, scaleVector(forward, Math.min(distance, maxDistance)))
}

function cameraPatch(
  keyframe: CameraKeyframe,
  action: SpatialCameraAction,
  actorPosition: Vec3 | null,
): Pick<CameraKeyframe, 'position' | 'target' | 'focalLengthMm' | 'intent'> {
  const forward = direction(keyframe.position, keyframe.target)
  const right = lateralDirection(forward)

  switch (action) {
    case '推/拉': {
      const isPush = keyframe.intent !== 'push'
      const sign = isPush ? 1 : -1
      return {
        position: addVector(keyframe.position, scaleVector(forward, POSITION_DELTA * sign)),
        target: { ...keyframe.target },
        focalLengthMm: keyframe.focalLengthMm,
        intent: isPush ? 'push' : 'pull',
      }
    }
    case '摇/俯仰':
      return {
        position: { ...keyframe.position },
        target: addVector(addVector(keyframe.target, scaleVector(right, TARGET_DELTA)), { x: 0, y: 0.12, z: 0 }),
        focalLengthMm: keyframe.focalLengthMm,
        intent: 'pan-tilt',
      }
    case '移':
      return {
        position: addVector(keyframe.position, scaleVector(right, POSITION_DELTA)),
        target: addVector(keyframe.target, scaleVector(right, POSITION_DELTA)),
        focalLengthMm: keyframe.focalLengthMm,
        intent: 'dolly',
      }
    case '跟拍': {
      const focus = actorPosition ? { ...actorPosition, y: actorPosition.y + 1 } : addVector(keyframe.target, scaleVector(forward, POSITION_DELTA))
      const rigDestination = actorPosition
        ? addVector(actorPosition, { x: -forward.x * 3, y: 1.6, z: -forward.z * 3 })
        : addVector(keyframe.position, scaleVector(forward, POSITION_DELTA))
      return {
        position: stepToward(keyframe.position, rigDestination, POSITION_DELTA),
        target: stepToward(keyframe.target, focus, POSITION_DELTA),
        focalLengthMm: keyframe.focalLengthMm,
        intent: 'follow',
      }
    }
    case '升/降': {
      const isRise = keyframe.intent !== 'crane'
      const sign = isRise ? 1 : -1
      return {
        position: addVector(keyframe.position, { x: 0, y: POSITION_DELTA * sign, z: 0 }),
        target: addVector(keyframe.target, { x: 0, y: POSITION_DELTA * sign, z: 0 }),
        focalLengthMm: keyframe.focalLengthMm,
        intent: 'crane',
      }
    }
  }
}

export function applySpatialCameraAction(
  state: SpatialPrevisState,
  currentTimeSec: number,
  action: SpatialCameraAction,
  actorTrackId?: string,
): SpatialPrevisState {
  const keyframe = exactCameraKeyframe(state.masterTake.cameraTrack.keyframes, currentTimeSec)
  if (!keyframe || state.scene.coverage.cameraFreedom === 'disabled') return state

  const patch = cameraPatch(keyframe, action, exactActorPosition(state, currentTimeSec, actorTrackId))
  return {
    ...state,
    masterTake: {
      ...state.masterTake,
      cameraTrack: {
        ...state.masterTake.cameraTrack,
        keyframes: state.masterTake.cameraTrack.keyframes.map((item) => item === keyframe ? { ...item, ...patch } : item),
      },
    },
  }
}

export function dispatchSpatialCameraAction({
  state,
  currentTimeSec,
  action,
  actorTrackId,
  onChange,
}: {
  state: SpatialPrevisState
  currentTimeSec: number
  action: SpatialCameraAction
  actorTrackId?: string
  onChange: (next: SpatialPrevisState) => void
}) {
  const next = applySpatialCameraAction(state, currentTimeSec, action, actorTrackId)
  if (next !== state) onChange(next)
}

export function SpatialCameraControlStrip({
  state,
  currentTimeSec,
  actorTrackId,
  disabled = false,
  disabledReason,
  onChange,
}: SpatialCameraControlStripProps) {
  const hasExactKeyframe = Boolean(exactCameraKeyframe(state.masterTake.cameraTrack.keyframes, currentTimeSec))
  const isDisabled = disabled || !hasExactKeyframe
  const status = disabledReason ?? (hasExactKeyframe ? '当前相机关键帧可编辑' : '当前时间没有可编辑的相机关键帧')

  return (
    <section className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-[#0b1014] px-3 py-2" aria-label="局部相机控制">
      <div className="mr-1 text-[11px] font-medium text-white/45" aria-live="polite">{status}</div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="相机动作">
        {SPATIAL_CAMERA_ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            aria-label={action}
            disabled={isDisabled}
            onClick={() => {
              dispatchSpatialCameraAction({ state, currentTimeSec, action, actorTrackId, onChange })
            }}
            className="min-w-12 rounded-md border border-white/12 bg-white/[0.045] px-2.5 py-1.5 text-xs font-medium text-white/72 transition hover:border-cyan-200/35 hover:bg-cyan-200/[0.09] hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {action}
          </button>
        ))}
      </div>
    </section>
  )
}
