import type { ToolAdapter, ToolAdapterCapability, ToolAdapterTargetPanel } from '@/lib/adapters/types'

const TOOL_ADAPTERS: ToolAdapter[] = [
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    category: 'audio',
    providerType: 'api',
    status: 'experimental',
    supports: ['voice', 'music', 'sfx', 'dubbing', 'transcription'],
    targetPanels: ['audio-desk'],
  },
  {
    id: 'sync-so',
    name: 'Sync.so',
    category: 'lip-sync',
    providerType: 'api',
    status: 'experimental',
    supports: ['lipsync'],
    targetPanels: ['audio-desk'],
  },
  {
    id: 'otio',
    name: 'OTIO',
    category: 'timeline',
    providerType: 'export',
    status: 'available',
    supports: ['timeline-export', 'timeline-import'],
    targetPanels: ['editor-desk', 'delivery'],
  },
  {
    id: 'boords',
    name: 'Boords',
    category: 'storyboard',
    providerType: 'bridge',
    status: 'bridge-only',
    supports: ['storyboard-export', 'storyboard-import'],
    targetPanels: ['storyboard-previs'],
  },
  {
    id: 'world-creator-bridge',
    name: 'World Creator Bridge',
    category: 'environment',
    providerType: 'bridge',
    status: 'bridge-only',
    supports: ['environment-export'],
    targetPanels: ['scene-panel'],
  },
  {
    id: 'davinci-resolve-bridge',
    name: 'DaVinci Resolve Bridge',
    category: 'finishing',
    providerType: 'bridge',
    status: 'bridge-only',
    supports: ['timeline-export', 'finishing-export'],
    targetPanels: ['editor-desk', 'delivery', 'color-panel'],
  },
]

export function getAdapter(id: string) {
  return TOOL_ADAPTERS.find((adapter) => adapter.id === id) ?? null
}

export function getAdaptersByPanel(panel: ToolAdapterTargetPanel) {
  return TOOL_ADAPTERS.filter((adapter) => adapter.targetPanels.includes(panel))
}

export function getAdaptersByCapability(capability: ToolAdapterCapability) {
  return TOOL_ADAPTERS.filter((adapter) => adapter.supports.includes(capability))
}

export function getAllAdapters() {
  return TOOL_ADAPTERS
}

