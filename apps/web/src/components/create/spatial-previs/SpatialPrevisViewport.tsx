'use client'

import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei/core/Line'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { PerspectiveCamera as DreiPerspectiveCamera } from '@react-three/drei/core/PerspectiveCamera'
import { Html } from '@react-three/drei/web/Html'
import * as React from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Plane, Vector3 } from 'three'
import type { PerspectiveCamera as ThreePerspectiveCamera } from 'three'
import {
  applyActorGroundDrag,
  applyCameraDollyDrag,
  applyCameraTargetDrag,
  applyObjectHeightDrag,
} from '@/lib/spatial-previs/direct-manipulation'
import type {
  ActorTrack,
  CameraKeyframe,
  SpatialPrevisState,
  Vec3,
  WhiteboxEntity,
} from '@/lib/spatial-previs/types'
import { sampleActor, sampleCamera } from '@/lib/spatial-previs/sampler'
import { SpatialCameraControlStrip } from './SpatialCameraControlStrip'

const KEYFRAME_EPSILON = 1e-6
const NUDGE_DELTA = 0.1
const WORLD_CAMERA_POSITION: [number, number, number] = [10, 8, 12]
const WORLD_CAMERA_TARGET: [number, number, number] = [0, 1, 0]
const WHITEBOX_COLORS: Record<WhiteboxEntity['kind'], string> = {
  floor: '#475569',
  wall: '#64748b',
  opening: '#d4a72c',
  volume: '#58735f',
  furniture: '#9a6149',
  referencePlane: '#5b7c99',
}
const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0)

type TransformSelection = 'actor' | 'camera' | 'target'

const TRANSFORM_SELECTION_LABELS: Record<TransformSelection, string> = {
  actor: '演员',
  camera: '相机',
  target: '目标',
}

const SPATIAL_NUDGE_AXES = [
  { axis: 'x-', label: '向 X 轴负向', shortLabel: 'X-' },
  { axis: 'x+', label: '向 X 轴正向', shortLabel: 'X+' },
  { axis: 'y-', label: '向 Y 轴负向', shortLabel: 'Y-' },
  { axis: 'y+', label: '向 Y 轴正向', shortLabel: 'Y+' },
  { axis: 'z-', label: '向 Z 轴负向', shortLabel: 'Z-' },
  { axis: 'z+', label: '向 Z 轴正向', shortLabel: 'Z+' },
] as const

type SpatialNudgeAxis = typeof SPATIAL_NUDGE_AXES[number]['axis']

type WorldAnchor = {
  id: string
  label: string
  position: Vec3
  color: string
}

type DirectDragKind = 'actor-ground' | 'camera-ground' | 'actor-height' | 'camera-height' | 'camera-target'

type DirectDragBindings = {
  begin: (kind: DirectDragKind, event: ThreeEvent<PointerEvent>, startY: number) => void
  move: (kind: DirectDragKind, event: ThreeEvent<PointerEvent>) => void
  end: (event: ThreeEvent<PointerEvent>) => void
  onDragStateChange: (active: boolean) => void
  setCursor: (cursor: 'grab' | 'grabbing' | 'ns-resize' | 'crosshair') => void
}

type DirectPointerHandlers = {
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void
  onPointerMove?: (event: ThreeEvent<PointerEvent>) => void
  onPointerUp?: (event: ThreeEvent<PointerEvent>) => void
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void
  onPointerOut?: () => void
}

type ActiveDirectDrag = {
  kind: DirectDragKind
  pointerId: number
  startClientY: number
  startY: number
  actorTrackId: string
}

type SpatialPrevisViewportProps = {
  state: SpatialPrevisState
  currentTimeSec: number
  disabled?: boolean
  onChange: (next: SpatialPrevisState) => void
}

type SpatialNudgeInput = {
  currentTimeSec: number
  selection: TransformSelection
  actorTrackId?: string
  axis: SpatialNudgeAxis
}

