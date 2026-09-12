import { normalizeSpatialPrevis } from './normalize'
import type { SpatialStudio } from './studio-types'
import { clampFocalLength, isValidFocalLength, rotationFromTarget } from './camera'
import { isRenderableMediaUrl } from '../media/renderable-url'
import type {
  ActorKeyframe,
  ActorTrack,
  CameraKeyframe,
  CameraTrack,
  SpatialAssetRole,
  SpatialAssetSet,
  SpatialSceneReference,
  SpatialPrevisBeat,
  SpatialPrevisState,
  Vec3,
  WhiteboxEntity,
} from './types'

type MetadataRecord = Record<string, unknown>

const SOURCE_MODES = new Set(['single-image-exterior', 'multi-view', 'video-scan', 'manual'])
const ASPECT_RATIOS = new Set(['16:9', '9:16', '1:1'])
const EDITOR_MODES = new Set(['continuous', 'beats'])
const CAMERA_INTENTS = new Set(['push', 'pull', 'pan-tilt', 'dolly', 'follow', 'crane', 'static'])
const SHOT_SCALES = new Set(['extreme-close-up', 'close-up', 'near', 'medium-close', 'medium', 'medium-wide', 'wide', 'long', 'extreme-long', 'establishing'])
const CAMERA_MOTION_BASELINES = new Set(['push', 'pull', 'pan', 'move', 'follow', 'rise', 'fall', 'static'])
const REFERENCE_MEDIA_TYPES = new Set(['image', 'video'])
const REFERENCE_SOURCES = new Set(['project', 'library', 'upload'])
const ASSET_ROLES = new Set(['scene', 'character', 'prop', 'reference'])
const WHITEBOX_ENTITY_KINDS = new Set(['floor', 'wall', 'opening', 'volume', 'furniture', 'referencePlane', 'prop'])
const MIN_DURATION_SEC = 5
const MAX_DURATION_SEC = 180

function record(value: unknown): MetadataRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as MetadataRecord
    : null
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function vec3(value: unknown): Vec3 | null {
  const item = record(value)
  if (!item) return null
  const x = number(item.x)
  const y = number(item.y)
  const z = number(item.z)
  return x === null || y === null || z === null ? null : { x, y, z }
}

function references(value: unknown): SpatialSceneReference[] | null {
  if (!Array.isArray(value)) return null
  const items: SpatialSceneReference[] = []
  const referenceIds = new Set<string>()
  const assetIds = new Set<string>()
  for (const candidate of value) {
    const reference = record(candidate)
    if (!reference) return null
    const id = string(reference.id)
    const assetId = string(reference.assetId)
    const title = string(reference.title)
    const url = string(reference.url)
    if (
      !id
      || referenceIds.has(id)
      || !assetId
      || assetIds.has(assetId)
      || !title
      || !url
      || !isRenderableMediaUrl(url).ok
      || !REFERENCE_MEDIA_TYPES.has(reference.mediaType as string)
      || !REFERENCE_SOURCES.has(reference.source as string)
    ) {
      return null
    }
    referenceIds.add(id)
    assetIds.add(assetId)
    items.push({
      ...reference,
      id,
      assetId,
      title,
      mediaType: reference.mediaType as SpatialSceneReference['mediaType'],
      url,
      source: reference.source as SpatialSceneReference['source'],
    } as SpatialSceneReference)
  }
  return items
}

