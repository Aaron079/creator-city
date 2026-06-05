// Pure helpers for Character Lock (Tool 4).
// No API calls, no side effects, no imports from React.

export function generateCharacterDescription(
  prompt: string,
  assetIntelligence: Record<string, unknown> | null | undefined,
): string {
  const parts: string[] = []

  const trimmedPrompt = prompt.trim().slice(0, 120)
  if (trimmedPrompt) parts.push(trimmedPrompt)

  if (assetIntelligence) {
    const chars = assetIntelligence.characters
    if (typeof chars === 'string' && chars.trim()) parts.push(chars.trim())
    const style = assetIntelligence.visualStyle
    if (typeof style === 'string' && style.trim()) parts.push(`视觉风格：${style.trim()}`)
    const mood = assetIntelligence.mood
    if (typeof mood === 'string' && mood.trim()) parts.push(`气质：${mood.trim()}`)
  }

  const chineseHint = '保持同一角色身份、面部结构、发型、服装和整体视觉气质一致。'
  const englishHint =
    'same character identity, consistent facial features, same hairstyle, same outfit, consistent visual identity, preserve age and expression style'

  const base = parts.join('\n')
  return base
    ? `${base}\n\n${chineseHint}\nCharacter consistency: ${englishHint}`
    : `${chineseHint}\nCharacter consistency: ${englishHint}`
}

export function buildCharacterPromptAppend(
  name: string,
  sourceNodeId: string,
  description: string,
): string {
  const shortId = sourceNodeId.slice(0, 8)
  return [
    '',
    '',
    '角色一致性：',
    `- 角色：${name}`,
    `- 来源节点：${shortId}...`,
    `- 角色描述：${description}`,
    '',
    'Character consistency: same character identity, consistent facial features, same hairstyle, same outfit, consistent visual identity',
  ].join('\n')
}
