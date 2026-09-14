import { Box3, Ray, Vector3 } from 'three'
import { sampleActor } from './sampler'
import { samplePose } from './studio'
import type { ActorTrack, SpatialPrevisState, Vec3, WhiteboxEntity } from './types'
import type { ActorPose } from './studio-types'

const RADIUS = 0.32
const SKIN = 0.002
const EPSILON = 1e-7
const vector = (p: Vec3) => new Vector3(p.x, p.y, p.z)
const up = new Vector3(0, 1, 0)

function local(point: Vec3, entity: WhiteboxEntity) {
  return vector(point).sub(vector(entity.position)).applyAxisAngle(up, -entity.rotationY)
}

function supportingFloorTop(state: SpatialPrevisState, position: Vec3) {
  let y = -Infinity
  for (const entity of state.scene.whitebox.entities) {
    if (entity.kind !== 'floor') continue
    const top = entity.position.y + entity.size.y / 2
    if (top > position.y + EPSILON) continue
    const point = local(position, entity)
    if (Math.abs(point.x) <= entity.size.x / 2 && Math.abs(point.z) <= entity.size.z / 2) {
      y = Math.max(y, top)
    }
  }
  return y
}

// Stored Y is authored elevation; the existing meshes have below-origin feet.
export function groundedActorPosition(state: SpatialPrevisState, position: Vec3, footDepth = 0.72): Vec3 {
  return { ...position, y: Math.max(position.y, supportingFloorTop(state, position) + footDepth) }
}

export type ActorPlacement = { position: Vec3; collision?: { entityId: string; label: string; timeSec: number } }

export function groundedActorPose(state: SpatialPrevisState, position: Vec3, pose: ActorPose): ActorPose {
  const clampFoot = (foot: Vec3) => {
    const world = vector(foot).applyAxisAngle(up, pose.yaw).add(vector(position))
    const top = supportingFloorTop(state, { x: world.x, y: position.y, z: world.z })
    return world.y < top ? { ...foot, y: top - position.y } : foot
  }
  const leftFoot = clampFoot(pose.leftFoot), rightFoot = clampFoot(pose.rightFoot)
  return leftFoot === pose.leftFoot && rightFoot === pose.rightFoot ? pose : { ...pose, leftFoot, rightFoot }
}

function actorEnvelope(state: SpatialPrevisState, track: ActorTrack, time: number) {
  const authored = samplePose(state, track.id, time)
  const pose = authored ? groundedActorPose(state, groundedActorPosition(state, sampleActor(track, time).position, 0.65), authored) : null
  return {
    footDepth: pose ? Math.max(0.65, -pose.leftFoot.y, -pose.rightFoot.y) : 0.72,
    headHeight: pose ? Math.max(1.44, pose.head.y + 0.19) : 1.44,
  }
}

function incomingPosition(track: ActorTrack, time: number) {
  return track.keyframes.find(k => k.timeSec === time)?.position ?? sampleActor(track, time).position
}

function trajectoryTimes(state: SpatialPrevisState, track: ActorTrack) {
  const firstTime = track.keyframes[0]!.timeSec
  const endTime = Math.max(firstTime, state.masterTake.durationSec)
  const times = new Set([firstTime, endTime, ...track.keyframes.map(k => k.timeSec)])
  for (const key of state.studio?.performances.find(p => p.actorId === track.id)?.keys ?? []) {
    if (key.timeSec >= firstTime && key.timeSec <= endTime) times.add(key.timeSec)
  }
  const addBoundary = (time: number) => {
    // Both sides of a support boundary matter: the rendered path can change
    // height here even though there is no authored route key at this time.
    for (const offset of [-1e-6, 0, 1e-6]) times.add(Math.max(firstTime, Math.min(endTime, time + offset)))
  }
  for (let i = 1; i < track.keyframes.length; i++) {
    const a = track.keyframes[i - 1]!, b = track.keyframes[i]!
    if (a.timeSec === b.timeSec) continue
    for (const floor of state.scene.whitebox.entities.filter(e => e.kind === 'floor')) {
      const start = local(a.position, floor), end = local(b.position, floor)
      const delta = end.clone().sub(start), length = delta.length()
      if (!length) continue
      const bounds = new Box3(new Vector3(-floor.size.x / 2, -Infinity, -floor.size.z / 2), new Vector3(floor.size.x / 2, Infinity, floor.size.z / 2))
      const entry = new Ray(start, delta.clone().normalize()).intersectBox(bounds, new Vector3())
      const exit = new Ray(end, delta.clone().normalize().negate()).intersectBox(bounds, new Vector3())
      const fractions = [entry ? entry.distanceTo(start) / length : -1, exit ? 1 - exit.distanceTo(end) / length : -1]
      if (b.position.y !== a.position.y) fractions.push((floor.position.y + floor.size.y / 2 - a.position.y) / (b.position.y - a.position.y))
      for (const fraction of fractions) if (fraction >= 0 && fraction <= 1) addBoundary(a.timeSec + (b.timeSec - a.timeSec) * fraction)
    }
  }
  const intervals = [...times].sort((a, b) => a - b)
  for (let i = 1; i < intervals.length; i++) {
    const a = intervals[i - 1]!, b = intervals[i]!
    const from = sampleActor(track, a).position, to = incomingPosition(track, b)
    const depths = (time: number) => {
      const pose = samplePose(state, track.id, time)
      return pose ? [0.65] : [0.72]
    }
    const fromDepths = depths(a), toDepths = depths(b)
    for (const floor of state.scene.whitebox.entities.filter(e => e.kind === 'floor')) {
      const top = floor.position.y + floor.size.y / 2
      for (let j = 0; j < fromDepths.length; j++) {
        const start = from.y - top - fromDepths[j]!, end = to.y - top - toDepths[j]!
        if (start === end) continue
        const fraction = start / (start - end)
        if (fraction > 0 && fraction < 1) times.add(a + (b - a) * fraction)
      }
    }
  }
  return [...times].sort((a, b) => a - b)
}

