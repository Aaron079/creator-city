import type { PublicTemplateNodeType } from './public-template-categories'

export type PublicTemplateSourceType = 'creator-city' | 'public-reference' | 'open-license' | 'community'

export type PublicTemplateLicenseType =
  | 'original'
  | 'pexels'
  | 'pixabay'
  | 'cc0'
  | 'cc-by'
  | 'public-domain'
  | 'reference-only'
  | 'needs-review'

export interface PublicTemplateLicense {
  type: PublicTemplateLicenseType
  label: string
  attribution?: string
  usageNote: string
}

export interface PublicTemplateThumbnail {
  type: 'remote' | 'gradient' | 'local' | 'placeholder'
  url?: string
  gradientFrom?: string
  gradientTo?: string
  localAssetPath?: string
  alt: string
}

export interface PublicTemplatePreview {
  type: 'remote-video' | 'placeholder-video' | 'none'
  url?: string
  poster?: string
  licenseType?: PublicTemplateLicenseType | string
  attribution?: string
}

export type PublicTemplateWorkflowNodeType = 'text' | 'image' | 'video' | 'audio'

export interface PublicTemplateWorkflowNode {
  id: string
  type: PublicTemplateWorkflowNodeType
  title: string
  prompt: string
  resultPreview?: string
  x: number
  y: number
  width?: number
  height?: number
}

export interface PublicTemplateWorkflowEdge {
  from: string
  to: string
}

export interface PublicTemplateNodeGraph {
  nodes: PublicTemplateWorkflowNode[]
  edges: PublicTemplateWorkflowEdge[]
}

export const ORIGINAL_TEMPLATE_LICENSE: PublicTemplateLicense = {
  type: 'original',
  label: 'Creator City Original',
  usageNote: 'Creator City 原创结构模板；封面与预览为本地占位，不包含第三方图片或视频资产。',
}

export const REFERENCE_ONLY_TEMPLATE_LICENSE: PublicTemplateLicense = {
  type: 'reference-only',
  label: 'Reference only',
  usageNote: '外部来源仅作创作结构参考；不复制、下载、内嵌或 hotlink 第三方受版权保护素材，使用外部素材前请自行确认授权。',
}

export const PEXELS_TEMPLATE_LICENSE: PublicTemplateLicense = {
  type: 'pexels',
  label: 'Pexels License',
  usageNote: '通过 Pexels API 返回并展示来源链接；请遵守 Pexels License，不将素材作为独立图库或未加工素材分发。',
}

export const PIXABAY_TEMPLATE_LICENSE: PublicTemplateLicense = {
  type: 'pixabay',
  label: 'Pixabay Content License',
  usageNote: '通过 Pixabay API 返回并展示来源链接；请遵守 Pixabay Content License，不将素材作为独立素材集合分发。',
}

export function buildTemplateNodeGraph(input: {
  title: string
  category: string
  description: string
  promptStarter: string
  workflowSteps: string[]
  nodeType: PublicTemplateNodeType
  aspectRatio: string
}): PublicTemplateNodeGraph {
  const stepCopy = input.workflowSteps.slice(0, 5).join(' -> ')
  const outputType: PublicTemplateWorkflowNodeType = input.nodeType === 'mixed' ? 'video' : input.nodeType

  return {
    nodes: [
      {
        id: 'brief',
        type: 'text',
        title: `${input.title} · Brief`,
        prompt: [
          input.promptStarter,
          `分类：${input.category}`,
          `比例：${input.aspectRatio}`,
          `工作流：${stepCopy}`,
        ].join('\n'),
        resultPreview: `${input.description}\n\n下一步：按模板工作流生成可编辑创作节点。`,
        x: 0,
        y: 0,
      },
      {
        id: 'result',
        type: outputType,
        title: `${input.title} · Result`,
        prompt: `${input.promptStarter}\n\n请根据 Brief 输出第一版 ${input.aspectRatio} 创作结果，并保留可继续编辑的镜头、字幕和素材占位。`,
        resultPreview: `模板结果占位 · ${input.title}\n${stepCopy}\n未内嵌第三方素材，可继续生成或替换为已授权资产。`,
        x: 440,
        y: 20,
      },
    ],
    edges: [
      {
        from: 'brief',
        to: 'result',
      },
    ],
  }
}
