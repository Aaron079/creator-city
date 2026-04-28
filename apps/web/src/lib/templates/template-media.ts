import type { PublicTemplate } from './public-template-catalog'

export function getTemplateFallbackGradient(template: PublicTemplate) {
  return {
    from: template.thumbnail.gradientFrom ?? '#101827',
    to: template.thumbnail.gradientTo ?? '#2f7ddf',
  }
}

export function isRemoteTemplateThumbnail(template: PublicTemplate) {
  return template.thumbnail.type === 'remote' && Boolean(template.thumbnail.url)
}

export function getTemplatePreviewLabel(template: PublicTemplate) {
  if (template.preview.type === 'remote-video') return '参考预览'
  if (template.preview.type === 'placeholder-video') return '合法占位'
  return '无预览'
}
