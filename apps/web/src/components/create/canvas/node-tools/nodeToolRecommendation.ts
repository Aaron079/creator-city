import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import { NODE_TOOL_REGISTRY } from './nodeToolRegistry'
import type { NodeToolEntry } from './nodeToolTypes'

export type NodeToolRecommendationInput = {
  nodeKind: VisualCanvasNodeKind
  hasMediaResult: boolean
  caps: { removeBackground?: boolean; upscale?: boolean }
}

export type NodeToolContextItem = {
  tool: NodeToolEntry
  unavailableReason?: string
}

export function contextNodeTools(
  input: NodeToolRecommendationInput,
): readonly NodeToolContextItem[] {
  return NODE_TOOL_REGISTRY
    .filter((tool) => tool.supportedKinds.includes(input.nodeKind))
    .map((tool) => {
      if (tool.requiresMedia && !input.hasMediaResult) {
        return { tool, unavailableReason: '请先获得节点素材后再使用此工具' }
      }
      if (tool.capabilityKey === 'removeBackground' && !input.caps.removeBackground) {
        return { tool, unavailableReason: tool.unavailableReason ?? '主体抠图执行器尚不可用' }
      }
      if (tool.capabilityKey === 'upscale' && !input.caps.upscale) {
        return { tool, unavailableReason: tool.unavailableReason ?? '高清重建执行器尚不可用' }
      }
      return { tool }
    })
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
