import { sampleActor, sampleCamera } from './sampler'
import type { ActorTrack, CameraTrack, SpatialPrevisState } from './types'

export const SPATIAL_PREVIS_TEST_DURATIONS = [5, 10] as const

export type SpatialPrevisTestDuration = typeof SPATIAL_PREVIS_TEST_DURATIONS[number]

function assertTestDuration(durationSec: number): asserts durationSec is SpatialPrevisTestDuration {
  if (!SPATIAL_PREVIS_TEST_DURATIONS.some((duration) => duration === durationSec)) {
    throw new TypeError('INVALID_SPATIAL_PREVIS_TEST_DURATION')
  }
}

function testSampleTimes(durationSec: SpatialPrevisTestDuration) {
  return [0, durationSec / 2, durationSec]
}

function sampledCameraTrack(track: CameraTrack, durationSec: SpatialPrevisTestDuration): CameraTrack {
  return {
    ...track,
    keyframes: testSampleTimes(durationSec).map((timeSec) => ({
      ...sampleCamera(track.keyframes, timeSec),
      id: `${track.id}@test-${timeSec}`,
      timeSec,
    })),
  }
}

function sampledActorTrack(track: ActorTrack, durationSec: SpatialPrevisTestDuration): ActorTrack {
  return {
    ...track,
    keyframes: testSampleTimes(durationSec).map((timeSec) => ({
      ...sampleActor(track, timeSec),
      id: `${track.id}@test-${timeSec}`,
      timeSec,
    })),
  }
}

export function createSpatialPrevisTestTake(
  state: SpatialPrevisState,
  durationSec: SpatialPrevisTestDuration,
): SpatialPrevisState {
  assertTestDuration(durationSec)
  if (durationSec > state.masterTake.durationSec) {
    throw new TypeError('SPATIAL_PREVIS_TEST_EXCEEDS_MASTER_TAKE')
  }

  return {
    ...state,
    masterTake: {
      ...state.masterTake,
      id: `${state.masterTake.id}@test-${durationSec}`,
      durationSec,
      cameraTrack: sampledCameraTrack(state.masterTake.cameraTrack, durationSec),
      aerialCameraTrack: sampledCameraTrack(state.masterTake.aerialCameraTrack, durationSec),
      actorTracks: state.masterTake.actorTracks.map((track) => sampledActorTrack(track, durationSec)),
      beats: [{ id: 'test-take', label: '预演测试', startSec: 0, endSec: durationSec }],
    },
  }
}

export function buildSpatialPrevisTestRequest(
  state: SpatialPrevisState,
  nodeId: string,
  durationSec: SpatialPrevisTestDuration,
) {
  assertTestDuration(durationSec)
  const referenceImages = state.scene.references
    .filter((reference) => reference.mediaType === 'image')
    .map((reference) => reference.url)
  const referenceVideos = state.scene.references
    .filter((reference) => reference.mediaType === 'video')
    .map((reference) => reference.url)

  return {
    nodeId,
    testDurationSec: durationSec,
    imageUrl: referenceImages[0],
    referenceImages,
    referenceVideos,
  }
}
