import type { PerspectiveCamera } from 'three'
import type { CameraRotation, CameraTrack, MasterTake, SpatialPrevisCameraMode, Vec3 } from './types'

export const FOCAL_LENGTH_OPTIONS = [8, 10, 12, 14, 16, 18, 20, 21, 24, 25, 28, 32, 35, 40, 45, 50, 65, 75, 85, 100, 135, 150, 180, 200, 300, 400, 600] as const
const MIN_FOCAL_LENGTH = FOCAL_LENGTH_OPTIONS[0]
const MAX_FOCAL_LENGTH = FOCAL_LENGTH_OPTIONS.at(-1)!

export function isValidFocalLength(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_FOCAL_LENGTH && value <= MAX_FOCAL_LENGTH
}

export function clampFocalLength(value: number): number {
  return Math.min(MAX_FOCAL_LENGTH, Math.max(MIN_FOCAL_LENGTH, value))
}

export function cameraTrackForMode(masterTake: MasterTake, mode: SpatialPrevisCameraMode): CameraTrack {
  return mode === 'director' ? masterTake.cameraTrack : masterTake.aerialCameraTrack
}

export function rotationFromTarget(position: Vec3, target: Vec3): CameraRotation {
  const x = target.x - position.x
  const y = target.y - position.y
  const z = target.z - position.z
  const distance = Math.hypot(x, y, z)
  if (distance === 0) return { pitch: 0, yaw: 0, roll: 0 }

  return {
    pitch: Math.asin(y / distance),
    yaw: Math.atan2(-x, -z),
    roll: 0,
  }
}

export function cameraTargetFromPose(position: Vec3, rotation: CameraRotation, distance: number): Vec3 {
  const cosPitch = Math.cos(rotation.pitch)
  const sinPitch = Math.sin(rotation.pitch)
  const cosYaw = Math.cos(rotation.yaw)
  const sinYaw = Math.sin(rotation.yaw)
  const zeroNear = (value: number) => Math.abs(value) < 1e-12 ? 0 : value

  return {
    x: position.x + distance * zeroNear(-sinYaw * cosPitch),
    y: position.y + distance * zeroNear(sinPitch),
    z: position.z + distance * zeroNear(-cosYaw * cosPitch),
  }
}

export function applyCameraPose(camera: PerspectiveCamera, position: Vec3, rotation: CameraRotation, focalLengthMm: number) {
  camera.position.set(position.x, position.y, position.z)
  camera.rotation.order = 'YXZ'
  camera.rotation.set(rotation.pitch, rotation.yaw, rotation.roll)
  camera.setFocalLength(focalLengthMm)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
}

export function interpolateShortestAngle(start: number, end: number, progress: number): number {
  const delta = Math.atan2(Math.sin(end - start), Math.cos(end - start))
  return start + delta * progress
}