function tuple(vector: Vec3): [number, number, number] {
  return [vector.x, vector.y, vector.z]
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function exactKeyframe<T extends { timeSec: number }>(keyframes: T[], timeSec: number) {
  const matches = keyframes.filter((keyframe) => Math.abs(keyframe.timeSec - timeSec) <= KEYFRAME_EPSILON)
  return matches.length === 1 ? matches[0] : null
}

function initialActorPosition(track: ActorTrack, currentTimeSec: number) {
  return track.keyframes.length > 0 ? sampleActor(track, currentTimeSec).position : { x: 0, y: 0, z: 0 }
}

function nudgeDelta(axis: SpatialNudgeAxis): Vec3 {
  switch (axis) {
    case 'x-': return { x: -NUDGE_DELTA, y: 0, z: 0 }
    case 'x+': return { x: NUDGE_DELTA, y: 0, z: 0 }
    case 'y-': return { x: 0, y: -NUDGE_DELTA, z: 0 }
    case 'y+': return { x: 0, y: NUDGE_DELTA, z: 0 }
    case 'z-': return { x: 0, y: 0, z: -NUDGE_DELTA }
    case 'z+': return { x: 0, y: 0, z: NUDGE_DELTA }
  }
}

function addVector(vector: Vec3, delta: Vec3): Vec3 {
  return { x: vector.x + delta.x, y: vector.y + delta.y, z: vector.z + delta.z }
}

function worldAnchors(state: SpatialPrevisState, currentTimeSec: number): WorldAnchor[] {
  const coverage = state.scene.coverage
  const coveragePosition = coverage.mode === 'constrained'
    ? {
      x: (coverage.corridor.min.x + coverage.corridor.max.x) / 2,
      y: coverage.corridor.min.y,
      z: (coverage.corridor.min.z + coverage.corridor.max.z) / 2,
    }
    : { x: 2, y: 0, z: -1 }

  return [
    { id: 'scene-origin', label: '场景原点', position: { x: 0, y: 0, z: 0 }, color: '#a5f3fc' },
    { id: 'camera-coverage', label: '相机覆盖参考', position: coveragePosition, color: '#fde68a' },
    ...state.masterTake.actorTracks.map((track) => ({
      id: `actor-anchor-${track.id}`,
      label: track.anchorId,
      position: initialActorPosition(track, currentTimeSec),
      color: '#7dd3fc',
    })),
  ]
}

function replaceCameraKeyframe(state: SpatialPrevisState, keyframe: CameraKeyframe, patch: Partial<CameraKeyframe>) {
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

export function updateSpatialActorPosition(
  state: SpatialPrevisState,
  actorTrackId: string,
  currentTimeSec: number,
  position: Vec3,
) {
  const track = state.masterTake.actorTracks.find((item) => item.id === actorTrackId)
  const keyframe = track ? exactKeyframe(track.keyframes, currentTimeSec) : null
  if (!track || !keyframe) return state

  return {
    ...state,
    masterTake: {
      ...state.masterTake,
      actorTracks: state.masterTake.actorTracks.map((item) => item.id !== actorTrackId ? item : {
        ...item,
        keyframes: item.keyframes.map((actorKeyframe) => actorKeyframe === keyframe
          ? { ...actorKeyframe, position }
          : actorKeyframe),
      }),
    },
  }
}

export function applySpatialNudge(state: SpatialPrevisState, {
  currentTimeSec,
  selection,
  actorTrackId,
  axis,
}: SpatialNudgeInput): SpatialPrevisState {
  const delta = nudgeDelta(axis)

  if (selection === 'actor') {
    const track = state.masterTake.actorTracks.find((item) => item.id === actorTrackId)
    const keyframe = track ? exactKeyframe(track.keyframes, currentTimeSec) : null
    return track && keyframe
      ? updateSpatialActorPosition(state, track.id, currentTimeSec, addVector(keyframe.position, delta))
      : state
  }

  const keyframe = exactKeyframe(state.masterTake.cameraTrack.keyframes, currentTimeSec)
  if (!keyframe) return state

  return replaceCameraKeyframe(
    state,
    keyframe,
    selection === 'camera'
      ? { position: addVector(keyframe.position, delta) }
      : { target: addVector(keyframe.target, delta) },
  )
}

export function dispatchSpatialNudge({
  state,
  onChange,
  ...input
}: SpatialNudgeInput & {
  state: SpatialPrevisState
  onChange: (next: SpatialPrevisState) => void
}) {
  const next = applySpatialNudge(state, input)
  if (next !== state) onChange(next)
}

function WhiteboxEntityMesh({ entity }: { entity: WhiteboxEntity }) {
  return (
    <mesh
      castShadow
      receiveShadow
      position={tuple(entity.position)}
      rotation={[0, entity.rotationY, 0]}
    >
      <boxGeometry args={[entity.size.x, entity.size.y, entity.size.z]} />
      <meshStandardMaterial color={WHITEBOX_COLORS[entity.kind]} roughness={0.82} metalness={0.04} />
    </mesh>
  )
}

function ActorProxy({
  position,
  selected,
}: {
  position: Vec3
  selected: boolean
}) {
  const bodyColor = selected ? '#a5f3fc' : '#7dd3fc'
  const limbColor = selected ? '#67e8f9' : '#38bdf8'

  return (
    <group position={tuple(position)}>
      <mesh castShadow position={[0, 0.5, 0]}>
        <capsuleGeometry args={[0.23, 0.62, 6, 10]} />
        <meshStandardMaterial color={bodyColor} emissive={selected ? '#155e75' : '#082f49'} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 1.25, 0]}>
        <sphereGeometry args={[0.19, 16, 12]} />
        <meshStandardMaterial color="#d6eff7" roughness={0.62} />
      </mesh>
      <mesh castShadow position={[-0.31, 0.55, 0]} rotation={[0, 0, 0.42]}>
        <capsuleGeometry args={[0.07, 0.52, 4, 8]} />
        <meshStandardMaterial color={limbColor} roughness={0.56} />
      </mesh>
      <mesh castShadow position={[0.31, 0.55, 0]} rotation={[0, 0, -0.42]}>
        <capsuleGeometry args={[0.07, 0.52, 4, 8]} />
        <meshStandardMaterial color={limbColor} roughness={0.56} />
      </mesh>
      <mesh castShadow position={[-0.13, -0.42, 0]}>
        <capsuleGeometry args={[0.09, 0.42, 4, 8]} />
        <meshStandardMaterial color={limbColor} roughness={0.56} />
      </mesh>
      <mesh castShadow position={[0.13, -0.42, 0]}>
        <capsuleGeometry args={[0.09, 0.42, 4, 8]} />
        <meshStandardMaterial color={limbColor} roughness={0.56} />
      </mesh>
      <mesh position={[0, -0.67, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.44, 24]} />
        <meshBasicMaterial color={limbColor} transparent opacity={0.8} side={2} />
      </mesh>
    </group>
  )
}

