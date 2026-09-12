'use client'

import * as React from 'react'
import { cameraTrackForMode, rotationFromTarget } from '@/lib/spatial-previs/camera'
import { ensureCameraKeyframeAt, isValidCameraOperationTime } from '@/lib/spatial-previs/direct-manipulation'
import { sampleActor } from '@/lib/spatial-previs/sampler'
import type { CameraKeyframe, CameraMotionBaseline, SpatialPrevisCameraMode, SpatialPrevisState, Vec3 } from '@/lib/spatial-previs/types'

const KEYFRAME_EPSILON = 1e-6
const POSITION_DELTA = 0.35
const TARGET_DELTA = 0.2

export const SPATIAL_CAMERA_ACTIONS = ['推', '拉', '摇', '移', '跟', '升', '降'] as const

export type SpatialCameraAction = typeof SPATIAL_CAMERA_ACTIONS[number]

function isSpatialPrevisCameraMode(mode: unknown): mode is SpatialPrevisCameraMode {
  return mode === 'director' || mode === 'aerial'
}

type SpatialCameraControlStripProps = {
  state: SpatialPrevisState
  currentTimeSec: number
  actorTrackId?: string
  mode?: SpatialPrevisCameraMode
  disabled?: boolean
  disabledReason?: string
  onChange: (next: SpatialPrevisState) => void
  onActionSelected?: () => void
}

function exactCameraKeyframe(keyframes: CameraKeyframe[], timeSec: number) {
  const matches = keyframes.filter((keyframe) => Math.abs(keyframe.timeSec - timeSec) <= KEYFRAME_EPSILON)
  return matches.length === 1 ? matches[0] : null
}

function actorPosition(state: SpatialPrevisState, timeSec: number, actorTrackId?: string) {
  if (!actorTrackId) return null
  const track = state.masterTake.actorTracks.find((item) => item.id === actorTrackId)
  return track?.keyframes.length ? sampleActor(track, timeSec).position : null
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
): Pick<CameraKeyframe, 'position' | 'target' | 'rotation' | 'focalLengthMm' | 'motionBaseline' | 'intent'> {
  const forward = direction(keyframe.position, keyframe.target)
  const right = lateralDirection(forward)

  const withMetadata = (
    patch: Pick<CameraKeyframe, 'position' | 'target' | 'focalLengthMm' | 'intent'>,
    motionBaseline: CameraMotionBaseline,
  ) => ({ ...patch, rotation: { ...rotationFromTarget(patch.position, patch.target), roll: keyframe.rotation.roll }, motionBaseline })

  switch (action) {
    case '推':
      return withMetadata({
        position: addVector(keyframe.position, scaleVector(forward, POSITION_DELTA)),
        target: { ...keyframe.target },
        focalLengthMm: keyframe.focalLengthMm,
        intent: 'push',
      }, 'push')
    case '拉':
      return withMetadata({
        position: addVector(keyframe.position, scaleVector(forward, -POSITION_DELTA)),
        target: { ...keyframe.target },
        focalLengthMm: keyframe.focalLengthMm,
        intent: 'pull',
      }, 'pull')
    case '摇':
      return withMetadata({
        position: { ...keyframe.position },
        target: addVector(addVector(keyframe.target, scaleVector(right, TARGET_DELTA)), { x: 0, y: 0.12, z: 0 }),
        focalLengthMm: keyframe.focalLengthMm,
        intent: 'pan-tilt',
      }, 'pan')
    case '移':
      return withMetadata({
        position: addVector(keyframe.position, scaleVector(right, POSITION_DELTA)),
        target: addVector(keyframe.target, scaleVector(right, POSITION_DELTA)),
        focalLengthMm: keyframe.focalLengthMm,
        intent: 'dolly',
      }, 'move')
    case '跟': {
      if (!actorPosition) throw new Error('Follow action requires an actor')
      const focus = { ...actorPosition, y: actorPosition.y + 1 }
      const rigDestination = addVector(actorPosition, { x: -forward.x * 3, y: 1.6, z: -forward.z * 3 })
      return withMetadata({
        position: stepToward(keyframe.position, rigDestination, POSITION_DELTA),
        target: stepToward(keyframe.target, focus, POSITION_DELTA),
        focalLengthMm: keyframe.focalLengthMm,
        intent: 'follow',
      }, 'follow')
    }
    case '升':
      return withMetadata({
        position: addVector(keyframe.position, { x: 0, y: POSITION_DELTA, z: 0 }),
        target: addVector(keyframe.target, { x: 0, y: POSITION_DELTA, z: 0 }),
        focalLengthMm: keyframe.focalLengthMm,
        intent: 'crane',
      }, 'rise')
    case '降':
      return withMetadata({
        position: addVector(keyframe.position, { x: 0, y: -POSITION_DELTA, z: 0 }),
        target: addVector(keyframe.target, { x: 0, y: -POSITION_DELTA, z: 0 }),
        focalLengthMm: keyframe.focalLengthMm,
        intent: 'crane',
      }, 'fall')
  }
}

