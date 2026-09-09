'use client'

import { Canvas } from '@react-three/fiber'
import { Line } from '@react-three/drei/core/Line'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { PerspectiveCamera as DreiPerspectiveCamera } from '@react-three/drei/core/PerspectiveCamera'
import { TransformControls } from '@react-three/drei/core/TransformControls'
import * as React from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Group, PerspectiveCamera as ThreePerspectiveCamera } from 'three'
import type {
  ActorKeyframe,
  ActorTrack,
  CameraKeyframe,
  SpatialPrevisState,
  Vec3,
} from '@/lib/spatial-previs/types'
import { sampleCamera } from '@/lib/spatial-previs/sampler'
import { SpatialCameraControlStrip } from './SpatialCameraControlStrip'

const KEYFRAME_EPSILON = 1e-6
const WORLD_CAMERA_POSITION: [number, number, number] = [10, 8, 12]
const WORLD_CAMERA_TARGET: [number, number, number] = [0, 1, 0]

type TransformSelection = 'actor' | 'camera' | 'target'

type SpatialPrevisViewportProps = {
  state: SpatialPrevisState
  currentTimeSec: number
  onChange: (next: SpatialPrevisState) => void
}

function tuple(vector: Vec3): [number, number, number] {
  return [vector.x, vector.y, vector.z]
}

function positionFromGroup(group: Group): Vec3 {
  return { x: group.position.x, y: group.position.y, z: group.position.z }
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function exactKeyframe<T extends { timeSec: number }>(keyframes: T[], timeSec: number) {
  const matches = keyframes.filter((keyframe) => Math.abs(keyframe.timeSec - timeSec) <= KEYFRAME_EPSILON)
  return matches.length === 1 ? matches[0] : null
}

function initialActorPosition(track: ActorTrack, currentTimeSec: number) {
  return exactKeyframe(track.keyframes, currentTimeSec)?.position ?? track.keyframes[0]?.position ?? { x: 0, y: 0, z: 0 }
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

function replaceActorKeyframe(state: SpatialPrevisState, track: ActorTrack, keyframe: ActorKeyframe, position: Vec3) {
  return {
    ...state,
    masterTake: {
      ...state.masterTake,
      actorTracks: state.masterTake.actorTracks.map((item) => item !== track ? item : {
        ...item,
        keyframes: item.keyframes.map((actorKeyframe) => actorKeyframe === keyframe
          ? { ...actorKeyframe, position }
          : actorKeyframe),
      }),
    },
  }
}

function ActorProxy({ position, selected }: { position: Vec3; selected: boolean }) {
  return (
    <group position={tuple(position)}>
      <mesh castShadow>
        <capsuleGeometry args={[0.25, 0.9, 6, 10]} />
        <meshStandardMaterial color={selected ? '#a5f3fc' : '#7dd3fc'} emissive={selected ? '#155e75' : '#082f49'} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.67, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.44, 24]} />
        <meshBasicMaterial color={selected ? '#67e8f9' : '#38bdf8'} transparent opacity={0.8} side={2} />
      </mesh>
    </group>
  )
}

function CameraRigMarker({ position, selected }: { position: Vec3; selected: boolean }) {
  const color = selected ? '#facc15' : '#f59e0b'
  return (
    <group position={tuple(position)}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.48, 0.88, 4]} />
        <meshStandardMaterial color={color} emissive="#713f12" roughness={0.45} wireframe />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.32, 0.23, 0.3]} />
        <meshStandardMaterial color={color} emissive="#713f12" roughness={0.4} />
      </mesh>
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

function TransformableProxy({
  selection,
  position,
  enabled,
  onObjectChange,
}: {
  selection: TransformSelection
  position: Vec3
  enabled: boolean
  onObjectChange: (position: Vec3) => void
}) {
  const objectRef = useRef<Group>(null)

  return (
    <TransformControls
      enabled={enabled}
      mode="translate"
      space="world"
      translationSnap={0.05}
      onObjectChange={() => {
        if (objectRef.current) onObjectChange(positionFromGroup(objectRef.current))
      }}
    >
      <group ref={objectRef} position={tuple(position)}>
        {selection === 'actor' ? <ActorProxy position={{ x: 0, y: 0, z: 0 }} selected /> : null}
        {selection === 'camera' ? <CameraRigMarker position={{ x: 0, y: 0, z: 0 }} selected /> : null}
        {selection === 'target' ? <TargetRing position={{ x: 0, y: 0, z: 0 }} selected /> : null}
      </group>
    </TransformControls>
  )
}