export function sampleActorPlacement(state: SpatialPrevisState, track: ActorTrack, timeSec: number): ActorPlacement {
  if (!track.keyframes.length) return { position: { x: 0, y: 0, z: 0 } }
  track = { ...track, keyframes: [...track.keyframes].sort((a, b) => a.timeSec - b.timeSec) }
  const groundAt = (time: number, incoming = false) => groundedActorPosition(state, incoming ? incomingPosition(track, time) : sampleActor(track, time).position, samplePose(state, track.id, time) ? 0.65 : 0.72)
  if (timeSec < Math.min(...track.keyframes.map(k => k.timeSec))) return { position: groundAt(timeSec) }
  // Approach the first equal-time key, then use the last at that timestamp,
  // exactly as the sampler does. Never sweep the zero-duration replacement.
  const times = trajectoryTimes(state, track)
  if (times.length === 1) times.push(times[0]!)
  const solids = state.scene.whitebox.entities.filter(e => ['wall', 'volume', 'furniture', 'prop'].includes(e.kind))
  let start = groundAt(times[0]!)
  for (let i = 1; i < times.length; i++) {
    const startTime = times[i - 1]!, endTime = times[i]!
    const end = groundAt(endTime, true)
    const fromEnvelope = actorEnvelope(state, track, startTime), toEnvelope = actorEnvelope(state, track, endTime)
    const footDepth = Math.max(fromEnvelope.footDepth, toEnvelope.footDepth)
    const headHeight = Math.max(fromEnvelope.headHeight, toEnvelope.headHeight)
    let first: { fraction: number; entity: WhiteboxEntity } | undefined
    for (const entity of solids) {
      const origin = local(start, entity)
      const delta = local(end, entity).sub(origin)
      const length = delta.length()
      // Sweep the full body envelope, not just the path's center point, so thin
      // walls cannot be skipped by scrubbing or by a low playback frame rate.
      const bounds = new Box3(
        new Vector3(-entity.size.x / 2 - RADIUS, -entity.size.y / 2 - headHeight, -entity.size.z / 2 - RADIUS),
        new Vector3(entity.size.x / 2 + RADIUS, entity.size.y / 2 + footDepth, entity.size.z / 2 + RADIUS),
      ).expandByScalar(-EPSILON)
      const inside = bounds.containsPoint(origin)
      const hit = inside ? origin : length > 0 ? new Ray(origin, delta.clone().normalize()).intersectBox(bounds, new Vector3()) : null
      if (!hit) continue
      const distance = hit.distanceTo(origin)
      if (distance > length) continue
      const fraction = length > 0 ? Math.max(0, (distance - SKIN) / length) : 0
      if (!first || fraction < first.fraction) first = { fraction, entity }
    }
    if (first) {
      const contactTime = startTime + (endTime - startTime) * first.fraction
      if (timeSec < contactTime) return { position: groundAt(timeSec) }
      return {
        position: groundAt(contactTime),
        collision: { entityId: first.entity.id, label: first.entity.label, timeSec: contactTime },
      }
    }
    if (timeSec <= endTime) break
    start = groundAt(endTime)
  }
  return { position: groundAt(timeSec) }
}
