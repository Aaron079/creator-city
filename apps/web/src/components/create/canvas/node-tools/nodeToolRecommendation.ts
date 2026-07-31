import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import { NODE_TOOL_REGISTRY } from './nodeToolRegistry'
import type { NodeToolEntry } from './nodeToolTypes'

export type NodeToolRecommendationInput = {
  nodeKind: VisualCanvasNodeKind
  hasMediaResult: boolean
  caps: { removeBackground?: boolean; upscale?: boolean }
}
export function availableNodeTools(
  input: NodeToolRecommendationInput,
): readonly NodeToolEntry[] {
  return NODE_TOOL_REGISTRY.filter((tool) => {
    if (!tool.supportedKinds.includes(input.nodeKind)) return false
    if (tool.requiresMedia && !input.hasMediaResult) return false
    if (tool.capabilityKey === 'removeBackground' && !input.caps.removeBackground) return false
    if (tool.capabilityKey === 'upscale' && !input.caps.upscale) return false
    if (tool.category === 'image-edit' && !(input.nodeKind === 'image' && input.hasMediaResult)) return false
    return true
  })
}

export function recommendNodeTool(
  input: NodeToolRecommendationInput,
): NodeToolEntry | null {
  const tools = availableNodeTools(input)
  const preferredActionId = input.nodeKind === 'text'
    ? 'storyboard-director'
    : input.nodeKind === 'image' || input.nodeKind === 'video'
      ? 'camera-control'
      : null

  return tools.find((tool) => tool.openActionId === preferredActionId) ?? tools[0] ?? null
}