function cameraRigRotation(position: Vec3, target: Vec3): [number, number, number] {
  const horizontalDistance = Math.hypot(target.x - position.x, target.z - position.z)
  return [
    Math.atan2(target.y - position.y, horizontalDistance || 0.001),
    Math.atan2(position.x - target.x, position.z - target.z),
    0,
  ]
}

function CameraRigMarker({
  position,
  target,
  selected,
}: {
  position: Vec3
  target: Vec3
  selected: boolean
}) {
  const color = selected ? '#facc15' : '#f59e0b'
  return (
    <group position={tuple(position)} rotation={cameraRigRotation(position, target)}>
      <mesh castShadow position={[0, 0.18, 0]}>
        <boxGeometry args={[0.8, 0.46, 0.56]} />
        <meshStandardMaterial color={color} emissive="#713f12" roughness={0.45} />
      </mesh>
      <mesh castShadow position={[0, 0.18, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.42, 20]} />
        <meshStandardMaterial color="#1f2937" metalness={0.45} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.18, -0.78]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.02, 20]} />
        <meshStandardMaterial color="#7dd3fc" emissive="#0e7490" roughness={0.18} metalness={0.2} />
      </mesh>
      <mesh castShadow position={[0, -0.12, 0.1]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#334155" roughness={0.38} metalness={0.35} />
      </mesh>
      <mesh castShadow position={[-0.26, -0.52, 0.25]} rotation={[-0.42, 0, -0.45]}>
        <cylinderGeometry args={[0.035, 0.035, 0.88, 8]} />
        <meshStandardMaterial color="#475569" roughness={0.42} metalness={0.32} />
      </mesh>
      <mesh castShadow position={[0.26, -0.52, 0.25]} rotation={[-0.42, 0, 0.45]}>
        <cylinderGeometry args={[0.035, 0.035, 0.88, 8]} />
        <meshStandardMaterial color="#475569" roughness={0.42} metalness={0.32} />
      </mesh>
      <mesh castShadow position={[0, -0.5, 0.46]} rotation={[0.48, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.86, 8]} />
        <meshStandardMaterial color="#475569" roughness={0.42} metalness={0.32} />
      </mesh>
      <Line
        points={[
          [0, 0.18, -0.8], [-0.62, 0.68, -3], [0.62, 0.68, -3], [0, 0.18, -0.8],
          [0.62, -0.32, -3], [-0.62, -0.32, -3], [0, 0.18, -0.8], [-0.62, 0.68, -3],
          [-0.62, -0.32, -3], [0.62, -0.32, -3], [0.62, 0.68, -3],
        ]}
        color="#fcd34d"
        lineWidth={1}
        transparent
        opacity={0.72}
      />
    </group>
  )
}

