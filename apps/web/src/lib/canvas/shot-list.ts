export type ShotSize = 'wide' | 'full' | 'medium' | 'close' | 'extreme-close'
export type ShotKind = 'image' | 'video'

export interface ShotDraft {
  id: string
  kind: ShotKind
  shotSize: ShotSize
  description: string
  cinematicNote: string
  duration: 5 | 10
  selected: boolean
}

export type ShotListOptions = {
  shotCount: number
  outputMode: 'image' | 'video' | 'mixed'
  pacing: 'slow_cinematic' | 'standard' | 'fast_social'
  shotSizeStrategy: 'auto' | 'wide_to_close' | 'close_heavy' | 'wide_heavy'
  userInstruction?: string
}

export const DEFAULT_SHOT_OPTIONS: ShotListOptions = {
  shotCount: 5,
  outputMode: 'mixed',
  pacing: 'standard',
  shotSizeStrategy: 'auto',
  userInstruction: '',
}

export const SHOT_SIZE_LABELS: Record<ShotSize, string> = {
  wide: '全景',
  full: '全身',
  medium: '中景',
  close: '近景',
  'extreme-close': '特写',
}

export const OUTPUT_MODE_LABELS: Record<ShotListOptions['outputMode'], string> = {
  image: '图片分镜',
  video: '视频分镜',
  mixed: '图片+视频混合',
}

export const PACING_LABELS: Record<ShotListOptions['pacing'], string> = {
  slow_cinematic: '慢节奏电影感',
  standard: '标准叙事',
  fast_social: '短视频快节奏',
}

export const STRATEGY_LABELS: Record<ShotListOptions['shotSizeStrategy'], string> = {
  auto: '自动景别',
  wide_to_close: '全景→特写',
  close_heavy: '多特写',
  wide_heavy: '多全景',
}

export function buildShotListReport(
  shots: ShotDraft[],
  sourceTitle: string,
  options?: Partial<ShotListOptions>,
  sourceTextSummary?: string,
): string {
  const opts: ShotListOptions = { ...DEFAULT_SHOT_OPTIONS, ...options }
  const lines = [
    `=== 分镜清单 — ${sourceTitle} ===`,
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    `拆分设置：${shots.length}镜 · ${OUTPUT_MODE_LABELS[opts.outputMode]} · ${PACING_LABELS[opts.pacing]} · ${STRATEGY_LABELS[opts.shotSizeStrategy]}`,
  ]
  if (sourceTextSummary?.trim()) {
    const preview = sourceTextSummary.trim()
    lines.push(`来源文本：${preview.slice(0, 200)}${preview.length > 200 ? '…' : ''}`)
  }
  if (opts.userInstruction?.trim()) {
    lines.push(`导演补充要求：${opts.userInstruction}`)
  }
  lines.push('')
  shots.forEach((shot, index) => {
    lines.push(`镜头 ${index + 1}（${SHOT_SIZE_LABELS[shot.shotSize]} · ${shot.kind === 'video' ? `视频 ${shot.duration}s` : '图片'}）`)
    lines.push(`  画面描述：${shot.description}`)
    lines.push(`  镜头语言：${shot.cinematicNote}`)
    lines.push('')
  })
  lines.push('备注：清单只包含已批准镜头；草案节点保持 idle，不会自动生成。')
  return lines.join('\n')
}
