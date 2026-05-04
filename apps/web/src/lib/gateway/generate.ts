// Provider Gateway — thin wrapper around runGenerate that records cost after a successful generation.
import { runGenerate } from '@/lib/providers/generate'
import type { GenerateRequest, GenerateResponse } from '@/lib/providers/types'
import { recordProviderCost } from './cost-recorder'
import { toCanonicalGatewayId } from './accounts'

export async function gatewayGenerate(
  request: GenerateRequest,
  userId?: string,
): Promise<GenerateResponse> {
  const response = await runGenerate(request)

  if (response.success) {
    const canonicalId = toCanonicalGatewayId(request.providerId)
    recordProviderCost({
      userId,
      generationJobId: response.jobId,
      providerId: canonicalId,
      model: request.params?.model as string | undefined,
      nodeType: request.nodeType,
    }).catch((err: unknown) => {
      console.error('[gateway] cost-recorder failed (non-fatal):', err)
    })
  }

  return response
}