function TargetRing({ position, selected }: { position: Vec3; selected: boolean }) {
  return (
    <group position={tuple(position)}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.045, 8, 24]} />
        <meshBasicMaterial color={selected ? '#f472b6' : '#f9a8d4'} transparent opacity={0.95} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshBasicMaterial color="#fce7f3" />
      </mesh>
    </group>
  )
}

function WorldAnchorMarker({ anchor }: { anchor: WorldAnchor }) {
  return (
    <group position={tuple(anchor.position)}>
      <mesh position={[0, -0.56, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.18, 16]} />
        <meshBasicMaterial color={anchor.color} transparent opacity={0.9} side={2} />
      </mesh>
      <mesh position={[0, -0.4, 0]}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshBasicMaterial color={anchor.color} />
      </mesh>
      <Html center sprite distanceFactor={11} pointerEvents="none" position={[0, 0.04, 0]}>
        <span className="whitespace-nowrap rounded border border-white/15 bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-100 shadow-sm">
          {anchor.label}
        </span>
      </Html>
    </group>
  )
}

function pointerHandlers(kind: DirectDragKind, startY: number, bindings: DirectDragBindings): DirectPointerHandlers {
  const finish = (event: ThreeEvent<PointerEvent>) => bindings.end(event)

  return {
    onPointerDown: (event) => {
      bindings.onDragStateChange(true)
      bindings.begin(kind, event, startY)
    },
    onPointerMove: (event) => bindings.move(kind, event),
    onPointerUp: finish,
    onPointerOver: () => bindings.setCursor(kind === 'actor-height' || kind === 'camera-height' ? 'ns-resize' : kind === 'camera-target' ? 'crosshair' : 'grab'),
    onPointerOut: () => bindings.setCursor('grab'),
  }
}

function DirectDragCancellationGuard({ onCancel }: { onCancel: (pointerId: number) => void }) {
  const canvas = useThree((state) => state.gl.domElement)

  useEffect(() => {
    const cancel = (event: PointerEvent) => onCancel(event.pointerId)
    canvas.addEventListener('pointercancel', cancel)
    canvas.addEventListener('lostpointercapture', cancel)
    return () => {
      canvas.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('lostpointercapture', cancel)
    }
  }, [canvas, onCancel])

  return null
}

function DirectGroundDrag({
  kind,
  position,
  bindings,
  children,
}: {
  kind: 'actor-ground' | 'camera-ground'
  position: Vec3
  bindings: DirectDragBindings
  children: React.ReactNode
}) {
  return <group {...pointerHandlers(kind, position.y, bindings)}>{children}</group>
}

function VerticalDragGuide({
  position,
  bindings,
  kind,
}: {
  position: Vec3
  bindings: DirectDragBindings
  kind: 'actor-height' | 'camera-height'
}) {
  return (
    <group position={tuple(position)}>
      <Line points={[[0, 0.05, 0], [0, 1.55, 0]]} color="#67e8f9" lineWidth={1} transparent opacity={0.78} />
      <mesh position={[0, 1.55, 0]} userData={{ spatialDirectHandle: 'vertical' }} {...pointerHandlers(kind, position.y, bindings)}>
        <cylinderGeometry args={[0.075, 0.075, 0.28, 16]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.86} />
      </mesh>
    </group>
  )
}

function CameraTargetDragHandle({ position, bindings }: { position: Vec3; bindings: DirectDragBindings }) {
  return (
    <group position={tuple(position)} userData={{ spatialDirectHandle: 'camera-target' }} {...pointerHandlers('camera-target', position.y, bindings)}>
      <TargetRing position={{ x: 0, y: 0, z: 0 }} selected />
      <mesh>
        <sphereGeometry args={[0.28, 16, 12]} />
        <meshBasicMaterial transparent opacity={0.001} />
      </mesh>
    </group>
  )
}

