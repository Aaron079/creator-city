export class InsufficientCreditsError extends Error {
  constructor(
    public readonly requiredCredits: number,
    public readonly availableCredits: number,
  ) {
    super(`积分不足，需要 ${requiredCredits}，当前可用 ${availableCredits}`)
    this.name = 'InsufficientCreditsError'
  }
}

export class BillingJobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`Billing job not found: ${jobId}`)
    this.name = 'BillingJobNotFoundError'
  }
}
