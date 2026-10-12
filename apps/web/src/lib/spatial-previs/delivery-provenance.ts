import type { SpatialPrevisState } from './types'
import type { StudioLight } from './studio-types'

// Optional metadata is readable on the published state without importing draft reconstruction tools.
type SceneProvenanceFields = {
  confirmedAt?: string
  geometry?: { result: { service: string; resultId: string; artifactId: string; sha256: string; manifestSha256: string } }
}
type LightProvenanceFields = { rig?: { id: string; assetId: string; assetVersion: number } }

type DeliveryCameraBinding =
  | { kind: 'master-plans'; trackIds: string[] }
  | { kind: 'program'; requestedTrackId: string | null; trackId: string | null; status: 'resolved' | 'unresolved' }

export function buildDeliveryProvenance(state: SpatialPrevisState) {
  const { masterTake, studio } = state
  const scene: SpatialPrevisState['scene'] & SceneProvenanceFields = state.scene
  const references = scene.references.map(reference => ({
    referenceId: reference.id,
    assetId: reference.assetId,
    source: reference.source,
    mediaType: reference.mediaType,
    contentVersion: null,
    status: 'unverified' as const,
  }))
  const referenceIds = new Set(references.map(reference => reference.referenceId))
  const assetSets = scene.assetSets.map(set => ({
    assetSetId: set.id,
    role: set.role,
    scope: 'scene' as const,
    referenceIds: [...set.referenceIds],
    unresolvedReferenceIds: set.referenceIds.filter(id => !referenceIds.has(id)),
  }))
  const cuts = studio?.programEnabled
    ? [...studio.cuts].filter(cut => cut.timeSec >= 0 && cut.timeSec < masterTake.durationSec)
      .sort((a, b) => a.timeSec - b.timeSec)
    : []
  const boundaries = [...new Set([0, ...cuts.map(cut => cut.timeSec)])]
  const shots = boundaries.map((startSec, index) => {
    const cut = cuts.filter(item => item.timeSec <= startSec).at(-1)
    let camera: DeliveryCameraBinding
    if (studio?.programEnabled) {
      // Match program preview before the first cut, but expose broken cut references.
      const requestedTrackId = cut?.cameraId ?? studio.cameras[0]?.track.id ?? null
      const track = studio.cameras.find(item => item.track.id === requestedTrackId)?.track
      camera = { kind: 'program', requestedTrackId, trackId: track?.id ?? null, status: track ? 'resolved' : 'unresolved' }
    } else {
      // The editor's temporary director/aerial selection is not a persisted export choice.
      camera = { kind: 'master-plans', trackIds: [masterTake.cameraTrack.id, masterTake.aerialCameraTrack.id] }
    }
    return {
      id: `${masterTake.id}:${cut ? `cut:${cut.id}` : 'start'}`,
      startSec,
      endSec: boundaries[index + 1] ?? masterTake.durationSec,
      sourceCutId: cut?.id ?? null,
      camera,
      assetSetIds: assetSets.map(set => set.assetSetId),
      referenceIds: [...referenceIds],
    }
  })
  const lightingRigs: { id: string; assetId: string; assetVersion: number; lightIds: string[] }[] = []
  const lights: (StudioLight & LightProvenanceFields)[] = studio?.lighting.lights ?? []
  for (const light of lights) {
    if (!light.rig) continue
    const { id, assetId, assetVersion } = light.rig
    const existing = lightingRigs.find(rig => rig.id === id && rig.assetId === assetId && rig.assetVersion === assetVersion)
    if (existing) existing.lightIds.push(light.id)
    else lightingRigs.push({ id, assetId, assetVersion, lightIds: [light.id] })
  }
  const result = scene.geometry?.result
  return {
    version: 1 as const,
    sceneConfirmedAt: scene.confirmedAt ?? null,
    references,
    assetSets,
    actors: masterTake.actorTracks.map(track => ({
      trackId: track.id, anchorId: track.anchorId, assetBinding: 'unresolved' as const,
    })),
    shots,
    lightingRigs,
    geometry: result ? {
      service: result.service,
      resultId: result.resultId,
      artifactId: result.artifactId,
      sha256: result.sha256,
      manifestSha256: result.manifestSha256,
    } : null,
  }
}
