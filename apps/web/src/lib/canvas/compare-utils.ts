import type { VisualCanvasNode } from '@/components/create/CanvasNodeCard'

const PORTRAIT_RE = /人物|角色|人像|girl|boy|man|woman|person|portrait|face|character|child/i
const SHOT_RE = /远景|中景|近景|特写|全景|仰拍|俯拍|tracking|dolly|zoom|pan|tilt|aerial|wide\s*shot|close.up/i
const LIGHT_RE = /光线|自然光|暖光|冷光|夕阳|日光|golden\s*hour|natural\s*light|cinematic\s*light|dramatic\s*light/i
const EMOTION_RE = /忧郁|快乐|悲伤|热情|平静|紧张|活力|mysterious|joyful|sad|peaceful|dramatic|serene|energetic/i

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[\s,，、；;。.!！？?\-–—]+/)
      .filter((w) => w.length >= 3)
      .slice(0, 200),
  )
}

function setDiff<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((x) => !b.has(x)))
}

export interface PromptDiff {
  aLength: number
  bLength: number
  aOnlyKeywords: string[]
  bOnlyKeywords: string[]
  aHasPortrait: boolean
  bHasPortrait: boolean
  aHasShot: boolean
  bHasShot: boolean
  aHasLight: boolean
  bHasLight: boolean
  aHasEmotion: boolean
  bHasEmotion: boolean
}

export function analyzePromptDiff(promptA: string, promptB: string): PromptDiff {
  const tokensA = tokenize(promptA)
  const tokensB = tokenize(promptB)
  return {
    aLength: promptA.length,
    bLength: promptB.length,
    aOnlyKeywords: [...setDiff(tokensA, tokensB)].slice(0, 6),
    bOnlyKeywords: [...setDiff(tokensB, tokensA)].slice(0, 6),
    aHasPortrait: PORTRAIT_RE.test(promptA),
    bHasPortrait: PORTRAIT_RE.test(promptB),
    aHasShot: SHOT_RE.test(promptA),
    bHasShot: SHOT_RE.test(promptB),
    aHasLight: LIGHT_RE.test(promptA),
    bHasLight: LIGHT_RE.test(promptB),
    aHasEmotion: EMOTION_RE.test(promptA),
    bHasEmotion: EMOTION_RE.test(promptB),
  }
}

export function buildCompareReport(
  nodeA: VisualCanvasNode,
  nodeB: VisualCanvasNode,
  winner: 'A' | 'B' | null,
  diff: PromptDiff,
): string {
  const lines: string[] = [
    '=== Creator City 版本对比报告 ===',
    '',
    `版本 A：${nodeA.title || '未命名'} (${nodeA.kind} · ${nodeA.status})`,
    nodeA.prompt
      ? `  Prompt: ${nodeA.prompt.slice(0, 100)}${nodeA.prompt.length > 100 ? '…' : ''}`
      : '  Prompt: (无)',
    `  资产 ID: ${nodeA.assetId ? '已绑定' : '未绑定'}`,
    '',
    `版本 B：${nodeB.title || '未命名'} (${nodeB.kind} · ${nodeB.status})`,
    nodeB.prompt
      ? `  Prompt: ${nodeB.prompt.slice(0, 100)}${nodeB.prompt.length > 100 ? '…' : ''}`
      : '  Prompt: (无)',
    `  资产 ID: ${nodeB.assetId ? '已绑定' : '未绑定'}`,
    '',
    '--- Prompt 差异分析 ---',
    `A 长度：${diff.aLength} 字符 / B 长度：${diff.bLength} 字符`,
    diff.aOnlyKeywords.length > 0 ? `A 独有：${diff.aOnlyKeywords.join('、')}` : 'A 独有：无',
    diff.bOnlyKeywords.length > 0 ? `B 独有：${diff.bOnlyKeywords.join('、')}` : 'B 独有：无',
    `人物词：A ${diff.aHasPortrait ? '✓' : '✗'} / B ${diff.bHasPortrait ? '✓' : '✗'}`,
    `镜头词：A ${diff.aHasShot ? '✓' : '✗'} / B ${diff.bHasShot ? '✓' : '✗'}`,
    `光线词：A ${diff.aHasLight ? '✓' : '✗'} / B ${diff.bHasLight ? '✓' : '✗'}`,
    `情绪词：A ${diff.aHasEmotion ? '✓' : '✗'} / B ${diff.bHasEmotion ? '✓' : '✗'}`,
    '',
    winner
      ? `推荐版本：${winner} — ${winner === 'A' ? nodeA.title || '版本 A' : nodeB.title || '版本 B'}`
      : '推荐版本：未标记',
    '',
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    '备注：本报告由版本对比工具生成，不消耗 credits，不自动生成。',
  ]
  return lines.join('\n')
}

export function isComparableNode(node: VisualCanvasNode): boolean {
  if (node.kind !== 'image' && node.kind !== 'video') return false
  return Boolean(node.resultImageUrl || node.resultVideoUrl || node.assetId || node.prompt?.trim())
}
