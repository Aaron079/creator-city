export type SeedanceEntitlement = 'standard' | 'long-take-beta'

export type SeedanceCapability = {
  providerId: 'volcengine-seedance-video'
  model: string
  entryPoint: 'ark'
  entitlement: SeedanceEntitlement
  maxSingleDurationSec: 30
  maxContinuousDurationSec: 30 | 180
  supports: {
    firstFrame: boolean
    finalFrame: boolean
    imageReferences: boolean
    videoReferences: boolean
    audioReferences: boolean
    continuation: boolean
    depth: boolean
    segmentation: boolean
    layout: boolean
  }
}

function isSeedance25Model(model: string) {
  const normalized = model.trim().toLowerCase().replace(/_/g, '-')
  return normalized === 'seedance-2.5' || /^dreamina-seedance-2-5(?:-|$)/.test(normalized)
}

export function resolveSeedanceCapability(input: {
  model: string
  entryPoint: 'ark'
  entitlement: SeedanceEntitlement
}): SeedanceCapability {
  const longTakeEnabled = isSeedance25Model(input.model)
    && input.entitlement === 'long-take-beta'

  return {
    providerId: 'volcengine-seedance-video',
    model: input.model,
    entryPoint: input.entryPoint,
    entitlement: input.entitlement,
    maxSingleDurationSec: 30,
    maxContinuousDurationSec: longTakeEnabled ? 180 : 30,
    supports: {
      firstFrame: true,
      finalFrame: false,
      imageReferences: true,
      videoReferences: true,
      audioReferences: true,
      continuation: true,
      depth: false,
      segmentation: false,
      layout: false,
    },
  }
}
