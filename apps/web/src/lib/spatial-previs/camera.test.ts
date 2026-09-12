import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PerspectiveCamera, Vector3 } from 'three'
import {
  FOCAL_LENGTH_OPTIONS,
  cameraTargetFromPose,
  interpolateShortestAngle,
  isValidFocalLength,
  rotationFromTarget,
} from './camera'

test('uses the supported focal range and interpolates yaw across the shortest arc', () => {
  assert.deepEqual(FOCAL_LENGTH_OPTIONS, [8, 10, 12, 14, 16, 18, 20, 21, 24, 25, 28, 32, 35, 40, 45, 50, 65, 75, 85, 100, 135, 150, 180, 200, 300, 400, 600])
  assert.equal(isValidFocalLength(8), true)
  assert.equal(isValidFocalLength(600), true)
  assert.equal(isValidFocalLength(7.99), false)
  assert.equal(isValidFocalLength(600.01), false)
  assert.equal(isValidFocalLength(Number.POSITIVE_INFINITY), false)
  assert.ok(Math.abs(interpolateShortestAngle((350 * Math.PI) / 180, (10 * Math.PI) / 180, 0.5) - (2 * Math.PI)) < 1e-9)
})

test('uses Three camera minus Z as the zero-rotation forward direction without mutation', () => {
  const position = { x: 3, y: 4, z: 5 }
  const rotation = { pitch: 0, yaw: 0, roll: 0 }
  const source = structuredClone({ position, rotation })

  assert.deepEqual(cameraTargetFromPose(position, rotation, 2), { x: 3, y: 4, z: 3 })
  assert.deepEqual({ position, rotation }, source)
})

test('does not let roll rotate the camera forward direction', () => {
  const position = { x: 0, y: 0, z: 0 }
  const rotation = { pitch: 0, yaw: Math.PI / 2, roll: Math.PI / 2 }
  const source = structuredClone({ position, rotation })

  assert.deepEqual(cameraTargetFromPose(position, rotation, 1), { x: -1, y: 0, z: 0 })
  assert.deepEqual({ position, rotation }, source)
})

test('applies a stored YXZ camera pose including roll while keeping the focus target', async () => {
  const cameraMath = await import('./camera') as unknown as {
    applyCameraPose?: (camera: PerspectiveCamera, position: { x: number; y: number; z: number }, rotation: { pitch: number; yaw: number; roll: number }, focalLengthMm: number) => void
  }
  const position = { x: 2, y: 3, z: 8 }
  const target = { x: -1, y: 1, z: -2 }
  const rotation = { ...rotationFromTarget(position, target), roll: 0.7 }
  const camera = new PerspectiveCamera()

  assert.equal(typeof cameraMath.applyCameraPose, 'function')
  cameraMath.applyCameraPose!(camera, position, rotation, 50)

  const forward = camera.getWorldDirection(new Vector3())
  const expectedForward = new Vector3(target.x - position.x, target.y - position.y, target.z - position.z).normalize()
  assert.equal(camera.rotation.order, 'YXZ')
  assert.ok(Math.abs(camera.rotation.z - 0.7) < 1e-9)
  assert.ok(forward.distanceTo(expectedForward) < 1e-9)
})
