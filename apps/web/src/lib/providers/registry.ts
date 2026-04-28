// Server-only: do not import from client components.
import { openaiImagesAdapter, openaiTextAdapter } from '@/lib/providers/adapters/openai'
import { runwayAdapter } from '@/lib/providers/adapters/runway'
import { elevenlabsAdapter } from '@/lib/providers/adapters/elevenlabs'
import { genericHttpAdapter } from '@/lib/providers/adapters/generic-http'
import type { ProviderAdapter } from '@/lib/providers/types'

const ADAPTER_MAP: Record<string, ProviderAdapter> = {
  'openai-text': openaiTextAdapter,
  'openai-images': openaiImagesAdapter,
  runway: runwayAdapter,
  elevenlabs: elevenlabsAdapter,
  'generic-http': genericHttpAdapter,
}

export function getAdapter(adapterId: string): ProviderAdapter | null {
  return ADAPTER_MAP[adapterId] ?? null
}

export function listAdapterIds(): string[] {
  return Object.keys(ADAPTER_MAP)
}
