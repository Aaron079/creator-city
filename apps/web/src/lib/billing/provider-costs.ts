export interface ProviderCostInput {
  providerId: string
  jobType: string
  providerCostUsd?: number
  userChargedCredits: number
}

export function estimateProviderCostCny(providerCostUsd: number): number {
  return providerCostUsd * Number(process.env.USD_CNY_RATE ?? 7.2)
}

export function estimateMarginCredits(input: ProviderCostInput): number {
  const cny = estimateProviderCostCny(input.providerCostUsd ?? 0)
  const creditValue = Number(process.env.CREDIT_INTERNAL_CNY_VALUE ?? 0.05)
  return input.userChargedCredits - Math.ceil(cny / creditValue)
}