function SpatialNudgeControls({
  state,
  currentTimeSec,
  selection,
  actorTrackId,
  disabled,
  onChange,
}: Omit<SpatialNudgeInput, 'axis'> & {
  state: SpatialPrevisState
  disabled: boolean
  onChange: (next: SpatialPrevisState) => void
}) {
  const selectionLabel = TRANSFORM_SELECTION_LABELS[selection]

  return (
    <div className="inline-flex items-center overflow-hidden rounded-md border border-white/12" role="group" aria-label={`${selectionLabel}关键帧微调`}>
      {SPATIAL_NUDGE_AXES.map((nudge) => (
        <button
          key={nudge.axis}
          type="button"
          aria-label={`${selectionLabel}${nudge.label}微调`}
          disabled={disabled}
          onClick={() => dispatchSpatialNudge({ state, currentTimeSec, selection, actorTrackId, axis: nudge.axis, onChange })}
          className="h-7 w-8 border-r border-white/10 bg-white/[0.025] text-[10px] font-medium text-white/58 transition last:border-r-0 hover:bg-cyan-200/[0.09] hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {nudge.shortLabel}
        </button>
      ))}
    </div>
  )
}

export function SpatialPrevisWorldGeometry({
  state,
  currentTimeSec,
  sampledCamera,
  selection,
  selectedActorTrack,
  manipulationEnabled,
  directDragBindings,
  showOverviewGuides = false,
  showCameraRig = true,
}: {
  state: SpatialPrevisState
  currentTimeSec: number
  sampledCamera: CameraKeyframe | null
  selection?: TransformSelection
  selectedActorTrack?: ActorTrack
  manipulationEnabled?: boolean
  directDragBindings?: DirectDragBindings
  showOverviewGuides?: boolean
  showCameraRig?: boolean
}) {
  const cameraPath = useMemo(
    () => state.masterTake.cameraTrack.keyframes.map((keyframe) => tuple(keyframe.position)),
    [state.masterTake.cameraTrack.keyframes],
  )
  const anchors = useMemo(
    () => worldAnchors(state, currentTimeSec),
    [currentTimeSec, state],
  )

  return (
    <>
      <color attach="background" args={['#071015']} />
      <fog attach="fog" args={['#071015', 18, 42]} />
      <ambientLight intensity={0.7} />
      <directionalLight castShadow intensity={1.15} position={[7, 10, 6]} color="#dbeafe" />
      <gridHelper args={[24, 24, '#476475', '#1a2a35']} position={[0, -0.72, 0]} />
      {showOverviewGuides ? <axesHelper args={[2.4]} position={[-10, -0.69, -10]} /> : null}
      {showOverviewGuides ? anchors.map((anchor) => <WorldAnchorMarker key={anchor.id} anchor={anchor} />) : null}
      <group>
        {/* Reference imagery is represented as conservative editor-unit proxy geometry. */}
        {state.scene.whitebox.entities.map((entity) => <WhiteboxEntityMesh key={entity.id} entity={entity} />)}
      </group>

      {state.masterTake.actorTracks.map((track) => {
        const isSelected = selection === 'actor' && selectedActorTrack === track
        const canDirectManipulate = Boolean(isSelected && manipulationEnabled && directDragBindings)
        const position = initialActorPosition(track, currentTimeSec)
        return (
          <group key={track.id}>
            {showOverviewGuides && track.keyframes.length > 1 ? (
              <Line points={track.keyframes.map((keyframe) => tuple(keyframe.position))} color="#38bdf8" lineWidth={1.5} transparent opacity={0.48} />
            ) : null}
            {canDirectManipulate ? (
              <DirectGroundDrag kind="actor-ground" position={position} bindings={directDragBindings!}>
                <ActorProxy position={position} selected />
              </DirectGroundDrag>
            ) : <ActorProxy position={position} selected={isSelected} />}
            {canDirectManipulate ? <VerticalDragGuide position={position} bindings={directDragBindings!} kind="actor-height" /> : null}
          </group>
        )
      })}

      {showOverviewGuides && cameraPath.length > 1 ? <Line points={cameraPath} color="#fbbf24" lineWidth={1.5} transparent opacity={0.68} /> : null}
      {showOverviewGuides && sampledCamera ? <Line points={[tuple(sampledCamera.position), tuple(sampledCamera.target)]} color="#f59e0b" lineWidth={1} dashed dashScale={6} gapSize={0.25} /> : null}

      {showCameraRig && sampledCamera ? (
        <>
          {selection === 'camera' && manipulationEnabled && directDragBindings ? (
            <DirectGroundDrag kind="camera-ground" position={sampledCamera.position} bindings={directDragBindings}>
              <CameraRigMarker position={sampledCamera.position} target={sampledCamera.target} selected />
            </DirectGroundDrag>
          ) : <CameraRigMarker position={sampledCamera.position} target={sampledCamera.target} selected={selection === 'camera'} />}
          {selection === 'camera' && manipulationEnabled && directDragBindings ? (
            <VerticalDragGuide position={sampledCamera.position} bindings={directDragBindings} kind="camera-height" />
          ) : null}
        </>
      ) : null}

      {showOverviewGuides && sampledCamera ? (
        selection === 'target' && manipulationEnabled && directDragBindings ? (
          <CameraTargetDragHandle position={sampledCamera.target} bindings={directDragBindings} />
        ) : <TargetRing position={sampledCamera.target} selected={selection === 'target'} />
      ) : null}
    </>
  )
}