function assetSets(value: unknown, sceneReferences: SpatialSceneReference[]): SpatialAssetSet[] | null {
  if (!Array.isArray(value)) return null
  const referenceIds = new Set(sceneReferences.map((reference) => reference.id))
  const assetSetIds = new Set<string>()
  const items: SpatialAssetSet[] = []
  for (const candidate of value) {
    const assetSet = record(candidate)
    if (!assetSet || !Array.isArray(assetSet.referenceIds) || assetSet.referenceIds.length === 0) return null
    const id = string(assetSet.id)
    if (!id || assetSetIds.has(id) || !ASSET_ROLES.has(assetSet.role as string)) return null

    const parsedReferenceIds: string[] = []
    const assetSetReferenceIds = new Set<string>()
    for (const referenceId of assetSet.referenceIds) {
      const parsedReferenceId = string(referenceId)
      if (
        !parsedReferenceId
        || assetSetReferenceIds.has(parsedReferenceId)
        || !referenceIds.has(parsedReferenceId)
      ) {
        return null
      }
      assetSetReferenceIds.add(parsedReferenceId)
      parsedReferenceIds.push(parsedReferenceId)
    }

    assetSetIds.add(id)
    items.push({
      id,
      role: assetSet.role as SpatialAssetRole,
      referenceIds: parsedReferenceIds,
    })
  }
  return items
}

function whitebox(value: unknown, legacy: boolean): { entities: WhiteboxEntity[] } | null {
  const item = record(value)
  if (!item || !Array.isArray(item.entities)) return null
  const entities: WhiteboxEntity[] = []
  const entityIds = new Set<string>()
  for (const candidate of item.entities) {
    const entity = record(candidate)
    if (!entity || !Array.isArray(entity.sourceAssetIds)) return null
    const id = string(entity.id)
    const label = legacy ? id : string(entity.label)
    const confidence = legacy ? 1 : number(entity.confidence)
    const position = vec3(entity.position)
    const rotationY = number(entity.rotationY)
    const size = vec3(entity.size)
    const sourceAssetIds: string[] = []
    for (const sourceAssetId of entity.sourceAssetIds) {
      const parsedSourceAssetId = string(sourceAssetId)
      if (!parsedSourceAssetId) return null
      sourceAssetIds.push(parsedSourceAssetId)
    }
    if (
      !id
      || !label
      || confidence === null
      || confidence < 0
      || confidence > 1
      || !position
      || rotationY === null
      || !size
      || !WHITEBOX_ENTITY_KINDS.has(entity.kind as string)
      || sourceAssetIds.length === 0
      || entityIds.has(id)
    ) {
      return null
    }
    entityIds.add(id)
    entities.push({
      id,
      label,
      confidence,
      kind: entity.kind as WhiteboxEntity['kind'],
      position,
      rotationY,
      size,
      sourceAssetIds,
    })
  }
  return { entities }
}

function coverageMatches(value: unknown, expected: SpatialPrevisState['scene']['coverage']) {
  const coverage = record(value)
  if (!coverage || coverage.mode !== expected.mode || coverage.cameraFreedom !== expected.cameraFreedom) {
    return false
  }
  if (expected.mode !== 'constrained') return true
  const corridor = record(coverage.corridor)
  const min = vec3(corridor?.min)
  const max = vec3(corridor?.max)
  return min?.x === expected.corridor.min.x
    && min.y === expected.corridor.min.y
    && min.z === expected.corridor.min.z
    && max?.x === expected.corridor.max.x
    && max.y === expected.corridor.max.y
    && max.z === expected.corridor.max.z
}

function motionBaselineForIntent(intent: CameraKeyframe['intent']): CameraKeyframe['motionBaseline'] {
  switch (intent) {
    case 'pan-tilt': return 'pan'
    case 'dolly': return 'move'
    case 'crane': return 'rise'
    default: return intent
  }
}

