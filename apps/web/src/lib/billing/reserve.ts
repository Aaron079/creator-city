import { creditRetiredError } from '@/lib/credits/retired'

export interface ReserveResult {
  jobId: string
  estimatedCredits: number
}

// Old callers fail explicitly; new generation uses administrator authorization.
export async function reserveCreditsForJob(_params: {
  userId: string
  estimatedCredits: number
  providerId: string
  nodeType: string
  prompt: string
  projectId?: string
  nodeId?: string
}): Promise<ReserveResult> {
  throw creditRetiredError()
}
