import {
  CREATIVE_KNOWLEDGE_DOMAINS,
  type CreativeKnowledgeDomain,
} from './types'

export type CreatorIntelligenceCapability = {
  readonly id: string
  readonly owner: string
  readonly source: 'creator-skill' | 'canvas-tool' | 'recipe'
  readonly domains: readonly CreativeKnowledgeDomain[]
  readonly deliveryMode: 'strengthen-in-place'
  readonly requiresExternalGeneration: false
  readonly acquisitionDependency: 'none'
}

function capability(
  id: string,
  owner: string,
  source: CreatorIntelligenceCapability['source'],
  domains: readonly CreativeKnowledgeDomain[],
): CreatorIntelligenceCapability {
  if (!id.trim()) throw new TypeError('Capability id must not be empty')
  if (!owner.trim()) throw new TypeError('Capability owner must not be empty')

  const requestedDomains = new Set<CreativeKnowledgeDomain>()
  for (const domain of domains) {
    if (requestedDomains.has(domain)) {
      throw new TypeError('Capability domains must not contain duplicates')
    }
    requestedDomains.add(domain)
  }
  if (!requestedDomains.size) throw new TypeError('Capability domains must not be empty')

  return Object.freeze({
    id,
    owner,
    source,
    domains: Object.freeze(
      CREATIVE_KNOWLEDGE_DOMAINS.filter((domain) => requestedDomains.has(domain)),
    ),
    deliveryMode: 'strengthen-in-place',
    requiresExternalGeneration: false,
    acquisitionDependency: 'none',
  })
}

export const CREATOR_INTELLIGENCE_CAPABILITY_MAP = Object.freeze([
  capability('script-segmentation', 'Script Segmentation Skill', 'creator-skill', ['script']),
  capability('narrative-beat-analysis', 'Narrative Beat Analysis Skill', 'creator-skill', ['script']),
  capability('shot-planning', 'Shot Planning Skill', 'creator-skill', [
    'script',
    'cinematography',
    'composition',
  ]),
  capability('storyboard-director', 'Storyboard Director Recipe', 'recipe', [
    'script',
    'cinematography',
    'lighting',
    'continuity',
  ]),
  capability('storyboard-reference-extractor', 'Storyboard Reference Extractor', 'canvas-tool', [
    'composition',
  ]),
  capability('draw-annotation', 'Draw Annotation Tool', 'canvas-tool', ['composition']),
  capability('camera-control', 'Camera Control Tool', 'canvas-tool', [
    'cinematography',
    'composition',
  ]),
  capability('scene-lighting', 'Scene Lighting Tool', 'canvas-tool', ['lighting']),
  capability('continuity-checker', 'Continuity Check Tool', 'canvas-tool', ['continuity']),
  capability('keyframe-extractor', 'Keyframe Extractor Tool', 'canvas-tool', [
    'editing',
    'continuity',
  ]),
])

export function getCreatorIntelligenceCapability(
  id: string,
): CreatorIntelligenceCapability | null {
  const normalized = typeof id === 'string' ? id.trim() : ''
  return CREATOR_INTELLIGENCE_CAPABILITY_MAP.find((item) => item.id === normalized) ?? null
}