function cameraTrack(value: unknown, legacy: boolean): CameraTrack | null {
  const item = record(value)
  if (!item || !Array.isArray(item.keyframes) || item.keyframes.length === 0) return null
  const id = string(item.id)
  if (!id) return null
  const keyframes: CameraKeyframe[] = []
  for (const candidate of item.keyframes) {
    const keyframe = record(candidate)
    if (!keyframe) return null
    const keyframeId = string(keyframe.id)
    const timeSec = number(keyframe.timeSec)
    const position = vec3(keyframe.position)
    const target = vec3(keyframe.target)
    const focalLengthMm = number(keyframe.focalLengthMm)
    if (!keyframeId || timeSec === null || !position || !target || focalLengthMm === null || !CAMERA_INTENTS.has(keyframe.intent as string)) {
      return null
    }
    const intent = keyframe.intent as CameraKeyframe['intent']
    if (legacy) {
      keyframes.push({
        id: keyframeId,
        timeSec,
        position,
        target,
        rotation: rotationFromTarget(position, target),
        focalLengthMm: clampFocalLength(focalLengthMm),
        shotScale: 'medium',
        motionBaseline: motionBaselineForIntent(intent),
        intent,
      })
      continue
    }

    const rotation = record(keyframe.rotation)
    const pitch = rotation && number(rotation.pitch)
    const yaw = rotation && number(rotation.yaw)
    const roll = rotation && number(rotation.roll)
    if (
      pitch === null
      || yaw === null
      || roll === null
      || !isValidFocalLength(focalLengthMm)
      || !SHOT_SCALES.has(keyframe.shotScale as string)
      || !CAMERA_MOTION_BASELINES.has(keyframe.motionBaseline as string)
    ) {
      return null
    }
    keyframes.push({
      id: keyframeId,
      timeSec,
      position,
      target,
      rotation: { pitch, yaw, roll },
      focalLengthMm,
      shotScale: keyframe.shotScale as CameraKeyframe['shotScale'],
      motionBaseline: keyframe.motionBaseline as CameraKeyframe['motionBaseline'],
      intent,
    })
  }
  return { id, keyframes }
}

function actorTracks(value: unknown): ActorTrack[] | null {
  if (!Array.isArray(value)) return null
  const tracks: ActorTrack[] = []
  for (const candidate of value) {
    const track = record(candidate)
    if (!track || !Array.isArray(track.keyframes)) return null
    const id = string(track.id)
    const anchorId = string(track.anchorId)
    if (!id || !anchorId) return null
    const keyframes: ActorKeyframe[] = []
    for (const keyframeCandidate of track.keyframes) {
      const keyframe = record(keyframeCandidate)
      if (!keyframe) return null
      const keyframeId = string(keyframe.id)
      const timeSec = number(keyframe.timeSec)
      const position = vec3(keyframe.position)
      const action = string(keyframe.action)
      if (!keyframeId || timeSec === null || !position || !action) return null
      keyframes.push({ id: keyframeId, timeSec, position, action })
    }
    tracks.push({ id, anchorId, keyframes })
  }
  return tracks
}

function beats(value: unknown): SpatialPrevisBeat[] | null {
  if (!Array.isArray(value)) return null
  const items: SpatialPrevisBeat[] = []
  for (const candidate of value) {
    const beat = record(candidate)
    if (!beat) return null
    const id = string(beat.id)
    const label = string(beat.label)
    const startSec = number(beat.startSec)
    const endSec = number(beat.endSec)
    if (!id || !label || startSec === null || endSec === null) return null
    items.push({ id, label, startSec, endSec })
  }
  return items
}

function timelineIsExecutable(
  cameraTrack: CameraTrack,
  aerialCameraTrack: CameraTrack,
  actorTracks: ActorTrack[],
  beats: SpatialPrevisBeat[],
  durationSec: number,
) {
  if (
    durationSec < MIN_DURATION_SEC
    || durationSec > MAX_DURATION_SEC
    || cameraTrack.keyframes.some((keyframe) => keyframe.timeSec < 0 || keyframe.timeSec > durationSec)
    || aerialCameraTrack.keyframes.some((keyframe) => keyframe.timeSec < 0 || keyframe.timeSec > durationSec)
    || actorTracks.some((track) => track.keyframes.some(
      (keyframe) => keyframe.timeSec < 0 || keyframe.timeSec > durationSec,
    ))
  ) {
    return false
  }

  return beats.every((beat) => (
    beat.startSec >= 0
    && beat.startSec <= beat.endSec
    && beat.endSec <= durationSec
  ))
}

