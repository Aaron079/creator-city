import type { CharacterBible } from '@/lib/characters/types'
import type { SceneBible } from '@/lib/scenes/types'
import type { ProjectStyleBible } from '@/lib/skills/types'

interface BibleContextInput {
  characterBible?: CharacterBible | null
  sceneBible?: SceneBible | null
  styleBible?: ProjectStyleBible | null
}

export function hasBibleContent(input: BibleContextInput): boolean {
  const chars = input.characterBible?.characters?.filter((c) => c.name?.trim()) ?? []
  const scenes = input.sceneBible?.scenes?.filter((s) => s.name?.trim()) ?? []
  const s = input.styleBible
  const hasStyle = Boolean(
    s && (s.visualStyle || s.colorPalette || s.cameraLanguage || s.logline || s.storyWorld || s.negativeRules),
  )
  return chars.length > 0 || scenes.length > 0 || hasStyle
}

export function buildBiblePromptContext(input: BibleContextInput): string {
  const parts: string[] = []

  const characters = input.characterBible?.characters?.filter((c) => c.name?.trim()) ?? []
  if (characters.length > 0) {
    const charLines = characters
      .map((c) => {
        const details = [
          c.role && `身份: ${c.role}`,
          c.appearance && `外貌: ${c.appearance}`,
          c.ageAndTemperament && `年龄/气质: ${c.ageAndTemperament}`,
          c.costume && `服装: ${c.costume}`,
          c.hairstyle && `发型: ${c.hairstyle}`,
          c.props && `道具: ${c.props}`,
          c.negativeRules && `禁止变化: ${c.negativeRules}`,
          c.referenceKeywords?.length && `关键词: ${c.referenceKeywords.join(', ')}`,
        ].filter((d): d is string => Boolean(d))
        return `- ${c.name}${details.length ? '\n  ' + details.join('\n  ') : ''}`
      })
      .join('\n')
    parts.push(`Character Bible:\n${charLines}`)
  }

  const scenes = input.sceneBible?.scenes?.filter((s) => s.name?.trim()) ?? []
  if (scenes.length > 0) {
    const sceneLines = scenes
      .map((s) => {
        const details = [
          s.location && `地点: ${s.location}`,
          s.era && `时代: ${s.era}`,
          s.atmosphere && `氛围: ${s.atmosphere}`,
          s.lighting && `光线: ${s.lighting}`,
          s.weather && `天气: ${s.weather}`,
          s.colorRules && `色彩: ${s.colorRules}`,
          s.negativeRules && `禁止变化: ${s.negativeRules}`,
          s.referenceKeywords?.length && `关键词: ${s.referenceKeywords.join(', ')}`,
        ].filter((d): d is string => Boolean(d))
        return `- ${s.name}${details.length ? '\n  ' + details.join('\n  ') : ''}`
      })
      .join('\n')
    parts.push(`Scene Bible:\n${sceneLines}`)
  }

  const style = input.styleBible
  if (style) {
    const styleLines = [
      style.logline && `项目：${style.logline}`,
      style.storyWorld && `世界观：${style.storyWorld}`,
      style.visualStyle && `视觉风格：${style.visualStyle}`,
      style.colorPalette && `色彩：${style.colorPalette}`,
      style.cameraLanguage && `镜头语言：${style.cameraLanguage}`,
      style.negativeRules && `禁止：${style.negativeRules}`,
    ].filter((d): d is string => Boolean(d))
    if (styleLines.length > 0) {
      parts.push(`Style Bible:\n${styleLines.join('\n')}`)
    }
  }

  if (parts.length === 0) return ''
  return (
    '\n\n[Creator City Director Context]\n' +
    parts.join('\n\n') +
    '\nRules: Keep character identity consistent. Keep scene continuity. Apply project style.'
  )
}

export function appendBibleContextToPrompt(userPrompt: string, bibleContext: string): string {
  if (!bibleContext.trim()) return userPrompt
  return userPrompt + bibleContext
}
