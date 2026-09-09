import type { SpatialPrevisState } from '../spatial-previs/types'
import type { SeedanceCapability } from './capabilities'

export type DeliveryMode = 'direct' | 'continuity-chain'

export type RequestedDerivativeKind = 'depth' | 'segmentation' | 'layout'

export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue }

export type RequestedDerivative = {
  readonly id: string
  readonly kind: RequestedDerivativeKind
  readonly value: JsonValue
}

export type UnsupportedControlWarning = {
  code: 'UNSUPPORTED_REQUESTED_CONTROL'
  controlId: string
  message: string
}

export type SeedanceTakePackage = {
  readonly kind: 'provider-neutral-take'
  readonly projectId: string
  readonly masterTakeId: string
  readonly durationSec: number
  readonly aspectRatio: SpatialPrevisState['masterTake']['aspectRatio']
  readonly deliveryMode: DeliveryMode
  readonly capability: Readonly<SeedanceCapability>
  readonly direction: string
  readonly controls: readonly RequestedDerivative[]
  readonly unsupportedControls: readonly RequestedDerivative[]
  readonly warnings: readonly UnsupportedControlWarning[]
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
  return value
}

function isJsonValue(value: unknown, ancestors = new WeakSet<object>()): value is JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false

  if (ancestors.has(value)) return false
  ancestors.add(value)
  if (Array.isArray(value)) {
    const valid = value.every((item) => isJsonValue(item, ancestors))
    ancestors.delete(value)
    return valid
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    ancestors.delete(value)
    return false
  }
  if (Reflect.ownKeys(value).length !== Object.keys(value).length) {
    ancestors.delete(value)
    return false
  }
  const valid = Object.values(value).every((item) => isJsonValue(item, ancestors))
  ancestors.delete(value)
  return valid
}

function cloneRequestedControls(controls: readonly RequestedDerivative[]): RequestedDerivative[] {
  if (!controls.every((control) => isJsonValue(control.value))) {
    throw new Error('UNSUPPORTED_REQUESTED_CONTROL_VALUE')
  }
  return structuredClone(controls) as RequestedDerivative[]
}

function buildDirection(previs: SpatialPrevisState) {
  const cameraDirection = previs.masterTake.cameraTrack.keyframes.map((keyframe) => (
    `${keyframe.timeSec}s camera ${keyframe.intent} at (${keyframe.position.x}, ${keyframe.position.y}, ${keyframe.position.z}) `
      + `toward (${keyframe.target.x}, ${keyframe.target.y}, ${keyframe.target.z}) with ${keyframe.focalLengthMm}mm`
  ))
  const actorDirection = previs.masterTake.actorTracks.flatMap((track) => track.keyframes.map((keyframe) => (
    `${keyframe.timeSec}s actor ${track.anchorId} ${keyframe.action} at (${keyframe.position.x}, ${keyframe.position.y}, ${keyframe.position.z})`
  )))

  return [...cameraDirection, ...actorDirection].join('; ')
}

export function buildSeedanceTakePackage(input: {
  previs: SpatialPrevisState
  capability: SeedanceCapability
  deliveryMode: DeliveryMode
  requestedControls?: readonly RequestedDerivative[]
}): SeedanceTakePackage {
  const requestedControls = cloneRequestedControls(input.requestedControls ?? [])
  const controls = requestedControls.filter((control) => input.capability.supports[control.kind])
  const unsupportedControls = requestedControls.filter((control) => !input.capability.supports[control.kind])

  return deepFreeze({
    kind: 'provider-neutral-take' as const,
    projectId: input.previs.projectId,
    masterTakeId: input.previs.masterTake.id,
    durationSec: input.previs.masterTake.durationSec,
    aspectRatio: input.previs.masterTake.aspectRatio,
    deliveryMode: input.deliveryMode,
    capability: structuredClone(input.capability),
    direction: buildDirection(input.previs),
    controls,
    unsupportedControls,
    warnings: unsupportedControls.map((control) => ({
      code: 'UNSUPPORTED_REQUESTED_CONTROL' as const,
      controlId: control.id,
      message: `Requested ${control.kind} control "${control.id}" is not supported by the active capability.`,
    })),
  })
}