function studioMetadata(value: unknown, duration: number): SpatialStudio | null {
  const s = record(value)
  if (!s || s.version !== 1) return null
  if (s.programEnabled !== undefined && typeof s.programEnabled !== 'boolean') return null
  const c = record(s.calibration)
  const l = record(s.lighting)
  const r = record(s.review)
  const range = (v: unknown, min: number, max: number) => number(v) !== null && (v as number) >= min && (v as number) <= max
  const nullableId = (v: unknown) => v === null || string(v) !== null
  const unique = (items: MetadataRecord[], key: string) => items.every(i => string(i[key])) && new Set(items.map(i => i[key])).size === items.length
  if (!c || !l || !r || !nullableId(c.referenceId) || !range(c.opacity, 0, 1)
    || !Array.isArray(c.verifiedEntityIds) || !c.verifiedEntityIds.every(id => string(id))
    || !Array.isArray(c.editedEntityIds) || !c.editedEntityIds.every(id => string(id))
    || typeof l.enabled !== 'boolean' || !range(l.ambient, 0, 2) || !Array.isArray(l.lights)
    || !nullableId(r.referenceId) || !range(r.offsetSec, -180, 180) || !Array.isArray(r.notes)
    || !Array.isArray(s.performances) || !Array.isArray(s.cameras) || !Array.isArray(s.cuts)) return null
  for (const value of l.lights) {
    const light = record(value)
    if (!light || !string(light.id) || !string(light.name) || !['spot', 'sun'].includes(light.kind as string)
      || typeof light.enabled !== 'boolean' || !vec3(light.position) || !vec3(light.target)
      || !range(light.intensity, 0, 500) || !range(light.temperature, 1000, 12000)
      || !range(light.angle, 0.05, 1.5) || !range(light.softness, 0, 1)) return null
  }
  for (const value of s.performances) {
    const p = record(value)
    if (!p || !string(p.actorId) || !Array.isArray(p.keys)) return null
    for (const value of p.keys) {
      const k = record(value)
      const pose = record(k?.pose)
      if (!k || !string(k.id) || !range(k.timeSec, 0, duration) || !pose || !range(pose.hipHeight, -0.6, 1.5)
        || number(pose.yaw) === null || !['head', 'leftHand', 'rightHand', 'leftFoot', 'rightFoot'].every(j => vec3(pose[j]))) return null
    }
    if (!unique(p.keys, 'id') || new Set(p.keys.map(k => k.timeSec)).size !== p.keys.length) return null
  }
  const cameraIds = new Set<string>()
  for (const value of s.cameras) {
    const c = record(value)
    const track = c && cameraTrack(c.track, false)
    if (!c || !string(c.name) || !track || cameraIds.has(track.id) || track.keyframes.some(k => !range(k.timeSec, 0, duration))) return null
    cameraIds.add(track.id)
  }
  for (const value of s.cuts) {
    const cut = record(value)
    if (!cut || !string(cut.id) || !cameraIds.has(cut.cameraId as string) || !range(cut.timeSec, 0, duration)) return null
  }
  for (const value of r.notes) {
    const n = record(value)
    if (!n || !string(n.id) || !range(n.startSec, 0, duration) || !range(n.endSec, n.startSec as number, duration)
      || !['composition', 'actor', 'scene', 'lighting', 'timing'].includes(n.category as string)
      || !string(n.text) || typeof n.resolved !== 'boolean') return null
  }
  if (!unique(l.lights, 'id') || !unique(s.performances, 'actorId') || !unique(s.cuts, 'id') || !unique(r.notes, 'id')) return null
  return structuredClone(s) as SpatialStudio
}

