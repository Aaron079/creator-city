'use client'

import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei/core/Line'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { PerspectiveCamera as DreiPerspectiveCamera } from '@react-three/drei/core/PerspectiveCamera'
import { TransformControls } from '@react-three/drei/core/TransformControls'
import { Html } from '@react-three/drei/web/Html'
import { UserPlus } from 'lucide-react'
import * as React from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Plane, Vector3 } from 'three'
import type { Group, Mesh, Object3D, PerspectiveCamera as ThreePerspectiveCamera } from 'three'
import {
  applyActorGroundDrag,
  applyCameraDollyDrag,
  applyCameraRoutePointDrag,
  applyCameraTransform,
  applyCameraTargetDrag,
  applyObjectHeightDrag,
} from '@/lib/spatial-previs/direct-manipulation'
import { applyCameraPose } from '@/lib/spatial-previs/camera'
import { addDefaultActorTrack, setMasterTakeDuration } from '@/lib/spatial-previs/normalize'
import { applyWhiteboxGroundDrag } from '@/lib/spatial-previs/whitebox-edit'
import type {
  ActorTrack,
  CameraKeyframe,
  SpatialPrevisCameraMode,
  SpatialPrevisState,
  Vec3,
  WhiteboxEntity,
} from '@/lib/spatial-previs/types'
import { sampleActor, sampleCamera } from '@/lib/spatial-previs/sampler'
import { SpatialPrevisDirectorControls } from './SpatialPrevisDirectorControls'
import { PerformanceActor, SpatialStudioLighting, StudioSceneGizmo, type StudioSelection } from './SpatialStudioScene'
import { SpatialStudioTools } from './SpatialStudioTools'
import { SpatialStudioComparison } from './SpatialStudioComparison'
import { putCut, samplePose, sampleProgramCamera, studioOf, updateStudio } from '@/lib/spatial-previs/studio'
import type { StudioTool } from '@/lib/spatial-previs/studio-types'
import studioStyles from './spatial-studio-styles'

const KEYFRAME_EPSILON = 1e-6
const NUDGE_DELTA = 0.1
const WORLD_CAMERA_POSITION: [number, number, number] = [12, 11, 15]
const WORLD_CAMERA_TARGET: [number, number, number] = [0, 3, 0]
const WHITEBOX_COLORS: Record<WhiteboxEntity['kind'], string> = {
  floor: '#475569',
  wall: '#64748b',
  opening: '#d4a72c',
  volume: '#58735f',
  furniture: '#9a6149',
  prop: '#9a6149',
  referencePlane: '#5b7c99',
}
const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0)

function projectCameraRouteToGround(position: Vec3): Vec3 {
  return { x: position.x, y: 0, z: position.z }
}

export function whiteboxEntityMaterialColor(kind: WhiteboxEntity['kind']) {
  return WHITEBOX_COLORS[kind]
}

type TransformSelection = 'actor' | 'camera' | 'target'

export type SpatialPrevisSelection =
  | { kind: TransformSelection }
  | { kind: 'whitebox'; id: string }

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

type DirectDragKind =
  | 'whitebox-ground'
  | 'actor-ground'
  | 'actor-height'
  | 'camera-ground'
  | 'camera-height'
  | 'camera-target'
  | 'actor-route'
  | 'camera-route'

type SelectedRoutePoint = {
  kind: 'actor' | 'camera'
  actorTrackId?: string
  timeSec: number
}

type DirectDragBindings = {
  begin: (kind: DirectDragKind, event: ThreeEvent<PointerEvent>, startY: number, objectId?: string, routePointTimeSec?: number) => void
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
  whiteboxEntityId?: string
  routePointTimeSec?: number
}

type SpatialPrevisViewportProps = {
  state: SpatialPrevisState
  currentTimeSec: number
  disabled?: boolean
  cameraMode?: SpatialPrevisCameraMode
  onChange: (next: SpatialPrevisState) => void
  onCurrentTimeChange?: (timeSec: number) => void
  onCameraModeChange?: (mode: SpatialPrevisCameraMode) => void
  onLiveCanvas?: (canvas: HTMLCanvasElement | null) => void
}

