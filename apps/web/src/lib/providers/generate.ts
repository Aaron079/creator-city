// Server-only shared generate helper used by all /api/generate/* routes.
import { getGatewayProvider } from '@/lib/providers/catalog'
import { getAdapter } from '@/lib/providers/registry'
import { checkEnvKeys } from '@/lib/providers/env'
import { PROVIDER_ERROR_CODES, ProviderError } from '@/lib/providers/errors'
import type { GenerateNodeType, GenerateRequest, GenerateResponse, ProviderAdapter } from '@/lib/providers/types'
import { getToolProviderById } from '@/lib/tools/provider-catalog'

function notConfiguredResponse(providerId: string, missing: string[], hint: string): GenerateResponse {
  return {
    success: false,
    providerId,
    mode: 'unavailable',
    status: 'not-configured',
    message: `Provider "${providerId}" is not configured. Missing: ${missing.join(', ')}. ${hint}`,
    errorCode: PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
  }
}

function mockResponse(request: GenerateRequest, reason: string): GenerateResponse {
  return {
    success: true,
    providerId: request.providerId,
    mode: 'mock',
    status: 'succeeded',
    result: {
      text: request.nodeType === 'text' ? `[mock] ${request.prompt}` : undefined,
      imageUrl: request.nodeType === 'image' ? undefined : undefined,
      previewUrl: undefined,
    },
    message: `[mock] ${request.providerId} · ${reason}: ${request.prompt}`,
  }
}

function callAdapterForNodeType(
  adapter: ProviderAdapter,
  nodeType: GenerateNodeType,
  request: GenerateRequest,
): Promise<GenerateResponse> {
  switch (nodeType) {
    case 'text': {
      if (!adapter.generateText) break
      return adapter.generateText(request)
    }
    case 'image': {
      if (!adapter.generateImage) break
      return adapter.generateImage(request)
    }
    case 'video': {
      if (!adapter.generateVideo) break
      return adapter.generateVideo(request)
    }
    case 'audio': {
      if (!adapter.generateAudio) break
      return adapter.generateAudio(request)
    }
    case 'music': {
      if (!adapter.generateMusic) break
      return adapter.generateMusic(request)
    }
  }
  return Promise.resolve({
    success: false,
    providerId: request.providerId,
    mode: 'unavailable' as const,
    status: 'failed' as const,
    message: `Adapter "${adapter.id}" does not support nodeType "${nodeType}".`,
    errorCode: PROVIDER_ERROR_CODES.ADAPTER_NOT_IMPLEMENTED,
  })
}

export async function runGenerate(request: GenerateRequest): Promise<GenerateResponse> {
  const { providerId, nodeType, prompt } = request

  if (!prompt?.trim()) {
    return {
      success: false,
      providerId,
      mode: 'unavailable',
      status: 'failed',
      message: 'Prompt is required.',
      errorCode: PROVIDER_ERROR_CODES.INVALID_INPUT,
    }
  }

  const toolProvider = getToolProviderById(providerId)
  const gatewayEntry = getGatewayProvider(providerId)

  // Provider not in catalog at all
  if (!toolProvider && !gatewayEntry) {
    return {
      success: false,
      providerId,
      mode: 'unavailable',
      status: 'failed',
      message: `Provider "${providerId}" not found.`,
      errorCode: PROVIDER_ERROR_CODES.PROVIDER_NOT_FOUND,
    }
  }

  // No gateway entry = no real adapter; only allow if catalog status is mock
  if (!gatewayEntry) {
    if (toolProvider?.status === 'mock') {
      return mockResponse(request, toolProvider.status)
    }
    return {
      success: false,
      providerId,
      mode: 'unavailable',
      status: 'not-configured',
      message: `Provider "${providerId}" does not have a gateway adapter. Status: ${toolProvider?.status ?? 'coming-soon'}. Configure it in /tools.`,
      errorCode: PROVIDER_ERROR_CODES.ADAPTER_NOT_IMPLEMENTED,
    }
  }

  // Check env vars
  const envCheck = checkEnvKeys(gatewayEntry.envKeys)
  if (!envCheck.configured) {
    return notConfiguredResponse(providerId, envCheck.missing, gatewayEntry.setupHint)
  }

  // Get adapter
  const adapter = getAdapter(gatewayEntry.adapterId)
  if (!adapter) {
    return {
      success: false,
      providerId,
      mode: 'unavailable',
      status: 'not-configured',
      message: `Adapter "${gatewayEntry.adapterId}" not registered.`,
      errorCode: PROVIDER_ERROR_CODES.ADAPTER_NOT_IMPLEMENTED,
    }
  }

  try {
    return await callAdapterForNodeType(adapter, nodeType, request)
  } catch (error) {
    if (error instanceof ProviderError) {
      return {
        success: false,
        providerId,
        mode: 'unavailable',
        status: 'failed',
        message: error.message,
        errorCode: error.code,
      }
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[generate] ${providerId}`, error)
    return {
      success: false,
      providerId,
      mode: 'unavailable',
      status: 'failed',
      message,
      errorCode: PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED,
    }
  }
}
