import {
  getAllToolProviders,
  type ToolProvider,
  type ToolProviderCategory,
  type ToolProviderStatus,
} from '@/lib/tools/provider-catalog'

export type {
  ToolProvider,
  ToolProviderCategory,
  ToolProviderStatus,
  ToolProviderTestMode,
  ToolProviderInput,
  ToolProviderOutput,
  ToolProviderRecommendation,
  ToolProviderType,
} from '@/lib/tools/provider-catalog'

export interface ToolProviderGroup {
  id: string
  title: string
  description: string
  entries: ToolProvider[]
}

export const TOOL_PROVIDER_GROUP_DESCRIPTIONS: Record<ToolProviderCategory, string> = {
  'image-to-video': '图像、首帧或参考图进入视频生成的候选 provider。',
  'text-to-script': '从文本 brief、创意方向或故事大纲生成剧本与分镜文本。',
  'text-to-image': '生成关键画面、概念图、海报或图片编辑候选 provider。',
  voice: '文本转语音、角色声音和旁白能力。',
  dubbing: '视频翻译、多语言配音和口型同步相关能力。',
  'audio-cleanup': '音频增强、降噪、人声分离和声音修复。',
  'music-ost': 'OST、主题曲、配乐和音乐草稿生成。',
  video: '通用视频处理能力。',
  agent: '创作流程中的 agent 状态展示；当前不标记真实可用。',
  skill: '创作 skill 状态展示；不触碰 skills 底层逻辑。',
}

export const EMPTY_PROVIDER_STATUS_COUNTS: Record<ToolProviderStatus, number> = {
  available: 0,
  mock: 0,
  'bridge-only': 0,
  'not-configured': 0,
  'coming-soon': 0,
  error: 0,
}

const TOOL_PROVIDER_DISPLAY_GROUPS: Array<{
  id: string
  title: string
  description: string
  categories: ToolProviderCategory[]
}> = [
  {
    id: 'image-to-video',
    title: '图生视频',
    description: TOOL_PROVIDER_GROUP_DESCRIPTIONS['image-to-video'],
    categories: ['image-to-video'],
  },
  {
    id: 'text-to-script',
    title: '文生剧本',
    description: TOOL_PROVIDER_GROUP_DESCRIPTIONS['text-to-script'],
    categories: ['text-to-script'],
  },
  {
    id: 'text-to-image',
    title: '文生图',
    description: TOOL_PROVIDER_GROUP_DESCRIPTIONS['text-to-image'],
    categories: ['text-to-image'],
  },
  {
    id: 'audio-voice',
    title: '配音 / 声音',
    description: '配音、视频翻译、声音增强、降噪和语音处理。',
    categories: ['voice', 'dubbing', 'audio-cleanup'],
  },
  {
    id: 'music-ost',
    title: 'OST / 音乐',
    description: TOOL_PROVIDER_GROUP_DESCRIPTIONS['music-ost'],
    categories: ['music-ost'],
  },
  {
    id: 'agent',
    title: 'Agents',
    description: TOOL_PROVIDER_GROUP_DESCRIPTIONS.agent,
    categories: ['agent'],
  },
  {
    id: 'skill',
    title: 'Skills',
    description: TOOL_PROVIDER_GROUP_DESCRIPTIONS.skill,
    categories: ['skill'],
  },
]

export function getToolProviderGroups(): ToolProviderGroup[] {
  const providers = getAllToolProviders()

  return TOOL_PROVIDER_DISPLAY_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    description: group.description,
    entries: providers.filter((provider) => group.categories.includes(provider.category)),
  })).filter((group) => group.entries.length > 0)
}

export function getToolProviderStatusCounts(providers: ToolProvider[] = getAllToolProviders()) {
  return providers.reduce<Record<ToolProviderStatus, number>>((acc, provider) => {
    acc[provider.status] = (acc[provider.status] ?? 0) + 1
    return acc
  }, { ...EMPTY_PROVIDER_STATUS_COUNTS })
}

export function getProviderTestLabel(provider: Pick<ToolProvider, 'status' | 'testMode'>) {
  if (provider.status === 'available' && provider.testMode === 'real') return '测试'
  if (provider.status === 'mock') return '模拟测试'
  if (provider.status === 'bridge-only') return '查看桥接格式'
  if (provider.status === 'not-configured') return '未配置'
  if (provider.status === 'coming-soon') return '即将支持'
  return '不可测试'
}
