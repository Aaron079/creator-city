'use client'

import * as React from 'react'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { TransformControls } from '@react-three/drei/core/TransformControls'
import { useFrame, useThree } from '@react-three/fiber'
import { Object3D, Quaternion, Vector3 } from 'three'
import type { Group } from 'three'
import { restPose, samplePose, setPose, solveLimb, studioOf, temperatureColor, updateStudio } from '@/lib/spatial-previs/studio'
import { sampleActor } from '@/lib/spatial-previs/sampler'
import type { SpatialPrevisState, Vec3 } from '@/lib/spatial-previs/types'
import type { ActorPose, PoseJoint, StudioLight, StudioTool } from '@/lib/spatial-previs/studio-types'
import { updateWhiteboxEntity } from '@/lib/spatial-previs/whitebox-edit'

const tuple = (v: Vec3): [number, number, number] => [v.x, v.y, v.z]

function Lamp({ light }: { light: StudioLight }) {
  const target = useMemo(() => new Object3D(), [])
  useLayoutEffect(() => { target.position.set(...tuple(light.target)); target.updateMatrixWorld() }, [light.target, target])
  if (!light.enabled) return null
  const color = temperatureColor(light.temperature)
  return <>
    <primitive object={target} />
    {light.kind === 'sun'
      ? <directionalLight position={tuple(light.position)} target={target} intensity={light.intensity} color={color} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} shadow-normalBias={0.04} shadow-radius={1 + light.softness * 8} />
      : <spotLight position={tuple(light.position)} target={target} intensity={light.intensity} color={color} angle={light.angle} penumbra={light.softness} distance={70} decay={2} castShadow shadow-mapSize={[1024, 1024]} shadow-normalBias={0.03} />}
  </>
}
export function SpatialStudioLighting({ state, markers = false }: { state: SpatialPrevisState; markers?: boolean }) {
  const plan = studioOf(state).lighting
  if (!plan.enabled) return null
  return <>
    <ambientLight intensity={plan.ambient} />
    {plan.lights.map(light => <React.Fragment key={light.id}>
      <Lamp light={light} />
      {markers && <group position={tuple(light.position)}>
        <mesh><sphereGeometry args={[0.13, 12, 8]} /><meshBasicMaterial color={light.enabled ? temperatureColor(light.temperature) : '#666666'} /></mesh>
        <mesh position={[0, -0.18, 0]}><boxGeometry args={[0.32, 0.12, 0.25]} /><meshStandardMaterial color="#303438" /></mesh>
      </group>}
    </React.Fragment>)}
  </>
}
function Bone({ from, to, radius = 0.07 }: { from: Vec3; to: Vec3; radius?: number }) {
  const start = new Vector3(...tuple(from))
  const end = new Vector3(...tuple(to))
  const delta = end.clone().sub(start)
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.clone().normalize())
  return <mesh castShadow position={start.add(end).multiplyScalar(0.5)} quaternion={q}>
    <capsuleGeometry args={[radius, Math.max(0.01, delta.length() - radius * 2), 4, 10]} />
    <meshStandardMaterial color="#a9d7df" roughness={0.7} />
  </mesh>
}
function Limb({ root, target, pole }: { root: Vec3; target: Vec3; pole: Vec3 }) {
  const { joint, tip } = solveLimb(root, target, pole)
  return <><Bone from={root} to={joint} /><Bone from={joint} to={tip} />
    <mesh position={joint} castShadow><sphereGeometry args={[0.08, 10, 8]} /><meshStandardMaterial color="#d7e2e4" /></mesh>
  </>
}
export function PerformanceActor({ pose }: { pose: ActorPose }) {
  const shoulderY = pose.hipHeight + 0.68
  return <group rotation={[0, pose.yaw, 0]}>
    <Bone from={{ x: 0, y: pose.hipHeight, z: 0 }} to={{ x: 0, y: shoulderY, z: 0 }} radius={0.21} />
    <Bone from={{ x: 0, y: shoulderY, z: 0 }} to={pose.head} radius={0.08} />
    <mesh position={tuple(pose.head)} castShadow><sphereGeometry args={[0.19, 16, 12]} /><meshStandardMaterial color="#e3ecee" roughness={0.7} /></mesh>
    <mesh position={[pose.head.x, pose.head.y, pose.head.z + 0.18]}><boxGeometry args={[0.06, 0.06, 0.06]} /><meshStandardMaterial color="#899da2" /></mesh>
    <Limb root={{ x: -0.24, y: shoulderY, z: 0 }} target={pose.leftHand} pole={{ x: -0.5, y: 0.6, z: -1 }} />
    <Limb root={{ x: 0.24, y: shoulderY, z: 0 }} target={pose.rightHand} pole={{ x: 0.5, y: 0.6, z: -1 }} />
    <Limb root={{ x: -0.13, y: pose.hipHeight, z: 0 }} target={pose.leftFoot} pole={{ x: -0.13, y: 0, z: 1 }} />
    <Limb root={{ x: 0.13, y: pose.hipHeight, z: 0 }} target={pose.rightFoot} pole={{ x: 0.13, y: 0, z: 1 }} />
  </group>
}

