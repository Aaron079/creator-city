import {
  PROVIDER_CATEGORY_LABELS,
  PROVIDER_CATEGORY_ORDER,
  getAllToolProviders,
  type ToolProvider,
  type ToolProviderCategory,
  type ToolProviderNodeType,
  type ToolProviderStatus,
} from '@/lib/tools/provider-catalog'

export type {
  ToolProvider,
  ToolProviderBadge,
  ToolProviderCategory,
  ToolProviderNodeType,
  ToolProviderRecommendation,
  ToolProviderStatus,
} from '@/lib/tools/provider-catalog'

export interface ToolProviderGroup {
  id: ToolProviderCategory
  title: string
  description: string
  entries: ToolProvider[]
}

export const TOOL_PROVIDER_GROUP_DESCRIPTIONS: Record<ToolProviderCategory, string> = {
  'video-generation': '视频生成模型目录。未配置真实 adapter 和 key 时不会伪装为可用。',
  'image-generation': '图片生成和图片编辑模型目录。',
  'text-script': '文本、剧本、分镜和创意写作模型目录。',
  'voice-dubbing': '声音、配音、翻译和音频处理工具目录。',
  'music-ost': '音乐、OST、主题曲和配乐生成工具目录。',
}

export const EMPTY_PROVIDER_STATUS_COUNTS: Record<ToolProviderStatus, number> = {
  available: 0,
  mock: 0,
  'bridge-only': 0,
  'not-configured': 0,
  'coming-soon': 0,
}

export const NODE_TYPE_LABELS: Record<ToolProviderNodeType, string> = {
  text: 'Text',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  music: 'Music',
}

export function getToolProviderGroups(): ToolProviderGroup[] {
  const providers = getAllToolProviders()

  return PROVIDER_CATEGORY_ORDER.map((category) => ({
    id: category,
    title: PROVIDER_CATEGORY_LABELS[category],
    description: TOOL_PROVIDER_GROUP_DESCRIPTIONS[category],
    entries: providers.filter((provider) => provider.category === category),
  })).filter((group) => group.entries.length > 0)
}

export function getToolProviderStatusCounts(providers: ToolProvider[] = getAllToolProviders()) {
  return providers.reduce<Record<ToolProviderStatus, number>>((acc, provider) => {
    acc[provider.status] = (acc[provider.status] ?? 0) + 1
    return acc
  }, { ...EMPTY_PROVIDER_STATUS_COUNTS })
}

export function getProviderActionLabel(provider: Pick<ToolProvider, 'status'>) {
  if (provider.status === 'available') return '真实可用'
  if (provider.status === 'mock') return '模拟生成'
  if (provider.status === 'bridge-only') return '需桥接'
  if (provider.status === 'not-configured') return '未配置'
  return '即将接入'
}

export function getProviderStatusLabel(status: ToolProviderStatus) {
  if (status === 'available') return '可用'
  if (status === 'mock') return '模拟'
  if (status === 'bridge-only') return '需桥接'
  if (status === 'not-configured') return '未配置'
  return '即将接入'
}