type SpatialNudgeInput = {
  currentTimeSec: number
  selection: TransformSelection
  actorTrackId?: string
  cameraMode?: SpatialPrevisCameraMode
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

function replaceCameraKeyframe(
  state: SpatialPrevisState,
  keyframe: CameraKeyframe,
  patch: Partial<CameraKeyframe>,
  cameraMode: SpatialPrevisCameraMode,
) {
  const track = cameraMode === 'aerial' ? state.masterTake.aerialCameraTrack : state.masterTake.cameraTrack
  return {
    ...state,
    masterTake: {
      ...state.masterTake,
      ...(cameraMode === 'aerial'
        ? { aerialCameraTrack: { ...track, keyframes: track.keyframes.map((item) => item === keyframe ? { ...item, ...patch } : item) } }
        : { cameraTrack: { ...track, keyframes: track.keyframes.map((item) => item === keyframe ? { ...item, ...patch } : item) } }),
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
  cameraMode = 'director',
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

  const track = cameraMode === 'aerial' ? state.masterTake.aerialCameraTrack : state.masterTake.cameraTrack
  const keyframe = exactKeyframe(track.keyframes, currentTimeSec)
  if (!keyframe) return state

  return replaceCameraKeyframe(
    state,
    keyframe,
    selection === 'camera'
      ? { position: addVector(keyframe.position, delta) }
      : { target: addVector(keyframe.target, delta) },
    cameraMode,
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

function WhiteboxEntityMesh({
  entity,
  selected = false,
  manipulationEnabled = false,
  bindings,
}: {
  entity: WhiteboxEntity
  selected?: boolean
  manipulationEnabled?: boolean
  bindings?: DirectDragBindings
}) {
  const isOpening = entity.kind === 'opening'
  const isReferencePlane = entity.kind === 'referencePlane'
  const isLowConfidence = entity.confidence < 0.6
  const opacity = selected ? 0.92 : isOpening ? 0.46 : isReferencePlane ? 0.5 : isLowConfidence ? 0.68 : 1
  const handlers = manipulationEnabled && bindings
    ? pointerHandlers('whitebox-ground', entity.position.y, bindings, entity.id)
    : {}

  return (
    <mesh
      castShadow
      receiveShadow
      position={tuple(entity.position)}
      rotation={[0, entity.rotationY, 0]}
      {...handlers}
    >
      <boxGeometry args={[entity.size.x, entity.size.y, entity.size.z]} />
      <meshStandardMaterial
        color={whiteboxEntityMaterialColor(entity.kind)}
        emissive={selected ? '#0e7490' : '#000000'}
        emissiveIntensity={selected ? 0.75 : 0}
        roughness={0.82}
        metalness={0.04}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
      />
    </mesh>
  )
}

function ActorProxy({ selected }: { selected: boolean }) {
  const bodyColor = selected ? '#a5f3fc' : '#7dd3fc'
  const limbColor = selected ? '#67e8f9' : '#38bdf8'

  return (
    <group>
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

export function selectSpatialPrevisCameraTrack(state: SpatialPrevisState, cameraMode: SpatialPrevisCameraMode) {
  return cameraMode === 'aerial' ? state.masterTake.aerialCameraTrack : state.masterTake.cameraTrack
}

function CameraRigMarker({ selected }: { selected: boolean }) {
  const color = selected ? '#facc15' : '#f59e0b'
  return (
    <group>
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

function TargetRing({ selected }: { selected: boolean }) {
  return (
    <group>
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
      <Html center sprite distanceFactor={11} pointerEvents="none" style={{ pointerEvents: 'none' }} position={[0, 0.04, 0]}>
        <span className="whitespace-nowrap rounded border border-white/15 bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-100 shadow-sm">
          {anchor.label}
        </span>
      </Html>
    </group>
  )
}

function pointerHandlers(
  kind: DirectDragKind,
  startY: number,
  bindings: DirectDragBindings,
  objectId?: string,
  routePointTimeSec?: number,
): DirectPointerHandlers {
  const finish = (event: ThreeEvent<PointerEvent>) => bindings.end(event)

  return {
    onPointerDown: (event) => {
      bindings.onDragStateChange(true)
      bindings.begin(kind, event, startY, objectId, routePointTimeSec)
    },
    onPointerMove: (event) => bindings.move(kind, event),
    onPointerUp: finish,
    onPointerOver: () => bindings.setCursor(
      kind === 'actor-height' || kind === 'camera-height'
        ? 'ns-resize'
        : kind === 'camera-target'
          ? 'crosshair'
          : 'grab',
    ),
    onPointerOut: () => bindings.setCursor('grab'),
  }
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
      <TargetRing selected />
      <mesh>
        <sphereGeometry args={[0.28, 16, 12]} />
        <meshBasicMaterial transparent opacity={0.001} />
      </mesh>
    </group>
  )
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

function OrbitControlsState({ enabled }: { enabled: boolean }) {
  const canvas = useThree((state) => state.gl.domElement)

  useEffect(() => {
    canvas.dataset.spatialPrevisOrbitControls = enabled ? 'enabled' : 'disabled'
    return () => {
      delete canvas.dataset.spatialPrevisOrbitControls
    }
  }, [canvas, enabled])

  return null
}

function RoutePointHandle({
  kind,
  position,
  timeSec,
  actorTrackId,
  selected,
  bindings,
}: {
  kind: 'actor-route' | 'camera-route'
  position: Vec3
  timeSec: number
  actorTrackId?: string
  selected: boolean
  bindings: DirectDragBindings
}) {
  const handleRef = useRef<Mesh>(null)
  const camera = useThree((scene) => scene.camera)

  useFrame(() => {
    const handle = handleRef.current
    if (!handle) return
    const distance = camera.position.distanceTo(handle.getWorldPosition(new Vector3()))
    const size = Math.min(1.25, Math.max(0.6, distance * 0.03))
    handle.scale.setScalar(size)
  })

  const color = kind === 'camera-route'
    ? selected ? '#fef08a' : '#fbbf24'
    : selected ? '#a5f3fc' : '#22d3ee'

  return (
    <mesh
      ref={handleRef}
      position={tuple(position)}
      userData={{ spatialRouteHandle: { kind, timeSec, actorTrackId, selected } }}
      {...pointerHandlers(kind, position.y, bindings, actorTrackId, timeSec)}
    >
      <sphereGeometry args={[0.14, 16, 12]} />
      <meshBasicMaterial color={color} transparent opacity={selected ? 1 : 0.84} depthTest={false} />
    </mesh>
  )
}

function SpatialTransformGizmo({
  position,
  rotation = { pitch: 0, yaw: 0, roll: 0 },
  mode,
  enabled,
  onTransform,
  onDragStart,
  onDragEnd,
  children,
}: {
  position: Vec3
  rotation?: CameraKeyframe['rotation']
  mode: 'translate' | 'rotate'
  enabled: boolean
  onTransform: (position: Vec3, rotation: CameraKeyframe['rotation']) => void
  onDragStart: () => void
  onDragEnd: () => void
  children?: React.ReactElement
}) {
  const transformControlsRef = useRef<React.ElementRef<typeof TransformControls>>(null)
  const transformObjectRef = useRef<Group>(null!)
  const canvas = useThree((state) => state.gl.domElement)
  const eventTarget = useThree((state) => state.events.connected || state.gl.domElement)

  useEffect(() => {
    const publishAxis = () => {
      const control = transformControlsRef.current as unknown as { axis?: string | null } | null
      canvas.dataset.spatialPrevisTransformAxis = control?.axis ?? ''
    }
    eventTarget.addEventListener('pointermove', publishAxis)
    return () => {
      eventTarget.removeEventListener('pointermove', publishAxis)
      delete canvas.dataset.spatialPrevisTransformAxis
    }
  }, [canvas, eventTarget])

  return (
    <>
      <group ref={transformObjectRef} position={tuple(position)} rotation={[rotation.pitch, rotation.yaw, rotation.roll]} rotation-order="YXZ">{children}</group>
      <TransformControls
        ref={transformControlsRef}
        object={transformObjectRef}
        enabled={enabled}
        mode={mode}
        space="world"
        size={0.8}
        onMouseDown={onDragStart}
        onMouseUp={onDragEnd}
        onObjectChange={(event) => {
          const object = (event?.target as { object?: Object3D } | undefined)?.object
          if (!object) return
          onTransform(
            { x: object.position.x, y: object.position.y, z: object.position.z },
            { pitch: object.rotation.x, yaw: object.rotation.y, roll: object.rotation.z },
          )
        }}
      />
    </>
  )
}

function SpatialNudgeControls({
  state,
  currentTimeSec,
  selection,
  actorTrackId,
  cameraMode,
  disabled,
  onChange,
}: Omit<SpatialNudgeInput, 'axis' | 'selection'> & {
  selection: TransformSelection | null
  state: SpatialPrevisState
  disabled: boolean
  onChange: (next: SpatialPrevisState) => void
}) {
  const selectionLabel = selection ? TRANSFORM_SELECTION_LABELS[selection] : '白模'

  return (
    <div className="inline-flex items-center overflow-hidden rounded-md border border-white/12" role="group" aria-label={`${selectionLabel}关键帧微调`}>
      {SPATIAL_NUDGE_AXES.map((nudge) => (
        <button
          key={nudge.axis}
          type="button"
          aria-label={`${selectionLabel}${nudge.label}微调`}
          disabled={disabled}
          onClick={() => {
            if (selection) dispatchSpatialNudge({ state, currentTimeSec, selection, actorTrackId, cameraMode, axis: nudge.axis, onChange })
          }}
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
  selectedRoutePoint,
  transformControlVersion = 0,
  onTransformDragStart,
  onTransformDragEnd,
  onActorTransform,
  onCameraTransform,
  onCameraTargetTransform,
  showOverviewGuides = false,
  showCameraRig = true,
  cameraMode = 'director',
  studioGizmo,
}: {
  state: SpatialPrevisState
  currentTimeSec: number
  sampledCamera: CameraKeyframe | null
  selection?: SpatialPrevisSelection
  selectedActorTrack?: ActorTrack
  manipulationEnabled?: boolean
  directDragBindings?: DirectDragBindings
  selectedRoutePoint?: SelectedRoutePoint | null
  transformControlVersion?: number
  onTransformDragStart?: () => void
  onTransformDragEnd?: () => void
  onActorTransform?: (actorTrackId: string, position: Vec3) => void
  onCameraTransform?: (position: Vec3, rotation: CameraKeyframe['rotation']) => void
  onCameraTargetTransform?: (target: Vec3) => void
  showOverviewGuides?: boolean
  showCameraRig?: boolean
  cameraMode?: SpatialPrevisCameraMode
  studioGizmo?: React.ReactNode
}) {
  const activeCameraTrack = selectSpatialPrevisCameraTrack(state, cameraMode)
  const cameraPath = useMemo(
    () => activeCameraTrack.keyframes.map((keyframe) => tuple(projectCameraRouteToGround(keyframe.position))),
    [activeCameraTrack.keyframes],
  )
  const anchors = useMemo(
    () => worldAnchors(state, currentTimeSec),
    [currentTimeSec, state],
  )

  return (
    <>
      <color attach="background" args={['#071015']} />
      <fog attach="fog" args={['#071015', 18, 42]} />
      {!state.studio?.lighting.enabled && <><ambientLight intensity={0.7} />
      <directionalLight castShadow intensity={1.15} position={[7, 10, 6]} color="#dbeafe" /></>}
      <SpatialStudioLighting state={state} markers={showOverviewGuides} />
      {studioGizmo}
      <gridHelper args={[24, 24, '#476475', '#1a2a35']} position={[0, -0.72, 0]} />
      {showOverviewGuides ? <axesHelper args={[2.4]} position={[-10, -0.69, -10]} /> : null}
      {showOverviewGuides ? anchors.map((anchor) => <WorldAnchorMarker key={anchor.id} anchor={anchor} />) : null}
      <group>
        {/* Reference imagery is represented as conservative editor-unit proxy geometry. */}
        {state.scene.whitebox.entities.map((entity) => (
          <WhiteboxEntityMesh
            key={entity.id}
            entity={entity}
            selected={selection?.kind === 'whitebox' && selection.id === entity.id}
            manipulationEnabled={manipulationEnabled}
            bindings={directDragBindings}
          />
        ))}
      </group>

      {state.masterTake.actorTracks.map((track) => {
        const isSelected = selection?.kind === 'actor' && selectedActorTrack === track
        const canDirectManipulate = Boolean(isSelected && manipulationEnabled && directDragBindings)
        const canTransform = isSelected && manipulationEnabled && onActorTransform && onTransformDragStart && onTransformDragEnd
        const position = initialActorPosition(track, currentTimeSec)
        const pose = samplePose(state, track.id, currentTimeSec)
        const proxy = pose ? <PerformanceActor pose={pose} /> : <ActorProxy selected={isSelected} />
        return (
          <group key={track.id}>
            {showOverviewGuides && track.keyframes.length > 1 ? (
              <Line points={track.keyframes.map((keyframe) => tuple(keyframe.position))} color="#38bdf8" lineWidth={1.5} transparent opacity={0.48} />
            ) : null}
            {canTransform ? (
              <SpatialTransformGizmo
                key={`actor-${transformControlVersion}`}
                position={position}
                mode="translate"
                enabled={Boolean(manipulationEnabled)}
                onTransform={(nextPosition) => onActorTransform!(track.id, nextPosition)}
                onDragStart={onTransformDragStart!}
                onDragEnd={onTransformDragEnd!}
              >
                <DirectGroundDrag kind="actor-ground" position={position} bindings={directDragBindings!}>
                  {proxy}
                </DirectGroundDrag>
              </SpatialTransformGizmo>
            ) : canDirectManipulate ? (
              <group position={tuple(position)}>
                <DirectGroundDrag kind="actor-ground" position={position} bindings={directDragBindings!}>
                  {proxy}
                </DirectGroundDrag>
              </group>
            ) : <group position={tuple(position)}>{proxy}</group>}
            {canDirectManipulate ? <VerticalDragGuide position={position} bindings={directDragBindings!} kind="actor-height" /> : null}
      {showOverviewGuides && isSelected && manipulationEnabled && directDragBindings ? track.keyframes.map((keyframe) => (
              <RoutePointHandle
                key={keyframe.id}
                kind="actor-route"
                position={keyframe.position}
                timeSec={keyframe.timeSec}
                actorTrackId={track.id}
                selected={(selectedRoutePoint?.kind === 'actor'
                  ? selectedRoutePoint.actorTrackId === track.id && selectedRoutePoint.timeSec === keyframe.timeSec
                  : Math.abs(keyframe.timeSec - currentTimeSec) <= KEYFRAME_EPSILON)}
                bindings={directDragBindings}
              />
            )) : null}
          </group>
        )
      })}

      {showOverviewGuides && cameraPath.length > 1 ? <Line points={cameraPath} color="#fbbf24" lineWidth={1.5} transparent opacity={0.68} /> : null}
      {showOverviewGuides && manipulationEnabled && directDragBindings ? activeCameraTrack.keyframes.map((keyframe) => (
        <RoutePointHandle
          key={keyframe.id}
          kind="camera-route"
          position={projectCameraRouteToGround(keyframe.position)}
          timeSec={keyframe.timeSec}
          selected={(selectedRoutePoint?.kind === 'camera'
            ? selectedRoutePoint.timeSec === keyframe.timeSec
            : Math.abs(keyframe.timeSec - currentTimeSec) <= KEYFRAME_EPSILON)}
          bindings={directDragBindings}
        />
      )) : null}
      {showOverviewGuides && sampledCamera ? <Line points={[tuple(sampledCamera.position), tuple(sampledCamera.target)]} color="#f59e0b" lineWidth={1} dashed dashScale={6} gapSize={0.25} /> : null}

      {showCameraRig && sampledCamera ? (
        <>
          {selection?.kind === 'camera' && manipulationEnabled && onCameraTransform && onTransformDragStart && onTransformDragEnd ? (
            <SpatialTransformGizmo
              key={`camera-${transformControlVersion}`}
              position={sampledCamera.position}
              rotation={sampledCamera.rotation}
              mode="translate"
              enabled={manipulationEnabled}
              onTransform={onCameraTransform}
              onDragStart={onTransformDragStart}
              onDragEnd={onTransformDragEnd}
            >
              {directDragBindings ? (
                <DirectGroundDrag kind="camera-ground" position={sampledCamera.position} bindings={directDragBindings}>
                  <CameraRigMarker selected />
                </DirectGroundDrag>
              ) : <CameraRigMarker selected />}
            </SpatialTransformGizmo>
          ) : directDragBindings && selection?.kind === 'camera' && manipulationEnabled ? (
            <DirectGroundDrag kind="camera-ground" position={sampledCamera.position} bindings={directDragBindings}>
              <group position={tuple(sampledCamera.position)} rotation={[sampledCamera.rotation.pitch, sampledCamera.rotation.yaw, sampledCamera.rotation.roll]}>
                <CameraRigMarker selected />
              </group>
            </DirectGroundDrag>
          ) : (
            <group position={tuple(sampledCamera.position)} rotation={[sampledCamera.rotation.pitch, sampledCamera.rotation.yaw, sampledCamera.rotation.roll]}>
              <CameraRigMarker selected={selection?.kind === 'camera'} />
            </group>
          )}
          {selection?.kind === 'camera' && manipulationEnabled && directDragBindings ? (
            <VerticalDragGuide position={sampledCamera.position} bindings={directDragBindings} kind="camera-height" />
          ) : null}
        </>
      ) : null}

      {showOverviewGuides && sampledCamera ? (
        <>
          {selection?.kind === 'target' && manipulationEnabled && onCameraTargetTransform && onTransformDragStart && onTransformDragEnd ? (
            <SpatialTransformGizmo
              key={`target-${transformControlVersion}`}
              position={sampledCamera.target}
              mode="translate"
              enabled={manipulationEnabled}
              onTransform={(target) => onCameraTargetTransform(target)}
              onDragStart={onTransformDragStart}
              onDragEnd={onTransformDragEnd}
            ><TargetRing selected /></SpatialTransformGizmo>
          ) : <group position={tuple(sampledCamera.target)}><TargetRing selected={selection?.kind === 'target'} /></group>}
          {selection?.kind === 'target' && manipulationEnabled && directDragBindings ? (
            <CameraTargetDragHandle position={sampledCamera.target} bindings={directDragBindings} />
          ) : null}
          {selection?.kind === 'target' && manipulationEnabled && onCameraTransform && onTransformDragStart && onTransformDragEnd ? (
            <SpatialTransformGizmo
              key={`camera-rotation-${transformControlVersion}`}
              position={sampledCamera.position}
              rotation={sampledCamera.rotation}
              mode="rotate"
              enabled={manipulationEnabled}
              onTransform={onCameraTransform}
              onDragStart={onTransformDragStart}
              onDragEnd={onTransformDragEnd}
            ><group /></SpatialTransformGizmo>
          ) : null}
        </>
      ) : null}
    </>
  )
}

function WorldCanvas(props: {
  studioGizmo?: React.ReactNode
  state: SpatialPrevisState
  currentTimeSec: number
  sampledCamera: CameraKeyframe | null
  selection: SpatialPrevisSelection
  selectedActorTrack: ActorTrack | undefined
  manipulationEnabled: boolean
  interactionDisabled: boolean
  isObjectDragging: boolean
  cursor: 'grab' | 'grabbing' | 'ns-resize' | 'crosshair'
  cameraMode: SpatialPrevisCameraMode
  directDragBindings: DirectDragBindings
  cancelDirectDrag: (pointerId: number) => void
  selectedRoutePoint: SelectedRoutePoint | null
  transformControlVersion: number
  onTransformDragStart: () => void
  onTransformDragEnd: () => void
  onActorTransform: (actorTrackId: string, position: Vec3) => void
  onCameraTransform: (position: Vec3, rotation: CameraKeyframe['rotation']) => void
  onCameraTargetTransform: (target: Vec3) => void
}) {
  return (
    <Canvas
      shadows
      camera={{ position: WORLD_CAMERA_POSITION, fov: 52, near: 0.1, far: 100 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
      className="absolute inset-0 h-full w-full"
      style={{ position: 'absolute', inset: 0, cursor: props.cursor }}
    >
      <DirectDragCancellationGuard onCancel={props.cancelDirectDrag} />
      <SpatialPrevisWorldGeometry {...props} showOverviewGuides />
      <OrbitControlsState enabled={!props.interactionDisabled && !props.isObjectDragging} />
      <OrbitControls enabled={!props.interactionDisabled && !props.isObjectDragging} makeDefault enableDamping target={WORLD_CAMERA_TARGET} maxPolarAngle={Math.PI * 0.48} />
    </Canvas>
  )
}

function LivePreviewCamera({ cameraKeyframe }: { cameraKeyframe: CameraKeyframe }) {
  const cameraRef = useRef<ThreePerspectiveCamera>(null)

  useLayoutEffect(() => {
    const camera = cameraRef.current
    if (!camera) return
    applyCameraPose(camera, cameraKeyframe.position, cameraKeyframe.rotation, cameraKeyframe.focalLengthMm)
  }, [cameraKeyframe])

  return <DreiPerspectiveCamera ref={cameraRef} makeDefault near={0.1} far={100} />
}

function LiveCanvasReporter({ onLiveCanvas }: { onLiveCanvas?: (canvas: HTMLCanvasElement | null) => void }) {
  const canvas = useThree((three) => three.gl.domElement)

  useEffect(() => {
    onLiveCanvas?.(canvas)
    return () => onLiveCanvas?.(null)
  }, [canvas, onLiveCanvas])

  return null
}

function LivePreviewCanvas({ state, currentTimeSec, sampledCamera, onLiveCanvas }: {
  state: SpatialPrevisState
  currentTimeSec: number
  sampledCamera: CameraKeyframe
  onLiveCanvas?: (canvas: HTMLCanvasElement | null) => void
}) {
  return (
    <Canvas shadows={Boolean(state.studio?.lighting.enabled)} dpr={[1, 1.5]} gl={{ antialias: true }} className="h-full w-full">
      <LiveCanvasReporter onLiveCanvas={onLiveCanvas} />
      <LivePreviewCamera cameraKeyframe={sampledCamera} />
      <SpatialPrevisWorldGeometry state={state} currentTimeSec={currentTimeSec} sampledCamera={sampledCamera} manipulationEnabled={false} showCameraRig={false} />
    </Canvas>
  )
}

export function SpatialPrevisViewport({ state: sourceState, currentTimeSec, disabled = false, cameraMode: controlledCameraMode, onChange: onSourceChange, onCurrentTimeChange, onCameraModeChange, onLiveCanvas }: SpatialPrevisViewportProps) {
  const [studioTool, setStudioTool] = useState<StudioTool | null>(null)
  const [studioSelection, setStudioSelection] = useState<StudioSelection>({ entityId: '', lightId: '', actorId: '', joint: 'rightHand', lampTarget: false, transform: 'translate' })
  const [studioCameraId, setStudioCameraId] = useState('')
  const programPreview = Boolean(sourceState.studio?.programEnabled)
  const setProgramPreview = (enabled: boolean) => onSourceChange(updateStudio(sourceState, { programEnabled: enabled }))
  const studio = studioOf(sourceState)
  const editingCamera = studioTool === 'multicamera' ? studio.cameras.find(c => c.track.id === studioCameraId) : undefined
  const state = editingCamera ? { ...sourceState, masterTake: { ...sourceState.masterTake, cameraTrack: editingCamera.track, aerialCameraTrack: editingCamera.track } } : sourceState
  const onChange = (next: SpatialPrevisState) => {
    if (disabled) return
    if (!editingCamera) { onSourceChange(next); return }
    if (next.masterTake.durationSec !== state.masterTake.durationSec) { onSourceChange(setMasterTakeDuration(sourceState, next.masterTake.durationSec)); return }
    const track = next.masterTake.cameraTrack !== state.masterTake.cameraTrack ? next.masterTake.cameraTrack : next.masterTake.aerialCameraTrack
    onSourceChange(updateStudio({ ...next, masterTake: { ...next.masterTake, cameraTrack: sourceState.masterTake.cameraTrack, aerialCameraTrack: sourceState.masterTake.aerialCameraTrack } }, {
      cameras: studio.cameras.map(c => c.track.id === editingCamera.track.id ? { ...c, track } : c),
    }))
  }
  const [mounted, setMounted] = useState(false)
  const [selection, setSelection] = useState<SpatialPrevisSelection>({
    kind: state.masterTake.actorTracks.length > 0 ? 'actor' : 'camera',
  })
  const [selectedActorTrackId, setSelectedActorTrackId] = useState(state.masterTake.actorTracks[0]?.id ?? '')
  const [uncontrolledCameraMode, setUncontrolledCameraMode] = useState<SpatialPrevisCameraMode>('director')
  const cameraMode = controlledCameraMode ?? uncontrolledCameraMode
  const setCameraMode = useCallback((mode: SpatialPrevisCameraMode) => {
    if (controlledCameraMode === undefined) setUncontrolledCameraMode(mode)
    onCameraModeChange?.(mode)
  }, [controlledCameraMode, onCameraModeChange])
  const [isObjectDragging, setIsObjectDragging] = useState(false)
  const [worldCursor, setWorldCursor] = useState<'grab' | 'grabbing' | 'ns-resize' | 'crosshair'>('grab')
  const [selectedRoutePoint, setSelectedRoutePoint] = useState<SelectedRoutePoint | null>(null)
  const [transformControlVersion, setTransformControlVersion] = useState(0)
  const directDragRef = useRef<ActiveDirectDrag | null>(null)
  const selectedActorTrack = state.masterTake.actorTracks.find((track) => track.id === selectedActorTrackId)
  const selectedWhiteboxEntity = selection.kind === 'whitebox'
    ? state.scene.whitebox.entities.find((entity) => entity.id === selection.id)
    : undefined
  const lowConfidenceWhiteboxCount = state.scene.whitebox.entities.filter((entity) => entity.confidence < 0.6).length
  const selectedCameraTrack = selectSpatialPrevisCameraTrack(state, cameraMode)
  const sampledCamera = selectedCameraTrack.keyframes.length > 0
    ? sampleCamera(selectedCameraTrack.keyframes, currentTimeSec)
    : null
  const liveCamera = programPreview ? sampleProgramCamera(sourceState, currentTimeSec) ?? sampledCamera : sampledCamera
  const calibrationReference = studioTool === 'calibration' ? sourceState.scene.references.find(r => r.id === studio.calibration.referenceId && r.mediaType === 'image') : null
  const exactCamera = exactKeyframe(selectedCameraTrack.keyframes, currentTimeSec)
  const exactActor = selectedActorTrack ? exactKeyframe(selectedActorTrack.keyframes, currentTimeSec) : null
  const keyframeSelection = selection.kind === 'whitebox' ? null : selection.kind
  const selectionHasKeyframe = keyframeSelection === 'actor' ? Boolean(exactActor) : Boolean(keyframeSelection && exactCamera)
  const selectionLabel = selection.kind === 'whitebox'
    ? selectedWhiteboxEntity?.label ?? '白模'
    : TRANSFORM_SELECTION_LABELS[selection.kind]
  const manipulationEnabled = !disabled
  const disabledReason = disabled
    ? '正在保存预演，编辑已锁定'
    : keyframeSelection && !selectionHasKeyframe ? '当前时间：新关键帧' : undefined

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (selectedActorTrack) return
    setSelectedActorTrackId(state.masterTake.actorTracks[0]?.id ?? '')
    if (selection.kind === 'actor' && state.masterTake.actorTracks.length === 0) setSelection({ kind: 'camera' })
  }, [selectedActorTrack, selection, state.masterTake.actorTracks])

  useEffect(() => {
    if (selection.kind !== 'whitebox' || selectedWhiteboxEntity) return
    setSelection({ kind: state.masterTake.actorTracks.length > 0 ? 'actor' : 'camera' })
  }, [selectedWhiteboxEntity, selection, state.masterTake.actorTracks.length])

  const setDirectCursor = useCallback((cursor: 'grab' | 'grabbing' | 'ns-resize' | 'crosshair') => {
    if (directDragRef.current && cursor !== 'grabbing') return
    setWorldCursor(cursor)
  }, [])

  const beginDirectDrag = useCallback((
    kind: DirectDragKind,
    event: ThreeEvent<PointerEvent>,
    startY: number,
    objectId?: string,
    routePointTimeSec?: number,
  ) => {
    if (disabled) return
    if (kind === 'whitebox-ground') {
      if (!objectId) return
      setSelection({ kind: 'whitebox', id: objectId })
    }
    if (kind === 'camera-route' && routePointTimeSec !== undefined) {
      setSelectedRoutePoint({ kind: 'camera', timeSec: routePointTimeSec })
    }
    if (kind === 'actor-route' && objectId && routePointTimeSec !== undefined) {
      setSelectedRoutePoint({ kind: 'actor', actorTrackId: objectId, timeSec: routePointTimeSec })
    }
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    const target = event.target as unknown as { setPointerCapture?: (pointerId: number) => void }
    target.setPointerCapture?.(event.pointerId)
    directDragRef.current = {
      kind,
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startY,
      actorTrackId: kind === 'actor-route' && objectId ? objectId : selectedActorTrackId,
      whiteboxEntityId: kind === 'whitebox-ground' ? objectId : undefined,
      routePointTimeSec,
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
      onChange(applyObjectHeightDrag(
        state,
        kind === 'actor-height' ? 'actor' : 'camera',
        currentTimeSec,
        y,
        drag.actorTrackId,
        cameraMode,
      ))
      return
    }

    const point = event.ray.intersectPlane(GROUND_PLANE, new Vector3())
    if (!point) return
    if (kind === 'actor-ground') {
      onChange(applyActorGroundDrag(state, drag.actorTrackId, currentTimeSec, { x: point.x, z: point.z }))
      return
    }

    if (kind === 'whitebox-ground') {
      if (drag.whiteboxEntityId) {
        onChange(applyWhiteboxGroundDrag(state, drag.whiteboxEntityId, { x: point.x, z: point.z }))
      }
      return
    }

    if (kind === 'camera-ground') {
      onChange(applyCameraDollyDrag(state, currentTimeSec, { x: point.x, y: drag.startY, z: point.z }, cameraMode))
      return
    }

    if (kind === 'camera-target') {
      onChange(applyCameraTargetDrag(state, currentTimeSec, { x: point.x, y: drag.startY, z: point.z }, cameraMode))
      return
    }

    if (kind === 'actor-route' && drag.routePointTimeSec !== undefined) {
      const actorTrack = state.masterTake.actorTracks.find((track) => track.id === drag.actorTrackId)
      const keyframe = actorTrack ? exactKeyframe(actorTrack.keyframes, drag.routePointTimeSec) : null
      if (keyframe) {
        onChange(updateSpatialActorPosition(state, drag.actorTrackId, drag.routePointTimeSec, {
          x: point.x,
          y: keyframe.position.y,
          z: point.z,
        }))
      }
      return
    }

    if (drag.routePointTimeSec !== undefined) {
      const keyframe = exactKeyframe(selectSpatialPrevisCameraTrack(state, cameraMode).keyframes, drag.routePointTimeSec)
      if (keyframe) {
        onChange(applyCameraRoutePointDrag(state, cameraMode, drag.routePointTimeSec, {
          x: point.x,
          y: keyframe.position.y,
          z: point.z,
        }))
      }
    }
  }, [cameraMode, currentTimeSec, onChange, state])

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
    setIsObjectDragging(false)
    setWorldCursor('grab')
    setTransformControlVersion((version) => version + 1)
  }, [finishDirectDrag])

  const beginTransformDrag = useCallback(() => {
    setIsObjectDragging(true)
    setWorldCursor('grabbing')
  }, [])

  const endTransformDrag = useCallback(() => {
    setIsObjectDragging(false)
    setWorldCursor('grab')
  }, [])

  const transformActor = useCallback((actorTrackId: string, position: Vec3) => {
    const grounded = applyActorGroundDrag(state, actorTrackId, currentTimeSec, { x: position.x, z: position.z })
    onChange(applyObjectHeightDrag(grounded, 'actor', currentTimeSec, position.y, actorTrackId))
  }, [currentTimeSec, onChange, state])

  const transformCamera = useCallback((position: Vec3, rotation: CameraKeyframe['rotation']) => {
    onChange(applyCameraTransform(state, cameraMode, currentTimeSec, { position, rotation }))
  }, [cameraMode, currentTimeSec, onChange, state])

  const transformCameraTarget = useCallback((target: Vec3) => {
    onChange(applyCameraTargetDrag(state, currentTimeSec, target, cameraMode))
  }, [cameraMode, currentTimeSec, onChange, state])

  const directDragBindings = useMemo<DirectDragBindings>(() => ({
    begin: beginDirectDrag,
    move: moveDirectDrag,
    end: endDirectDrag,
    onDragStateChange: setIsObjectDragging,
    setCursor: setDirectCursor,
  }), [beginDirectDrag, endDirectDrag, moveDirectDrag, setDirectCursor])

  const addActor = useCallback(() => {
    if (disabled) return
    const next = addDefaultActorTrack(state)
    const nextActor = next.masterTake.actorTracks.at(-1)
    if (!nextActor) return
    setSelectedActorTrackId(nextActor.id)
    setSelection({ kind: 'actor' })
    onChange(next)
  }, [disabled, onChange, state])

  return (
    <section data-spatial-previs-viewport="true" className="flex min-h-[470px] w-full flex-col overflow-hidden rounded-lg border border-white/12 bg-[#0b1014] text-white shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-xs font-semibold text-white/78">空间预演</span>
          <span className="text-[11px] text-white/44">{formatNumber(currentTimeSec)} s</span>
          {lowConfidenceWhiteboxCount > 0 ? (
            <span
              role="status"
              aria-label={`低置信度白模：${lowConfidenceWhiteboxCount} 个，仍可编辑`}
              title="低置信度白模仍可直接编辑"
              className="text-[11px] text-amber-200/75"
            >
              低置信度 {lowConfidenceWhiteboxCount}
            </span>
          ) : null}
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
          <button
            type="button"
            aria-label="添加人物"
            disabled={disabled}
            onClick={addActor}
            className="inline-flex items-center gap-1 rounded-md border border-white/12 bg-white/[0.025] px-2 py-1 text-[11px] font-medium text-white/60 transition hover:border-cyan-200/35 hover:bg-cyan-200/[0.09] hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <UserPlus size={13} aria-hidden="true" />
            添加人物
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SpatialNudgeControls
            state={state}
            currentTimeSec={currentTimeSec}
            selection={keyframeSelection}
            actorTrackId={selectedActorTrackId}
            cameraMode={cameraMode}
            disabled={disabled || !keyframeSelection || !selectionHasKeyframe}
            onChange={onChange}
          />
        </div>
      </header>

      <SpatialPrevisDirectorControls
        state={state}
        currentTimeSec={currentTimeSec}
        actorTrackId={selectedActorTrackId}
        cameraMode={cameraMode}
        selectionTool={selection.kind === 'whitebox' ? 'camera' : selection.kind}
        actorSelectable={Boolean(selectedActorTrack)}
        disabled={disabled}
        onChange={onChange}
        onCurrentTimeChange={onCurrentTimeChange}
        onCameraModeChange={setCameraMode}
        onSelectionToolChange={(tool) => setSelection({ kind: tool })}
      />

      <SpatialStudioTools state={sourceState} time={currentTimeSec} tool={studioTool} selection={studioSelection} cameraMode={cameraMode} selectedCameraId={studioCameraId} program={programPreview} disabled={disabled}
        onTool={setStudioTool} onSelection={setStudioSelection} onChange={onSourceChange} onTime={onCurrentTimeChange} onCamera={setStudioCameraId} onProgram={setProgramPreview} />

      <div className="relative min-h-[390px] flex-1 bg-[#071015]">
        <div className="absolute inset-0">
          {mounted ? (
            <WorldCanvas
              state={state}
              currentTimeSec={currentTimeSec}
              sampledCamera={sampledCamera}
              selection={selection}
              selectedActorTrack={selectedActorTrack}
              manipulationEnabled={manipulationEnabled && (!studioTool || studioTool === 'multicamera' || studioTool === 'comparison')}
              interactionDisabled={disabled}
              isObjectDragging={isObjectDragging}
              cursor={worldCursor}
              directDragBindings={directDragBindings}
              cancelDirectDrag={cancelDirectDrag}
              cameraMode={cameraMode}
              selectedRoutePoint={selectedRoutePoint}
              transformControlVersion={transformControlVersion}
              onTransformDragStart={beginTransformDrag}
              onTransformDragEnd={endTransformDrag}
              onActorTransform={transformActor}
              onCameraTransform={transformCamera}
              onCameraTargetTransform={transformCameraTarget}
              studioGizmo={<StudioSceneGizmo state={sourceState} tool={studioTool} selection={studioSelection} time={currentTimeSec} disabled={disabled} onChange={onSourceChange} onDragging={setIsObjectDragging} />}
            />
          ) : <div className="h-full w-full" aria-hidden="true" />}
        </div>

        <aside data-spatial-camera-preview="true" className="absolute bottom-3 right-3 h-36 w-56 overflow-hidden rounded-md border border-white/18 bg-[#080d11] shadow-2xl">
          {mounted && liveCamera ? <LivePreviewCanvas state={sourceState} currentTimeSec={currentTimeSec} sampledCamera={liveCamera} onLiveCanvas={onLiveCanvas} /> : <div className="h-full w-full" aria-hidden="true" />}
          {calibrationReference && <img src={calibrationReference.url} alt={calibrationReference.title} className="pointer-events-none absolute inset-0 h-full w-full object-contain" style={{ opacity: studio.calibration.opacity }} />}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between border-b border-white/10 bg-black/45 px-2 py-1 text-[10px] text-white/72">
            <span>{programPreview ? 'PROGRAM' : 'LIVE'}</span>
            <span>{liveCamera ? `${formatNumber(liveCamera.focalLengthMm)} mm` : '— mm'}</span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/45 px-2 py-1 text-right text-[10px] text-white/64">
            {formatNumber(currentTimeSec)} s
          </div>
        </aside>

        <div className="pointer-events-none absolute bottom-3 left-3 right-60 flex items-center gap-2 overflow-hidden text-[10px] text-white/48">
          <span className="rounded bg-black/35 px-1.5 py-1">X</span>
          <span className="rounded bg-black/35 px-1.5 py-1">Y</span>
          <span className="rounded bg-black/35 px-1.5 py-1">Z</span>
          <span className="truncate">{disabledReason ?? `当前：${selectionLabel}`}</span>
        </div>
      </div>
      {studioTool === 'calibration' && mounted && liveCamera && <div className={studioStyles.comparison}>
        <div className={studioStyles.screen} style={{ maxHeight: 420, width: '100%' }} aria-label="透视校准画面">
          <LivePreviewCanvas state={sourceState} currentTimeSec={currentTimeSec} sampledCamera={liveCamera} />
          {calibrationReference && <img src={calibrationReference.url} alt="校准叠图" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: studio.calibration.opacity, pointerEvents: 'none' }} />}
        </div>
      </div>}
      {studioTool === 'multicamera' && mounted && <div className={studioStyles.monitors} aria-label="多机位监看">{studio.cameras.map(c => <button key={c.track.id} type="button" className={studioStyles.monitor} disabled={disabled} aria-label={`监看切入 ${c.name}`} onClick={() => onSourceChange(updateStudio(putCut(sourceState, c.track.id, currentTimeSec, crypto.randomUUID()), { programEnabled: true }))}>
        <LivePreviewCanvas state={sourceState} currentTimeSec={currentTimeSec} sampledCamera={sampleCamera(c.track.keyframes, currentTimeSec)} /><span>{c.name}</span>
      </button>)}</div>}
      {studioTool === 'comparison' && mounted && liveCamera && <SpatialStudioComparison state={sourceState} time={currentTimeSec} disabled={disabled} onTime={onCurrentTimeChange} onChange={onSourceChange}
        preview={<LivePreviewCanvas state={sourceState} currentTimeSec={currentTimeSec} sampledCamera={liveCamera} />} />}
    </section>
  )
}
