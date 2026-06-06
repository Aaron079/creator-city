export type ShotSize = 'wide' | 'medium' | 'close' | 'extreme-close'
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

const SHOT_SIZE_LABELS: Record<ShotSize, string> = {
  wide: '全景',
  medium: '中景',
  close: '近景',
  'extreme-close': '特写',
}

export { SHOT_SIZE_LABELS }

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

// Filler pool for when source text is too short to fill requested shot count
const FILLER_POOL: Array<{ description: string; shotSize: ShotSize; hint: string }> = [
  { description: '建立场景环境，交代时间与地点', shotSize: 'wide', hint: '全景 / establishing shot，固定机位或缓慢推入' },
  { description: '主体人物或物品进入画面，展示关键行动', shotSize: 'medium', hint: '中景 / medium shot，跟随主体运动' },
  { description: '关键情节展开，叙事推进', shotSize: 'medium', hint: '中景 / action shot，稳定机位' },
  { description: '细节特写，强调关键物品或情感', shotSize: 'extreme-close', hint: '特写 / close-up，强调情感或细节' },
  { description: '人物情绪反应，内心世界呈现', shotSize: 'close', hint: '近景 / reaction shot' },
  { description: '场景过渡或环境切换', shotSize: 'wide', hint: '全景 / cutaway，场景过渡' },
  { description: '悬念或留白结尾，引发想象', shotSize: 'extreme-close', hint: '特写 / 悬念结尾，留白处理' },
]

function cleanChunk(text: string): string {
  return text
    .replace(/^[\s\d一二三四五六七八九十]+[、。.：:\-–—]/u, '')
    .trim()
}

function guessSize(text: string, index: number, total: number): ShotSize {
  const t = text.toLowerCase()
  if (/全景|wide|远景|环境|establishing/i.test(t)) return 'wide'
  if (/特写|close.?up|close|细节|表情|眼睛/i.test(t)) return 'extreme-close'
  if (/近景|近|detail/i.test(t)) return 'close'
  if (index === 0) return 'wide'
  if (index === total - 1) return 'extreme-close'
  return 'medium'
}

function applyStrategy(
  index: number,
  total: number,
  strategy: ShotListOptions['shotSizeStrategy'],
  text: string,
): ShotSize {
  // Keyword override always wins
  const t = text.toLowerCase()
  if (/全景|wide|远景|环境|establishing/i.test(t)) return 'wide'
  if (/特写|close.?up|细节|表情|眼睛/i.test(t)) return 'extreme-close'
  if (/近景|detail/i.test(t)) return 'close'

  switch (strategy) {
    case 'wide_to_close': {
      const ratio = index / Math.max(total - 1, 1)
      if (ratio < 0.25) return 'wide'
      if (ratio < 0.5) return 'medium'
      if (ratio < 0.75) return 'close'
      return 'extreme-close'
    }
    case 'close_heavy':
      if (index === 0) return 'wide'
      if (index === 1) return 'medium'
      return index % 2 === 0 ? 'extreme-close' : 'close'
    case 'wide_heavy':
      if (index >= total - 1) return 'extreme-close'
      return index < Math.ceil(total / 2) ? 'wide' : 'medium'
    default:
      return guessSize(text, index, total)
  }
}

function assignKind(index: number, total: number, mode: ShotListOptions['outputMode']): ShotKind {
  if (mode === 'image') return 'image'
  if (mode === 'video') return 'video'
  // mixed: establishing (first) and closing (last) → image; key middle shots → video
  if (total <= 2) return index === 0 ? 'image' : 'video'
  if (index === 0 || index === total - 1) return 'image'
  return index % 2 === 1 ? 'video' : 'image'
}

function assignDuration(pacing: ShotListOptions['pacing'], size: ShotSize): 5 | 10 {
  if (pacing === 'fast_social') return 5
  if (pacing === 'slow_cinematic') return size === 'wide' || size === 'extreme-close' ? 10 : 5
  return size === 'wide' ? 10 : 5
}