function WorldCanvas(props: {
  state: SpatialPrevisState
  currentTimeSec: number
  sampledCamera: CameraKeyframe | null
  selection: TransformSelection
  selectedActorTrack: ActorTrack | undefined
  manipulationEnabled: boolean
  interactionDisabled: boolean
  isObjectDragging: boolean
  cursor: 'grab' | 'grabbing' | 'ns-resize' | 'crosshair'
  directDragBindings: DirectDragBindings
  cancelDirectDrag: (pointerId: number) => void
}) {
  return (
    <Canvas
      shadows
      camera={{ position: WORLD_CAMERA_POSITION, fov: 48, near: 0.1, far: 100 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
      className="absolute inset-0 h-full w-full"
      style={{ position: 'absolute', inset: 0, cursor: props.cursor }}
    >
      <DirectDragCancellationGuard onCancel={props.cancelDirectDrag} />
      <SpatialPrevisWorldGeometry {...props} showOverviewGuides />
      <OrbitControls enabled={!props.interactionDisabled && !props.isObjectDragging} makeDefault enableDamping target={WORLD_CAMERA_TARGET} maxPolarAngle={Math.PI * 0.48} />
    </Canvas>
  )
}

function LivePreviewCamera({ cameraKeyframe }: { cameraKeyframe: CameraKeyframe }) {
  const cameraRef = useRef<ThreePerspectiveCamera>(null)

  useLayoutEffect(() => {
    const camera = cameraRef.current
    if (!camera) return
    camera.position.set(cameraKeyframe.position.x, cameraKeyframe.position.y, cameraKeyframe.position.z)
    camera.setFocalLength(cameraKeyframe.focalLengthMm)
    camera.lookAt(cameraKeyframe.target.x, cameraKeyframe.target.y, cameraKeyframe.target.z)
    camera.updateProjectionMatrix()
  }, [cameraKeyframe])

  return <DreiPerspectiveCamera ref={cameraRef} makeDefault near={0.1} far={100} />
}

function LivePreviewCanvas({ state, currentTimeSec, sampledCamera }: {
  state: SpatialPrevisState
  currentTimeSec: number
  sampledCamera: CameraKeyframe
}) {
  return (
    <Canvas dpr={[1, 1.5]} gl={{ antialias: true }} className="h-full w-full">
      <LivePreviewCamera cameraKeyframe={sampledCamera} />
      <SpatialPrevisWorldGeometry state={state} currentTimeSec={currentTimeSec} sampledCamera={sampledCamera} manipulationEnabled={false} showCameraRig={false} />
    </Canvas>
  )
}

export function SpatialPrevisViewport({ state, currentTimeSec, disabled = false, onChange }: SpatialPrevisViewportProps) {
  const [mounted, setMounted] = useState(false)
  const [selection, setSelection] = useState<TransformSelection>(state.masterTake.actorTracks.length > 0 ? 'actor' : 'camera')
  const [selectedActorTrackId, setSelectedActorTrackId] = useState(state.masterTake.actorTracks[0]?.id ?? '')
  const [isObjectDragging, setIsObjectDragging] = useState(false)
  const [worldCursor, setWorldCursor] = useState<'grab' | 'grabbing' | 'ns-resize' | 'crosshair'>('grab')
  const directDragRef = useRef<ActiveDirectDrag | null>(null)
  const selectedActorTrack = state.masterTake.actorTracks.find((track) => track.id === selectedActorTrackId)
  const sampledCamera = state.masterTake.cameraTrack.keyframes.length > 0
    ? sampleCamera(state.masterTake.cameraTrack.keyframes, currentTimeSec)
    : null
  const exactCamera = exactKeyframe(state.masterTake.cameraTrack.keyframes, currentTimeSec)
  const exactActor = selectedActorTrack ? exactKeyframe(selectedActorTrack.keyframes, currentTimeSec) : null
  const selectionHasKeyframe = selection === 'actor' ? Boolean(exactActor) : Boolean(exactCamera)
  const manipulationEnabled = !disabled
  const disabledReason = disabled
    ? '正在保存预演，编辑已锁定'
    : selectionHasKeyframe ? undefined : '当前时间：新关键帧'

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (selectedActorTrack) return
    setSelectedActorTrackId(state.masterTake.actorTracks[0]?.id ?? '')
    if (selection === 'actor' && state.masterTake.actorTracks.length === 0) setSelection('camera')
  }, [selectedActorTrack, selection, state.masterTake.actorTracks])

  const setDirectCursor = useCallback((cursor: 'grab' | 'grabbing' | 'ns-resize' | 'crosshair') => {
    if (directDragRef.current && cursor !== 'grabbing') return
    setWorldCursor(cursor)
  }, [])

  const beginDirectDrag = useCallback((kind: DirectDragKind, event: ThreeEvent<PointerEvent>, startY: number) => {
    if (disabled) return
    event.stopPropagation()
    const target = event.target as unknown as { setPointerCapture?: (pointerId: number) => void }
    target.setPointerCapture?.(event.pointerId)
    directDragRef.current = {
      kind,
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startY,
      actorTrackId: selectedActorTrackId,
    }
    setIsObjectDragging(true)
    setWorldCursor('grabbing')
  }, [disabled, selectedActorTrackId])

  const moveDirectDrag = useCallback((kind: DirectDragKind, event: ThreeEvent<PointerEvent>) => {
    const drag = directDragRef.current
    if (!drag || drag.kind !== kind || drag.pointerId !== event.pointerId) return
    event.stopPropagation()

    if (kind === 'actor-height' || kind === 'camera-height') {
      const y = drag.startY + (drag.startClientY - event.clientY) * 0.018
      onChange(applyObjectHeightDrag(state, kind === 'actor-height' ? 'actor' : 'camera', currentTimeSec, y, drag.actorTrackId))
      return
    }

    const point = event.ray.intersectPlane(GROUND_PLANE, new Vector3())
    if (!point) return
    if (kind === 'actor-ground') {
      onChange(applyActorGroundDrag(state, drag.actorTrackId, currentTimeSec, { x: point.x, z: point.z }))
      return
    }

    if (kind === 'camera-ground') {
      onChange(applyCameraDollyDrag(state, currentTimeSec, { x: point.x, y: drag.startY, z: point.z }))
      return
    }

    onChange(applyCameraTargetDrag(state, currentTimeSec, { x: point.x, y: drag.startY, z: point.z }))
  }, [currentTimeSec, onChange, state])

  const finishDirectDrag = useCallback((pointerId: number, target?: { releasePointerCapture?: (pointerId: number) => void }) => {
    const drag = directDragRef.current
    if (!drag || drag.pointerId !== pointerId) return
    directDragRef.current = null
    setIsObjectDragging(false)
    setWorldCursor('grab')
    target?.releasePointerCapture?.(pointerId)
  }, [])

  const endDirectDrag = useCallback((event: ThreeEvent<PointerEvent>) => {
    const drag = directDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.stopPropagation()
    finishDirectDrag(event.pointerId, event.target as unknown as { releasePointerCapture?: (pointerId: number) => void })
  }, [finishDirectDrag])

  const cancelDirectDrag = useCallback((pointerId: number) => {
    finishDirectDrag(pointerId)
  }, [finishDirectDrag])

  const directDragBindings = useMemo<DirectDragBindings>(() => ({
    begin: beginDirectDrag,
    move: moveDirectDrag,
    end: endDirectDrag,
    onDragStateChange: setIsObjectDragging,
    setCursor: setDirectCursor,
  }), [beginDirectDrag, endDirectDrag, moveDirectDrag, setDirectCursor])

  return (
    <section data-spatial-previs-viewport="true" className="flex min-h-[470px] w-full flex-col overflow-hidden rounded-lg border border-white/12 bg-[#0b1014] text-white shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-xs font-semibold text-white/78">空间预演</span>
          <span className="text-[11px] text-white/44">{formatNumber(currentTimeSec)} s</span>
          {state.masterTake.actorTracks.length > 0 ? (
            <select
              aria-label="选择演员轨道"
              value={selectedActorTrackId}
              disabled={disabled}
              onChange={(event) => setSelectedActorTrackId(event.target.value)}
              className="max-w-40 rounded-md border border-white/12 bg-[#10171d] px-2 py-1 text-[11px] text-white/70 outline-none focus:border-cyan-200/55"
            >
              {state.masterTake.actorTracks.map((track, index) => (
                <option key={track.id} value={track.id}>演员 {index + 1} · {track.anchorId}</option>
              ))}
            </select>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-white/12" role="group" aria-label="直接操控对象">
            {(['actor', 'camera', 'target'] as const).map((item) => {
              const isDisabled = disabled || (item === 'actor' && !selectedActorTrack)
              return (
                <button
                  key={item}
                  type="button"
                  disabled={isDisabled}
                  aria-pressed={selection === item}
                  onClick={() => setSelection(item)}
                  className={`border-r border-white/10 px-2.5 py-1.5 text-xs transition last:border-r-0 disabled:cursor-not-allowed disabled:opacity-35 ${selection === item ? 'bg-cyan-300/15 text-cyan-50' : 'bg-white/[0.025] text-white/52 hover:bg-white/[0.07] hover:text-white/78'}`}
                >
                  {TRANSFORM_SELECTION_LABELS[item]}
                </button>
              )
            })}
          </div>
          <SpatialNudgeControls
            state={state}
            currentTimeSec={currentTimeSec}
            selection={selection}
            actorTrackId={selectedActorTrackId}
            disabled={disabled || !selectionHasKeyframe}
            onChange={onChange}
          />
        </div>
      </header>

      <div className="relative min-h-[390px] flex-1 bg-[#071015]">
        <div className="absolute inset-0">
          {mounted ? (
            <WorldCanvas
              state={state}
              currentTimeSec={currentTimeSec}
              sampledCamera={sampledCamera}
              selection={selection}
              selectedActorTrack={selectedActorTrack}
              manipulationEnabled={manipulationEnabled}
              interactionDisabled={disabled}
              isObjectDragging={isObjectDragging}
              cursor={worldCursor}
              directDragBindings={directDragBindings}
              cancelDirectDrag={cancelDirectDrag}
            />
          ) : <div className="h-full w-full" aria-hidden="true" />}
        </div>

        <aside data-spatial-camera-preview="true" className="absolute bottom-3 right-3 h-36 w-56 overflow-hidden rounded-md border border-white/18 bg-[#080d11] shadow-2xl">
          {mounted && sampledCamera ? <LivePreviewCanvas state={state} currentTimeSec={currentTimeSec} sampledCamera={sampledCamera} /> : <div className="h-full w-full" aria-hidden="true" />}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between border-b border-white/10 bg-black/45 px-2 py-1 text-[10px] text-white/72">
            <span>LIVE</span>
            <span>{sampledCamera ? `${formatNumber(sampledCamera.focalLengthMm)} mm` : '— mm'}</span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/45 px-2 py-1 text-right text-[10px] text-white/64">
            {formatNumber(currentTimeSec)} s
          </div>
        </aside>

        <div className="pointer-events-none absolute bottom-3 left-3 right-60 flex items-center gap-2 overflow-hidden text-[10px] text-white/48">
          <span className="rounded bg-black/35 px-1.5 py-1">X</span>
          <span className="rounded bg-black/35 px-1.5 py-1">Y</span>
          <span className="rounded bg-black/35 px-1.5 py-1">Z</span>
          <span className="truncate">{disabledReason ?? `当前：${TRANSFORM_SELECTION_LABELS[selection]}`}</span>
        </div>
      </div>

      <SpatialCameraControlStrip
        state={state}
        currentTimeSec={currentTimeSec}
        actorTrackId={selectedActorTrackId}
        disabled={disabled}
        disabledReason={disabled ? '正在保存预演，编辑已锁定' : undefined}
        onChange={onChange}
      />
    </section>
  )
}
