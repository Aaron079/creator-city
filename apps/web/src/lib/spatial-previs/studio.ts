import { Vector3 } from 'three'
import { interpolateShortestAngle } from './camera'
import { sampleCamera } from './sampler'
import type { CameraKeyframe, SpatialPrevisState, Vec3 } from './types'
import type { ActorPose, PoseJoint, SpatialStudio, StudioCut, StudioLight, StudioTool } from './studio-types'

export const POSE_JOINTS: PoseJoint[] = ['head', 'leftHand', 'rightHand', 'leftFoot', 'rightFoot']
export function emptyStudio(): SpatialStudio {
  return {
    version: 1,
    calibration: { referenceId: null, opacity: 0.45, verifiedEntityIds: [], editedEntityIds: [] },
    lighting: { enabled: false, ambient: 0.25, lights: [] },
    performances: [], cameras: [], cuts: [],
    review: { referenceId: null, offsetSec: 0, notes: [] },
  }
}
export function studioOf(state: SpatialPrevisState) { return state.studio ?? emptyStudio() }
export function updateStudio(state: SpatialPrevisState, patch: Partial<SpatialStudio>): SpatialPrevisState {
  return { ...state, studio: { ...studioOf(state), ...patch } }
}
export function restoreStudioTool(state: SpatialPrevisState, snapshot: SpatialPrevisState, tool: StudioTool): SpatialPrevisState {
  const previous = retimeStudio(structuredClone(studioOf(snapshot)), state.masterTake.durationSec / snapshot.masterTake.durationSec)
  if (tool === 'lighting') return updateStudio(state, { lighting: previous.lighting })
  if (tool === 'performance') return updateStudio(state, { performances: previous.performances.filter(p => state.masterTake.actorTracks.some(a => a.id === p.actorId)) })
  if (tool === 'multicamera') return updateStudio(state, { cameras: previous.cameras, cuts: previous.cuts, programEnabled: previous.programEnabled })
  if (tool === 'calibration') {
    const entities = state.scene.whitebox.entities.map(entity => {
      const original = snapshot.scene.whitebox.entities.find(e => e.id === entity.id)
      return original ? { ...entity, position: { ...original.position }, size: { ...original.size }, rotationY: original.rotationY } : entity
    })
    return updateStudio({ ...state, scene: { ...state.scene, whitebox: { ...state.scene.whitebox, entities } } }, { calibration: previous.calibration })
  }
  return state
}
export function restPose(): ActorPose {
  return {
    yaw: 0, hipHeight: 0.15,
    head: { x: 0, y: 1.25, z: 0 },
    leftHand: { x: -0.38, y: 0.15, z: 0 }, rightHand: { x: 0.38, y: 0.15, z: 0 },
    leftFoot: { x: -0.13, y: -0.65, z: 0 }, rightFoot: { x: 0.13, y: -0.65, z: 0 },
  }
}
export function posePreset(kind: 'rest' | 'sit' | 'reach'): ActorPose {
  const pose = restPose()
  if (kind === 'sit') return { ...pose, hipHeight: -0.2, head: { x: 0, y: 0.9, z: 0 }, leftFoot: { x: -0.15, y: -0.65, z: 0.48 }, rightFoot: { x: 0.15, y: -0.65, z: 0.48 } }
  if (kind === 'reach') return { ...pose, rightHand: { x: 0.22, y: 0.75, z: 0.65 }, head: { x: 0.1, y: 1.25, z: 0.15 } }
  return pose
}
export function samplePose(state: SpatialPrevisState, actorId: string, time: number): ActorPose | null {
  const keys = studioOf(state).performances.find(p => p.actorId === actorId)?.keys.slice().sort((a, b) => a.timeSec - b.timeSec)
  if (!keys?.length) return null
  const end = keys.find(k => k.timeSec > time)
  const start = keys.filter(k => k.timeSec <= time).at(-1) ?? keys[0]!
  if (!end || time <= start.timeSec) return structuredClone(start.pose)
  const t = (time - start.timeSec) / (end.timeSec - start.timeSec)
  const pose = restPose()
  pose.yaw = interpolateShortestAngle(start.pose.yaw, end.pose.yaw, t)
  pose.hipHeight = start.pose.hipHeight + (end.pose.hipHeight - start.pose.hipHeight) * t
  for (const joint of POSE_JOINTS) for (const axis of ['x', 'y', 'z'] as const) {
    pose[joint][axis] = start.pose[joint][axis] + (end.pose[joint][axis] - start.pose[joint][axis]) * t
  }
  return pose
}
export function setPose(state: SpatialPrevisState, actorId: string, timeSec: number, pose: ActorPose): SpatialPrevisState {
  if (!state.masterTake.actorTracks.some(t => t.id === actorId) || !Number.isFinite(timeSec)) return state
  const time = Math.max(0, Math.min(state.masterTake.durationSec, timeSec))
  const studio = studioOf(state)
  const current = studio.performances.find(p => p.actorId === actorId)
  const existing = current?.keys.find(k => Math.abs(k.timeSec - time) <= 0.001)
  const baseId = `${actorId}-pose-${time}`
  let id = existing?.id ?? baseId
  for (let suffix = 1; !existing && current?.keys.some(k => k.id === id); suffix++) id = `${baseId}-${suffix}`
  const key = { id, timeSec: time, pose: structuredClone(pose) }
  const performance = { actorId, keys: [...(current?.keys ?? []).filter(k => Math.abs(k.timeSec - time) > 0.001), key].sort((a, b) => a.timeSec - b.timeSec) }
  return updateStudio(state, { performances: [...studio.performances.filter(p => p.actorId !== actorId), performance] })
}
export function retimePose(state: SpatialPrevisState, actorId: string, keyId: string, timeSec: number) {
  if (!Number.isFinite(timeSec)) return state
  const studio = studioOf(state)
  const time = Math.max(0, Math.min(state.masterTake.durationSec, timeSec))
  return updateStudio(state, { performances: studio.performances.map(p => {
    if (p.actorId !== actorId || !p.keys.some(k => k.id === keyId)) return p
    if (p.keys.some(k => k.id !== keyId && Math.abs(k.timeSec - time) < 0.001)) return p
    return { ...p, keys: p.keys.map(k => k.id === keyId ? { ...k, timeSec: time } : k).sort((a, b) => a.timeSec - b.timeSec) }
  }) })
}