function WorldGeometry({
  state,
  currentTimeSec,
  sampledCamera,
  selection,
  selectedActorTrack,
  manipulationEnabled,
  onObjectChange,
}: {
  state: SpatialPrevisState
  currentTimeSec: number
  sampledCamera: CameraKeyframe | null
  selection?: TransformSelection
  selectedActorTrack?: ActorTrack
  manipulationEnabled?: boolean
  onObjectChange?: (position: Vec3) => void
}) {
  const cameraPath = useMemo(
    () => state.masterTake.cameraTrack.keyframes.map((keyframe) => tuple(keyframe.position)),
    [state.masterTake.cameraTrack.keyframes],
  )

  return (
    <>
      <color attach="background" args={['#071015']} />
      <fog attach="fog" args={['#071015', 18, 42]} />
      <ambientLight intensity={0.7} />
      <directionalLight castShadow intensity={1.15} position={[7, 10, 6]} color="#dbeafe" />
      <gridHelper args={[24, 24, '#476475', '#1a2a35']} position={[0, -0.72, 0]} />
      <axesHelper args={[2.4]} position={[-10, -0.69, -10]} />

      {state.masterTake.actorTracks.map((track) => {
        const isSelected = selection === 'actor' && selectedActorTrack === track
        const canTransform = Boolean(isSelected && manipulationEnabled && exactKeyframe(track.keyframes, currentTimeSec))
        const position = initialActorPosition(track, currentTimeSec)
        return (
          <group key={track.id}>
            {track.keyframes.length > 1 ? (
              <Line points={track.keyframes.map((keyframe) => tuple(keyframe.position))} color="#38bdf8" lineWidth={1.5} transparent opacity={0.48} />
            ) : null}
            {isSelected && canTransform && onObjectChange ? (
              <TransformableProxy selection="actor" position={position} enabled onObjectChange={onObjectChange} />
            ) : <ActorProxy position={position} selected={isSelected} />}
          </group>
        )
      })}

      {cameraPath.length > 1 ? <Line points={cameraPath} color="#fbbf24" lineWidth={1.5} transparent opacity={0.68} /> : null}
      {sampledCamera ? <Line points={[tuple(sampledCamera.position), tuple(sampledCamera.target)]} color="#f59e0b" lineWidth={1} dashed dashScale={6} gapSize={0.25} /> : null}

      {sampledCamera ? (
        selection === 'camera' && manipulationEnabled && onObjectChange ? (
          <TransformableProxy selection="camera" position={sampledCamera.position} enabled onObjectChange={onObjectChange} />
        ) : <CameraRigMarker position={sampledCamera.position} selected={selection === 'camera'} />
      ) : null}

      {sampledCamera ? (
        selection === 'target' && manipulationEnabled && onObjectChange ? (
          <TransformableProxy selection="target" position={sampledCamera.target} enabled onObjectChange={onObjectChange} />
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
  onObjectChange: (position: Vec3) => void
}) {
  return (
    <Canvas
      shadows
      camera={{ position: WORLD_CAMERA_POSITION, fov: 48, near: 0.1, far: 100 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
      className="absolute inset-0 h-full w-full"
      style={{ position: 'absolute', inset: 0 }}
    >
      <WorldGeometry {...props} />
      <OrbitControls makeDefault enableDamping target={WORLD_CAMERA_TARGET} maxPolarAngle={Math.PI * 0.48} />
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
      <WorldGeometry state={state} currentTimeSec={currentTimeSec} sampledCamera={sampledCamera} manipulationEnabled={false} />
    </Canvas>
  )
}

export function SpatialPrevisViewport({ state, currentTimeSec, onChange }: SpatialPrevisViewportProps) {
  const [mounted, setMounted] = useState(false)
  const [selection, setSelection] = useState<TransformSelection>(state.masterTake.actorTracks.length > 0 ? 'actor' : 'camera')
  const selectedActorTrack = state.masterTake.actorTracks[0]
  const sampledCamera = state.masterTake.cameraTrack.keyframes.length > 0
    ? sampleCamera(state.masterTake.cameraTrack.keyframes, currentTimeSec)
    : null
  const exactCamera = exactKeyframe(state.masterTake.cameraTrack.keyframes, currentTimeSec)
  const exactActor = selectedActorTrack ? exactKeyframe(selectedActorTrack.keyframes, currentTimeSec) : null
  const selectionHasKeyframe = selection === 'actor' ? Boolean(exactActor) : Boolean(exactCamera)
  const cameraUnavailable = state.scene.coverage.cameraFreedom === 'disabled'
  const manipulationEnabled = selectionHasKeyframe && !(cameraUnavailable && selection !== 'actor')
  const disabledReason = cameraUnavailable
    ? '当前空间覆盖不支持相机编辑'
    : selectionHasKeyframe
      ? undefined
      : '当前时间没有可编辑的关键帧'

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (selection === 'actor' && !selectedActorTrack) setSelection('camera')
  }, [selectedActorTrack, selection])

  const handleObjectChange = useCallback((position: Vec3) => {
    if (selection === 'actor') {
      if (selectedActorTrack && exactActor) onChange(replaceActorKeyframe(state, selectedActorTrack, exactActor, position))
      return
    }

    if (!exactCamera) return
    onChange(replaceCameraKeyframe(state, exactCamera, selection === 'camera' ? { position } : { target: position }))
  }, [exactActor, exactCamera, onChange, selectedActorTrack, selection, state])

  return (
    <section data-spatial-previs-viewport className="flex min-h-[470px] w-full flex-col overflow-hidden rounded-lg border border-white/12 bg-[#0b1014] text-white shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-xs font-semibold text-white/78">空间预演</span>
          <span className="text-[11px] text-white/44">{formatNumber(currentTimeSec)} s</span>
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-white/12" role="group" aria-label="直接操控对象">
          {(['actor', 'camera', 'target'] as const).map((item) => {
            const labels: Record<TransformSelection, string> = { actor: '演员', camera: '相机', target: '目标' }
            const isDisabled = item === 'actor' && !selectedActorTrack
            return (
              <button
                key={item}
                type="button"
                disabled={isDisabled}
                aria-pressed={selection === item}
                onClick={() => setSelection(item)}
                className={`border-r border-white/10 px-2.5 py-1.5 text-xs transition last:border-r-0 disabled:cursor-not-allowed disabled:opacity-35 ${selection === item ? 'bg-cyan-300/15 text-cyan-50' : 'bg-white/[0.025] text-white/52 hover:bg-white/[0.07] hover:text-white/78'}`}
              >
                {labels[item]}
              </button>
            )
          })}
        </div>
      </header>

      <div className="relative min-h-[390px] flex-1 bg-[#071015]">
        {mounted ? (
          <WorldCanvas
            state={state}
            currentTimeSec={currentTimeSec}
            sampledCamera={sampledCamera}
            selection={selection}
            selectedActorTrack={selectedActorTrack}
            manipulationEnabled={manipulationEnabled}
            onObjectChange={handleObjectChange}
          />
        ) : <div className="h-full w-full" aria-hidden="true" />}

        <aside data-spatial-camera-preview className="absolute bottom-3 right-3 h-36 w-56 overflow-hidden rounded-md border border-white/18 bg-[#080d11] shadow-2xl">
          {mounted && sampledCamera ? <LivePreviewCanvas state={state} currentTimeSec={currentTimeSec} sampledCamera={sampledCamera} /> : <div className="h-full w-full" aria-hidden="true" />}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between border-b border-white/10 bg-black/45 px-2 py-1 text-[10px] text-white/72">
            <span>LIVE</span>
            <span>{sampledCamera ? `${formatNumber(sampledCamera.focalLengthMm)} mm` : '— mm'}</span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/45 px-2 py-1 text-right text-[10px] text-white/64">
            {formatNumber(currentTimeSec)} s
          </div>
        </aside>

        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 text-[10px] text-white/48">
          <span className="rounded bg-black/35 px-1.5 py-1">X</span>
          <span className="rounded bg-black/35 px-1.5 py-1">Y</span>
          <span className="rounded bg-black/35 px-1.5 py-1">Z</span>
          <span>{disabledReason ?? '拖动控制器调整当前关键帧'}</span>
        </div>
      </div>

      <SpatialCameraControlStrip
        state={state}
        currentTimeSec={currentTimeSec}
        disabled={cameraUnavailable}
        disabledReason={cameraUnavailable ? '当前空间覆盖不支持相机编辑' : undefined}
        onChange={onChange}
      />
    </section>
  )
}
