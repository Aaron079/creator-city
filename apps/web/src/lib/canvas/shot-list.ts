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

const SHOT_SIZE_LABELS: Record<ShotSize, string> = {
  wide: '全景',
  medium: '中景',
  close: '近景',
  'extreme-close': '特写',
}

export { SHOT_SIZE_LABELS }

const DEFAULT_SHOTS: Array<{ description: string; shotSize: ShotSize; cinematicNote: string }> = [
  {
    description: '建立环境镜头，交代时间、地点和整体氛围',
    shotSize: 'wide',
    cinematicNote: '全景 / establishing shot，固定机位或缓慢推入',
  },
  {
    description: '主体行动镜头，展示角色或物体的主要动作',
    shotSize: 'medium',
    cinematicNote: '中景 / medium shot，跟随主体运动',
  },
  {
    description: '情绪细节镜头，捕捉表情、道具或关键细节',
    shotSize: 'extreme-close',
    cinematicNote: '特写 / close-up，强调情感或细节',
  },
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

function guessCinematicNote(size: ShotSize): string {
  switch (size) {
    case 'wide': return '全景 / wide shot，交代环境'
    case 'medium': return '中景 / medium shot'
    case 'close': return '近景 / close shot'
    case 'extreme-close': return '特写 / close-up，强调细节或情感'
  }
}

export function parseShotList(sourceText: string): ShotDraft[] {
  const text = sourceText.trim()
  if (!text) return buildDefaultShots()

  let chunks: string[] = []

  // Try paragraph splits first
  chunks = text.split(/\n\s*\n/).map(cleanChunk).filter((c) => c.length >= 6)

  // Fall back to line splits
  if (chunks.length < 2) {
    chunks = text.split(/\n/).map(cleanChunk).filter((c) => c.length >= 6)
  }

  // Fall back to sentence splits
  if (chunks.length < 2) {
    chunks = text.split(/[。！？.!?]/).map(cleanChunk).filter((c) => c.length >= 6)
  }

  // Trim to 8
  chunks = chunks.slice(0, 8)

  if (chunks.length < 3) {
    return buildDefaultShots()
  }

  return chunks.map((desc, i) => {
    const size = guessSize(desc, i, chunks.length)
    return {
      id: `shot-${i}`,
      kind: 'image' as ShotKind,
      shotSize: size,
      description: desc.slice(0, 300),
      cinematicNote: guessCinematicNote(size),
      duration: 5 as const,
      selected: true,
    }
  })
}

function buildDefaultShots(): ShotDraft[] {
  return DEFAULT_SHOTS.map((s, i) => ({
    id: `shot-default-${i}`,
    kind: 'image' as ShotKind,
    shotSize: s.shotSize,
    description: s.description,
    cinematicNote: s.cinematicNote,
    duration: 5 as const,
    selected: true,
  }))
}

export function buildShotListReport(shots: ShotDraft[], sourceTitle: string): string {
  const lines = [
    `=== 分镜清单 — ${sourceTitle} ===`,
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    '',
  ]
  shots.forEach((shot, i) => {
    lines.push(`镜头 ${i + 1}（${SHOT_SIZE_LABELS[shot.shotSize]} · ${shot.kind === 'video' ? `视频 ${shot.duration}s` : '图片'}）`)
    lines.push(`  画面描述：${shot.description}`)
    lines.push(`  镜头语言：${shot.cinematicNote}`)
    lines.push('')
  })
  lines.push('备注：本分镜清单由 Creator City Shot List Builder 生成，草案节点为 idle，不自动生成，不消耗 credits。')
  return lines.join('\n')
}
