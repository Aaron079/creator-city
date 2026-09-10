import { normalizeSpatialPrevis } from './normalize'
import { isRenderableMediaUrl } from '../media/renderable-url'
import type {
  ActorKeyframe,
  ActorTrack,
  CameraKeyframe,
  CameraTrack,
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
const REFERENCE_MEDIA_TYPES = new Set(['image', 'video'])
const REFERENCE_SOURCES = new Set(['project', 'library', 'upload'])
const WHITEBOX_ENTITY_KINDS = new Set(['floor', 'wall', 'opening', 'volume', 'furniture', 'referencePlane'])
const MIDPOINT_EPSILON = 1e-6
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
  for (const candidate of value) {
    const reference = record(candidate)
    if (!reference) return null
    const id = string(reference.id)
    const assetId = string(reference.assetId)
    const title = string(reference.title)
    const url = string(reference.url)
    if (
      !id
      || !assetId
      || !title
      || !url
      || !isRenderableMediaUrl(url).ok
      || !REFERENCE_MEDIA_TYPES.has(reference.mediaType as string)
      || !REFERENCE_SOURCES.has(reference.source as string)
    ) {
      return null
    }
    items.push({
      id,
      assetId,
      title,
      mediaType: reference.mediaType as SpatialSceneReference['mediaType'],
      url,
      source: reference.source as SpatialSceneReference['source'],
    })
  }
  return items
}

function whitebox(value: unknown): { entities: WhiteboxEntity[] } | null {
  const item = record(value)
  if (!item || !Array.isArray(item.entities)) return null
  const entities: WhiteboxEntity[] = []
  for (const candidate of item.entities) {
    const entity = record(candidate)
    if (!entity || !Array.isArray(entity.sourceAssetIds)) return null
    const id = string(entity.id)
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
      || !position
      || rotationY === null
      || !size
      || !WHITEBOX_ENTITY_KINDS.has(entity.kind as string)
      || sourceAssetIds.length === 0
    ) {
      return null
    }
    entities.push({
      id,
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

function cameraTrack(value: unknown): CameraTrack | null {
  const item = record(value)
  if (!item || !Array.isArray(item.keyframes)) return null
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
    keyframes.push({
      id: keyframeId,
      timeSec,
      position,
      target,
      focalLengthMm,
      intent: keyframe.intent as CameraKeyframe['intent'],
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
  actorTracks: ActorTrack[],
  beats: SpatialPrevisBeat[],
  durationSec: number,
) {
  if (
    durationSec < MIN_DURATION_SEC
    || durationSec > MAX_DURATION_SEC
    || cameraTrack.keyframes.length === 0
    || cameraTrack.keyframes.some((keyframe) => keyframe.timeSec < 0 || keyframe.timeSec > durationSec)
    || actorTracks.some((track) => track.keyframes.some(
      (keyframe) => keyframe.timeSec < 0 || keyframe.timeSec > durationSec,
    ))
  ) {
    return false
  }

  return beats.every((beat) => {
    if (
      beat.startSec < 0
      || beat.startSec > beat.endSec
      || beat.endSec > durationSec
    ) {
      return false
    }
    const midpoint = (beat.startSec + beat.endSec) / 2
    return cameraTrack.keyframes.filter(
      (keyframe) => Math.abs(keyframe.timeSec - midpoint) <= MIDPOINT_EPSILON,
    ).length === 1
  })
}

function state(value: unknown): SpatialPrevisState | null {
  const candidate = record(value)
  if (!candidate || (candidate.version !== 1 && candidate.version !== 2)) return null
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

  const parsedActorTracks = actorTracks(masterTake.actorTracks)
  const parsedCameraTrack = cameraTrack(masterTake.cameraTrack)
  const parsedBeats = beats(masterTake.beats)
  const parsedReferences = candidate.version === 1 ? [] : references(scene.references)
  const parsedWhitebox = candidate.version === 1 ? { entities: [] } : whitebox(scene.whitebox)
  if (
    !coverageMatches(scene.coverage, normalized.scene.coverage)
    || !parsedActorTracks
    || !parsedCameraTrack
    || !parsedBeats
    || !parsedReferences
    || !parsedWhitebox
    || !timelineIsExecutable(parsedCameraTrack, parsedActorTracks, parsedBeats, durationSec)
  ) {
    return null
  }

  return {
    ...normalized,
    scene: {
      ...normalized.scene,
      references: parsedReferences,
      whitebox: parsedWhitebox,
    },
    masterTake: {
      ...normalized.masterTake,
      id: masterTakeId,
      actorTracks: parsedActorTracks,
      cameraTrack: parsedCameraTrack,
      beats: parsedBeats,
    },
  }
}

export function parseSpatialPrevisMetadata(metadata: unknown): SpatialPrevisState | null {
  try {
    const root = record(metadata)
    return root ? state(root.spatialPrevis) : null
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