function guessCinematicNote(size: ShotSize): string {
  switch (size) {
    case 'wide': return '全景 / wide shot，交代环境'
    case 'medium': return '中景 / medium shot'
    case 'close': return '近景 / close shot'
    case 'extreme-close': return '特写 / close-up，强调细节或情感'
  }
}

function applyInstructionHints(instruction: string, opts: ShotListOptions): ShotListOptions {
  if (!instruction.trim()) return opts
  let { shotCount, pacing, shotSizeStrategy } = opts

  const countMatch = /(\d+)\s*(?:个|镜头?|shots?)/i.exec(instruction)
  if (countMatch?.[1]) {
    const n = parseInt(countMatch[1], 10)
    if (n >= 1 && n <= 12) shotCount = n
  }

  if (/快节奏|短视频|fast|social/i.test(instruction)) pacing = 'fast_social'
  else if (/慢节奏|电影感|cinematic|slow/i.test(instruction)) pacing = 'slow_cinematic'

  if (/多特写|大量特写/i.test(instruction)) shotSizeStrategy = 'close_heavy'
  else if (/多全景|大量全景/i.test(instruction)) shotSizeStrategy = 'wide_heavy'
  else if (/全景.{0,4}特写|wide.{0,4}close/i.test(instruction)) shotSizeStrategy = 'wide_to_close'

  return { ...opts, shotCount, pacing, shotSizeStrategy }
}

export function parseShotList(sourceText: string, rawOptions?: Partial<ShotListOptions>): ShotDraft[] {
  const baseOpts: ShotListOptions = { ...DEFAULT_SHOT_OPTIONS, ...rawOptions }
  const opts = baseOpts.userInstruction
    ? applyInstructionHints(baseOpts.userInstruction, baseOpts)
    : baseOpts

  const maxCount = Math.min(12, Math.max(1, opts.shotCount))
  const text = sourceText.trim()

  let chunks: string[] = []
  if (text) {
    chunks = text.split(/\n\s*\n/).map(cleanChunk).filter((c) => c.length >= 4)
    if (chunks.length < 2) {
      chunks = text.split(/\n/).map(cleanChunk).filter((c) => c.length >= 4)
    }
    if (chunks.length < 2) {
      chunks = text.split(/[。！？.!?]/).map(cleanChunk).filter((c) => c.length >= 4)
    }
  }

  // Trim to maxCount or pad with filler
  if (chunks.length > maxCount) {
    chunks = chunks.slice(0, maxCount)
  } else {
    let fi = 0
    while (chunks.length < maxCount) {
      const filler = FILLER_POOL[fi % FILLER_POOL.length]
      chunks.push(filler?.description ?? '补充镜头，根据导演要求调整')
      fi++
    }
  }

  const total = chunks.length
  const directorNote = opts.userInstruction?.trim()
    ? `\n[导演备注：${opts.userInstruction.slice(0, 80)}]`
    : ''

  return chunks.map((desc, i) => {
    const shotSize = applyStrategy(i, total, opts.shotSizeStrategy, desc)
    const kind = assignKind(i, total, opts.outputMode)
    const duration = assignDuration(opts.pacing, shotSize)
    const base = guessCinematicNote(shotSize)
    const cinematicNote = i === 0 && directorNote ? base + directorNote : base

    return {
      id: `shot-${i}`,
      kind,
      shotSize,
      description: desc.slice(0, 300),
      cinematicNote,
      duration,
      selected: true,
    }
  })
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
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
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
  shots.forEach((shot, i) => {
    lines.push(`镜头 ${i + 1}（${SHOT_SIZE_LABELS[shot.shotSize]} · ${shot.kind === 'video' ? `视频 ${shot.duration}s` : '图片'}）`)
    lines.push(`  画面描述：${shot.description}`)
    lines.push(`  镜头语言：${shot.cinematicNote}`)
    lines.push('')
  })
  lines.push('备注：本分镜清单由 Creator City Shot List Builder 生成，草案节点为 idle，不自动生成，不消耗 credits。')
  return lines.join('\n')
}
