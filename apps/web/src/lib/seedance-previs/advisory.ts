import type { SeedanceCapability } from './capabilities'
import type { DeliveryMode } from './package'

export type SeedanceDeliveryAdvisory = {
  readonly id: string
  readonly code: string
  readonly severity: 'advisory'
  readonly blocking: false
  readonly message: string
  readonly remedy: string
}

export type SeedanceDeliveryAdvice = {
  readonly recommendedMode: DeliveryMode
  readonly findings: readonly SeedanceDeliveryAdvisory[]
}

export function adviseSeedanceDelivery(input: {
  requestedDurationSec: number
  capability: SeedanceCapability
  coverageFindings: readonly SeedanceDeliveryAdvisory[]
}): SeedanceDeliveryAdvice {
  const needsContinuityChain = input.requestedDurationSec > input.capability.maxSingleDurationSec
    && input.requestedDurationSec > input.capability.maxContinuousDurationSec
  const continuityFinding: SeedanceDeliveryAdvisory | null = needsContinuityChain
    ? {
      id: 'continuity-chain-recommended',
      code: 'CONTINUITY_CHAIN_RECOMMENDED',
      severity: 'advisory',
      blocking: false,
      message: `The requested ${input.requestedDurationSec}-second take exceeds the active direct delivery duration.`,
      remedy: 'Confirm the 30-second continuity chain, or continue with direct generation.',
    }
    : null

  return {
    recommendedMode: needsContinuityChain ? 'continuity-chain' : 'direct',
    findings: continuityFinding
      ? [...input.coverageFindings, continuityFinding]
      : [...input.coverageFindings],
  }
}