export function applySpatialCameraAction(
  state: SpatialPrevisState,
  currentTimeSec: number,
  action: SpatialCameraAction,
  actorTrackId?: string,
  mode: SpatialPrevisCameraMode = 'director',
): SpatialPrevisState {
  if (!SPATIAL_CAMERA_ACTIONS.includes(action) || !isSpatialPrevisCameraMode(mode)) return state
  if (!isValidCameraOperationTime(state, currentTimeSec)) return state
  const actor = actorPosition(state, currentTimeSec, actorTrackId)
  if (action === '跟' && !actor) return state

  const ensured = ensureCameraKeyframeAt(state, mode, currentTimeSec)
  if (!ensured) return state
  const track = cameraTrackForMode(ensured.state.masterTake, mode)
  const patch = cameraPatch(ensured.keyframe, action, actor)
  return {
    ...ensured.state,
    masterTake: {
      ...ensured.state.masterTake,
      ...(mode === 'aerial'
        ? { aerialCameraTrack: { ...track, keyframes: track.keyframes.map((item) => item === ensured.keyframe ? { ...item, ...patch } : item) } }
        : { cameraTrack: { ...track, keyframes: track.keyframes.map((item) => item === ensured.keyframe ? { ...item, ...patch } : item) } }),
    },
  }
}

export function dispatchSpatialCameraAction({
  state,
  currentTimeSec,
  action,
  actorTrackId,
  mode = 'director',
  onChange,
}: {
  state: SpatialPrevisState
  currentTimeSec: number
  action: SpatialCameraAction
  actorTrackId?: string
  mode?: SpatialPrevisCameraMode
  onChange: (next: SpatialPrevisState) => void
}) {
  const next = applySpatialCameraAction(state, currentTimeSec, action, actorTrackId, mode)
  if (next !== state) onChange(next)
}

export function SpatialCameraControlStrip({
  state,
  currentTimeSec,
  actorTrackId,
  mode = 'director',
  disabled = false,
  disabledReason,
  onChange,
  onActionSelected,
}: SpatialCameraControlStripProps) {
  const hasValidMode = isSpatialPrevisCameraMode(mode)
  const hasExactKeyframe = hasValidMode && Boolean(exactCameraKeyframe(cameraTrackForMode(state.masterTake, mode).keyframes, currentTimeSec))
  const isDisabled = disabled || !hasValidMode
  const status = disabledReason ?? (!hasValidMode ? '当前相机模式无效' : hasExactKeyframe ? '当前相机关键帧可编辑' : '当前时间将创建相机关键帧')

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
              onActionSelected?.()
              dispatchSpatialCameraAction({ state, currentTimeSec, action, actorTrackId, mode, onChange })
            }}
            className="h-7 min-w-8 rounded-md border border-white/12 bg-white/[0.045] px-2 text-xs font-medium text-white/72 transition hover:border-cyan-200/35 hover:bg-cyan-200/[0.09] hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {action}
          </button>
        ))}
      </div>
    </section>
  )
}