// Analytic two-bone IK clamps unreachable targets and keeps the bend plane stable.
export function solveLimb(root: Vec3, target: Vec3, pole: Vec3, upper = 0.4, lower = 0.4) {
  const origin = new Vector3(root.x, root.y, root.z)
  const direction = new Vector3(target.x, target.y, target.z).sub(origin)
  const distance = Math.max(Math.abs(upper - lower) + 0.0001, Math.min(upper + lower - 0.0001, direction.length()))
  if (direction.lengthSq() < 1e-8) direction.set(0, -1, 0)
  direction.normalize()
  const bend = new Vector3(pole.x, pole.y, pole.z).sub(origin)
  bend.addScaledVector(direction, -bend.dot(direction))
  if (bend.lengthSq() < 1e-8) {
    bend.set(Math.abs(direction.x) < 0.8 ? 1 : 0, Math.abs(direction.x) < 0.8 ? 0 : 1, 0)
    bend.addScaledVector(direction, -bend.dot(direction))
  }
  bend.normalize()
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
  const joint = origin.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)))
  const tip = origin.clone().addScaledVector(direction, distance)
  return { joint, tip }
}
export function newStudioLight(kind: StudioLight['kind'], id: string): StudioLight {
  return { id, name: kind === 'sun' ? '太阳光' : '聚光灯', kind, enabled: true, position: { x: 3, y: 5, z: 4 }, target: { x: 0, y: 0.6, z: 0 }, intensity: kind === 'sun' ? 2 : 80, temperature: 5600, angle: 0.65, softness: 0.5 }
}
export function temperatureColor(kelvin: number) {
  const t = Math.max(1000, Math.min(12000, kelvin)) / 100
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`
}
export function addStudioCamera(state: SpatialPrevisState, source: 'director' | 'aerial', id: string, selectedCameraId?: string): SpatialPrevisState {
  const cameras = studioOf(state).cameras
  const track = cameras.find(c => c.track.id === selectedCameraId)?.track ?? (source === 'director' ? state.masterTake.cameraTrack : state.masterTake.aerialCameraTrack)
  let number = cameras.length + 1
  while (cameras.some(c => c.name === `机位 ${number}`)) number++
  return updateStudio(state, { cameras: [...cameras, { name: `机位 ${number}`, track: { ...structuredClone(track), id } }] })
}
export function putCut(state: SpatialPrevisState, cameraId: string, timeSec: number, id: string): SpatialPrevisState {
  const studio = studioOf(state)
  if (!studio.cameras.some(c => c.track.id === cameraId) || !Number.isFinite(timeSec)) return state
  const time = Math.max(0, Math.min(state.masterTake.durationSec, timeSec))
  const cuts: StudioCut[] = [...studio.cuts.filter(c => c.id !== id && Math.abs(c.timeSec - time) > 0.001), { id, cameraId, timeSec: time }].sort((a, b) => a.timeSec - b.timeSec)
  return updateStudio(state, { cuts })
}
export function selectProgramCameraTrack(state: SpatialPrevisState, time: number) {
  const studio = studioOf(state)
  const cut = studio.cuts.filter(c => c.timeSec <= time).sort((a, b) => a.timeSec - b.timeSec).at(-1)
  const camera = studio.cameras.find(c => c.track.id === cut?.cameraId) ?? studio.cameras[0]
  return camera?.track ?? null
}
export function sampleProgramCamera(state: SpatialPrevisState, time: number): CameraKeyframe | null {
  const track = selectProgramCameraTrack(state, time)
  return track ? sampleCamera(track.keyframes, time) : null
}
export function retimeStudio(studio: SpatialStudio, scale: number): SpatialStudio {
  return {
    ...studio,
    performances: studio.performances.map(p => ({ ...p, keys: p.keys.map(k => ({ ...k, timeSec: k.timeSec * scale })) })),
    cameras: studio.cameras.map(c => ({ ...c, track: { ...c.track, keyframes: c.track.keyframes.map(k => ({ ...k, timeSec: k.timeSec * scale })) } })),
    cuts: studio.cuts.map(c => ({ ...c, timeSec: c.timeSec * scale })),
    review: { ...studio.review, notes: studio.review.notes.map(n => ({ ...n, startSec: n.startSec * scale, endSec: n.endSec * scale })) },
  }
}