export type StudioSelection = { entityId: string; lightId: string; actorId: string; joint: PoseJoint; lampTarget: boolean; transform: 'translate' | 'rotate' | 'scale' }
export function StudioSceneGizmo({ state, tool, selection, time, disabled, onChange, onDragging }: {
  state: SpatialPrevisState; tool: StudioTool | null; selection: StudioSelection; time: number; disabled: boolean
  onChange: (next: SpatialPrevisState) => void; onDragging: (active: boolean) => void
}) {
  const group = useRef<Group>(null!)
  const control = useRef<React.ElementRef<typeof TransformControls>>(null)
  const canvas = useThree(s => s.gl.domElement)
  const dragging = useRef(false)
  const studio = studioOf(state)
  const entity = state.scene.whitebox.entities.find(e => e.id === selection.entityId)
  const light = studio.lighting.lights.find(l => l.id === selection.lightId)
  const actor = state.masterTake.actorTracks.find(a => a.id === selection.actorId)
  const pose = actor ? samplePose(state, actor.id, time) ?? restPose() : null
  const actorPosition = actor?.keyframes.length ? sampleActor(actor, time).position : null
  let position: Vec3 | null = null
  if (tool === 'calibration' && entity) position = entity.position
  if (tool === 'lighting' && light) position = selection.lampTarget ? light.target : light.position
  if (tool === 'performance' && pose && actorPosition) {
    position = new Vector3(...tuple(pose[selection.joint])).applyAxisAngle(new Vector3(0, 1, 0), pose.yaw).add(new Vector3(...tuple(actorPosition)))
  }
  const mode = tool === 'calibration' ? selection.transform : 'translate'
  const x = position?.x, y = position?.y, z = position?.z
  const rotationY = tool === 'calibration' ? entity?.rotationY ?? 0 : 0
  useLayoutEffect(() => {
    const object = group.current
    if (!object || x === undefined || y === undefined || z === undefined || dragging.current) return
    object.position.set(x, y, z)
    object.rotation.set(0, rotationY, 0)
    object.scale.set(1, 1, 1)
  }, [x, y, z, rotationY, mode, tool])
  React.useEffect(() => {
    const cancel = () => { dragging.current = false; onDragging(false) }
    canvas.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    return () => { canvas.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); cancel() }
  }, [canvas, onDragging, tool])
  useFrame(() => {
    const active = control.current as unknown as { axis?: string | null } | null
    canvas.dataset.studioTransformAxis = active?.axis ?? ''
  })
  if (!position || disabled) return null
  const commit = () => {
    const obj = group.current
    if (!obj) return
    if (tool === 'calibration' && entity) {
      let next = updateWhiteboxEntity(state, entity.id, {
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z }, rotationY: obj.rotation.y,
        ...(mode === 'scale' ? { size: { x: Math.max(0.05, entity.size.x * obj.scale.x), y: Math.max(0.05, entity.size.y * obj.scale.y), z: Math.max(0.05, entity.size.z * obj.scale.z) } } : {}),
      })
      next = updateStudio(next, { calibration: { ...studio.calibration, verifiedEntityIds: studio.calibration.verifiedEntityIds.filter(id => id !== entity.id), editedEntityIds: [...new Set([...studio.calibration.editedEntityIds, entity.id])] } })
      onChange(next)
      obj.scale.set(1, 1, 1)
    }
    if (tool === 'lighting' && light) onChange(updateStudio(state, { lighting: { ...studio.lighting, lights: studio.lighting.lights.map(l => l.id === light.id ? { ...l, [selection.lampTarget ? 'target' : 'position']: { x: obj.position.x, y: obj.position.y, z: obj.position.z } } : l) } }))
    if (tool === 'performance' && actor && pose && actorPosition) {
      const local = obj.position.clone().sub(new Vector3(...tuple(actorPosition))).applyAxisAngle(new Vector3(0, 1, 0), -pose.yaw)
      onChange(setPose(state, actor.id, time, { ...pose, [selection.joint]: { x: local.x, y: local.y, z: local.z } }))
    }
  }
  return <>
    <group ref={group} name="studio-transform-anchor" position={tuple(position)}>
      <mesh><sphereGeometry args={[0.09, 12, 8]} /><meshBasicMaterial color="#f4e5a4" depthTest={false} transparent opacity={0.85} /></mesh>
    </group>
    <TransformControls ref={control} object={group} mode={mode} size={0.85} showX={mode !== 'rotate'} showY showZ={mode !== 'rotate'}
    onMouseDown={() => { dragging.current = true; onDragging(true) }}
    onMouseUp={() => { commit(); dragging.current = false; onDragging(false) }}
    onObjectChange={() => { if (dragging.current && mode !== 'scale') commit() }} />
  </>
}
