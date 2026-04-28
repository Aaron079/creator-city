import { getToolProviderById, type ToolProviderNodeType } from '@/lib/tools/provider-catalog'

export interface GenerateWithProviderRequest {
  providerId: string
  nodeType: ToolProviderNodeType
  prompt: string
  inputAssets?: Array<{ id: string; type: string; url?: string }>
  params?: Record<string, string | number | boolean | undefined>
}

export interface GenerateWithProviderResult {
  success: boolean
  mode: 'real' | 'mock'
  resultPreview: string
  message: string
}

function trimPrompt(prompt: string) {
  const value = prompt.trim()
  return value.length > 0 ? value : '未填写 prompt'
}

function getTypeLabel(nodeType: ToolProviderNodeType) {
  if (nodeType === 'video') return '视频'
  if (nodeType === 'image') return '图片'
  if (nodeType === 'audio') return '音频'
  if (nodeType === 'music') return '音乐'
  return '文本'
}

export async function generateWithProvider({
  providerId,
  nodeType,
  prompt,
  params = {},
}: GenerateWithProviderRequest): Promise<GenerateWithProviderResult> {
  const provider = getToolProviderById(providerId)
  const providerName = provider?.name ?? providerId
  const mode: GenerateWithProviderResult['mode'] = provider?.status === 'available' ? 'real' : 'mock'

  if (mode === 'real') {
    return {
      success: false,
      mode: 'mock',
      resultPreview: `[mock] ${providerName} 暂未接入前端真实 adapter，已生成模拟${getTypeLabel(nodeType)}结果：${trimPrompt(prompt)}`,
      message: '真实 adapter 尚未在本轮启用，已安全回落到 mock。',
    }
  }

  const statusCopy = provider?.status === 'not-configured'
    ? '未配置，使用 mock'
    : provider?.status === 'bridge-only'
      ? '需桥接，使用 mock'
      : provider?.status === 'coming-soon'
        ? '即将接入，使用 mock'
        : '模拟生成'

  const ratioCopy = typeof params.ratio === 'string' ? ` · ${params.ratio}` : ''

  return {
    success: true,
    mode: 'mock',
    resultPreview: `[mock] ${providerName}${ratioCopy} · ${statusCopy}：${trimPrompt(prompt)}`,
    message: `${providerName} 当前没有真实 API 调用，本次为 mock 结果。`,
  }
}