function state(value: unknown): SpatialPrevisState | null {
  const candidate = record(value)
  if (!candidate || (candidate.version !== 1 && candidate.version !== 2 && candidate.version !== 3 && candidate.version !== 4)) return null
  const projectId = string(candidate.projectId)
  const scene = record(candidate.scene)
  const masterTake = record(candidate.masterTake)
  const editorMode = candidate.editorMode
  const updatedAt = string(candidate.updatedAt)
  if (!projectId || !scene || !masterTake || !EDITOR_MODES.has(editorMode as string) || !updatedAt) return null

  const sourceMode = scene.sourceMode
  const durationSec = number(masterTake.durationSec)
  const aspectRatio = masterTake.aspectRatio
  const masterTakeId = string(masterTake.id)
  if (
    !SOURCE_MODES.has(sourceMode as string)
    || durationSec === null
    || !ASPECT_RATIOS.has(aspectRatio as string)
    || !masterTakeId
  ) {
    return null
  }

  const normalized = normalizeSpatialPrevis({
    projectId,
    sourceMode: sourceMode as SpatialPrevisState['scene']['sourceMode'],
    durationSec,
    aspectRatio: aspectRatio as SpatialPrevisState['masterTake']['aspectRatio'],
    editorMode: editorMode as SpatialPrevisState['editorMode'],
    updatedAt,
  })

  const studio = candidate.studio === undefined ? undefined : studioMetadata(candidate.studio, durationSec)
  if (studio === null) return null

  const parsedActorTracks = actorTracks(masterTake.actorTracks)
  const legacy = candidate.version !== 4
  const parsedCameraTrack = cameraTrack(masterTake.cameraTrack, legacy)
  const parsedAerialCameraTrack = legacy
    ? normalized.masterTake.aerialCameraTrack
    : cameraTrack(masterTake.aerialCameraTrack, false)
  const parsedBeats = beats(masterTake.beats)
  const parsedReferences = candidate.version === 1 ? [] : references(scene.references)
  const parsedAssetSets = candidate.version === 3 || candidate.version === 4
    ? parsedReferences && assetSets(scene.assetSets, parsedReferences)
    : parsedReferences?.map((reference, index) => ({
      id: `asset-set-legacy-${index + 1}`,
      role: 'scene' as const,
      referenceIds: [reference.id],
    }))
  const parsedWhitebox = candidate.version === 1
    ? { entities: [] }
    : whitebox(scene.whitebox, candidate.version === 2)
  if (
    !coverageMatches(scene.coverage, normalized.scene.coverage)
    || !parsedActorTracks
    || !parsedCameraTrack
    || !parsedAerialCameraTrack
    || !parsedBeats
    || !parsedReferences
    || !parsedAssetSets
    || !parsedWhitebox
    || !timelineIsExecutable(parsedCameraTrack, parsedAerialCameraTrack, parsedActorTracks, parsedBeats, durationSec)
  ) {
    return null
  }

  return {
    ...normalized,
    ...(studio ? { studio } : {}),
    scene: {
      ...normalized.scene,
      references: parsedReferences,
      assetSets: parsedAssetSets,
      whitebox: parsedWhitebox,
    },
    masterTake: {
      ...normalized.masterTake,
      id: masterTakeId,
      actorTracks: parsedActorTracks,
      cameraTrack: parsedCameraTrack,
      aerialCameraTrack: parsedAerialCameraTrack,
      beats: parsedBeats,
    },
  }
}

export function parseSpatialPrevisMetadata(
  metadata: unknown,
  expectedProjectId?: string,
): SpatialPrevisState | null {
  try {
    const root = record(metadata)
    const parsed = root ? state(root.spatialPrevis) : null
    return parsed && (expectedProjectId === undefined || parsed.projectId === expectedProjectId)
      ? parsed
      : null
  } catch {
    return null
  }
}

export function spatialPrevisMetadata(
  existingMetadata: unknown,
  spatialPrevis: SpatialPrevisState,
): MetadataRecord {
  const root = record(existingMetadata)
  return { ...(root ?? {}), spatialPrevis }
}
