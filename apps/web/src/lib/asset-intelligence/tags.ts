import type { AssetIntelligence } from './types'

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
    : []
}

function pushUnique(target: string[], ...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = value?.trim()
    if (!normalized || target.includes(normalized)) continue
    target.push(normalized)
  }
}

export function asAssetIntelligence(value: unknown): AssetIntelligence | null {
  const item = record(value)
  if (!item) return null
  if (item.mediaType !== 'image' && item.mediaType !== 'video') return null
  if (typeof item.generatedAt !== 'string') return null
  return item as AssetIntelligence
}

export function getAssetIntelligenceTags(value: unknown) {
  const intelligence = asAssetIntelligence(value)
  if (!intelligence) return []
  const tags: string[] = []
  pushUnique(tags, ...strings(intelligence.reusableTags))
  pushUnique(tags, ...strings(intelligence.keywords))
  pushUnique(tags, intelligence.scene?.location)
  pushUnique(tags, ...strings(intelligence.scene?.weather))
  pushUnique(tags, ...strings(intelligence.scene?.timeOfDay))
  pushUnique(tags, ...strings(intelligence.cinematography?.shotType))
  pushUnique(tags, ...strings(intelligence.cinematography?.lensStyle))
  pushUnique(tags, ...strings(intelligence.visualStyle?.colorPalette))
  pushUnique(tags, ...strings(intelligence.visualStyle?.lighting))
  pushUnique(tags, ...strings(intelligence.visualStyle?.artStyle))
  pushUnique(tags, ...strings(intelligence.visualStyle?.realism))
  pushUnique(tags, ...strings(intelligence.props))
  pushUnique(tags, ...strings(intelligence.mood))
  for (const character of intelligence.characters ?? []) {
    pushUnique(tags, character.name, character.species, character.gender, character.ageGroup)
    pushUnique(tags, ...strings(character.clothing), ...strings(character.pose), ...strings(character.emotion))
  }
  return tags
}

export function getAssetIntelligenceTagCount(value: unknown) {
  return getAssetIntelligenceTags(value).length
}
