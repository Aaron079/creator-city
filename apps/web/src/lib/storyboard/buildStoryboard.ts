import type { StoryboardCanvasEdge, StoryboardCanvasNode, StoryboardMissingKind, StoryboardShot } from './types'

const STORYBOARD_NODE_KINDS = new Set(['text', 'image', 'video'])

function nodeKind(node: StoryboardCanvasNode) {
  return node.kind || node.type || ''
}

function metadataRecord(metadataJson: unknown) {
  return metadataJson && typeof metadataJson === 'object' && !Array.isArray(metadataJson)
    ? metadataJson as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function numericDate(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function edgeSource(edge: StoryboardCanvasEdge) {
  return edge.fromNodeId || edge.source || ''
}

function edgeTarget(edge: StoryboardCanvasEdge) {
  return edge.toNodeId || edge.target || ''
}

function sortByCanvasPosition(a: StoryboardCanvasNode, b: StoryboardCanvasNode) {
  const xDelta = (a.x ?? 0) - (b.x ?? 0)
  if (xDelta !== 0) return xDelta
  const createdDelta = numericDate(a.createdAt) - numericDate(b.createdAt)
  if (createdDelta !== 0) return createdDelta
  return a.id.localeCompare(b.id)
}

function topologicalNodeOrder(nodes: StoryboardCanvasNode[], edges: StoryboardCanvasEdge[]) {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const indegree = new Map(nodes.map((node) => [node.id, 0]))
  const outbound = new Map<string, string[]>()

  edges.forEach((edge) => {
    const source = edgeSource(edge)
    const target = edgeTarget(edge)
    if (!nodeIds.has(source) || !nodeIds.has(target)) return
    outbound.set(source, [...(outbound.get(source) ?? []), target])
    indegree.set(target, (indegree.get(target) ?? 0) + 1)
  })

  const queue = nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .sort(sortByCanvasPosition)
  const ordered: StoryboardCanvasNode[] = []

  while (queue.length) {
    const node = queue.shift()
    if (!node) break
    ordered.push(node)

    const nextNodes = (outbound.get(node.id) ?? [])
      .map((id) => byId.get(id))
      .filter((item): item is StoryboardCanvasNode => Boolean(item))
      .sort(sortByCanvasPosition)
    nextNodes.forEach((nextNode) => {
      const nextDegree = Math.max(0, (indegree.get(nextNode.id) ?? 0) - 1)
      indegree.set(nextNode.id, nextDegree)
      if (nextDegree === 0) queue.push(nextNode)
    })
    queue.sort(sortByCanvasPosition)
  }

  if (ordered.length !== nodes.length) {
    const seen = new Set(ordered.map((node) => node.id))
    return [
      ...ordered,
      ...nodes.filter((node) => !seen.has(node.id)).sort(sortByCanvasPosition),
    ]
  }

  return ordered
}

function directChildrenByKind(
  nodeId: string,
  targetKind: 'text' | 'image' | 'video',
  nodesById: Map<string, StoryboardCanvasNode>,
  outbound: Map<string, string[]>,
) {
  return (outbound.get(nodeId) ?? [])
    .map((id) => nodesById.get(id))
    .filter((node): node is StoryboardCanvasNode => {
      if (!node) return false
      return nodeKind(node) === targetKind
    })
    .sort(sortByCanvasPosition)
}

function firstText(node?: StoryboardCanvasNode) {
  if (!node) return ''
  return node.resultText || node.resultPreview || node.outputLabel || ''
}

function firstPrompt(nodes: Array<StoryboardCanvasNode | undefined>) {
  return nodes.map((node) => node?.prompt).find((value): value is string => Boolean(value?.trim())) ?? ''
}

function firstProvider(nodes: Array<StoryboardCanvasNode | undefined>) {
  return nodes.map((node) => node?.providerId).find((value): value is string => Boolean(value?.trim())) ?? ''
}

function firstModel(nodes: Array<StoryboardCanvasNode | undefined>) {
  return nodes.map((node) => node?.model).find((value): value is string => Boolean(value?.trim())) ?? ''
}

function mergedStatus(nodes: Array<StoryboardCanvasNode | undefined>) {
  const statuses = nodes.map((node) => node?.status).filter((value): value is string => Boolean(value))
  if (statuses.includes('error')) return 'error'
  if (statuses.some((status) => status === 'queued' || status === 'running' || status === 'generating')) return 'running'
  if (statuses.includes('done')) return 'done'
  return statuses[0] || 'idle'
}

function firstCompiledPrompt(nodes: Array<StoryboardCanvasNode | undefined>) {
  for (const node of nodes) {
    const value = stringValue(metadataRecord(node?.metadataJson).compiledPromptPreview)
    if (value) return value
  }
  return ''
}

function shotId(textNode?: StoryboardCanvasNode, imageNode?: StoryboardCanvasNode, videoNode?: StoryboardCanvasNode) {
  return [textNode?.id, imageNode?.id, videoNode?.id].filter(Boolean).join('__') || `shot-${Date.now()}`
}

function buildShot(
  order: number,
  textNode?: StoryboardCanvasNode,
  imageNode?: StoryboardCanvasNode,
  videoNode?: StoryboardCanvasNode,
): StoryboardShot {
  const nodes = [textNode, imageNode, videoNode]
  const missing: StoryboardMissingKind[] = []
  if (!firstText(textNode).trim()) missing.push('text')
  if (!imageNode?.resultImageUrl) missing.push('image')
  if (!videoNode?.resultVideoUrl) missing.push('video')

  return {
    id: shotId(textNode, imageNode, videoNode),
    order,
    nodeIds: nodes.map((node) => node?.id).filter((id): id is string => Boolean(id)),
    textNodeId: textNode?.id,
    imageNodeId: imageNode?.id,
    videoNodeId: videoNode?.id,
    text: firstText(textNode),
    imageUrl: imageNode?.resultImageUrl,
    videoUrl: videoNode?.resultVideoUrl,
    prompt: firstPrompt(nodes),
    providerId: firstProvider(nodes),
    model: firstModel(nodes),
    status: mergedStatus(nodes),
    compiledPromptPreview: firstCompiledPrompt(nodes),
    missing,
  }
}

export function buildStoryboardFromCanvas(
  nodes: StoryboardCanvasNode[],
  edges: StoryboardCanvasEdge[],
): StoryboardShot[] {
  const storyNodes = nodes
    .filter((node) => STORYBOARD_NODE_KINDS.has(nodeKind(node)))
    .sort(sortByCanvasPosition)
  const nodesById = new Map(storyNodes.map((node) => [node.id, node]))
  const outbound = new Map<string, string[]>()

  edges.forEach((edge) => {
    const source = edgeSource(edge)
    const target = edgeTarget(edge)
    if (!nodesById.has(source) || !nodesById.has(target)) return
    outbound.set(source, [...(outbound.get(source) ?? []), target])
  })

  const ordered = topologicalNodeOrder(storyNodes, edges)
  const used = new Set<string>()
  const shots: StoryboardShot[] = []

  ordered.forEach((node) => {
    if (used.has(node.id)) return
    const kind = nodeKind(node)

    if (kind === 'text') {
      const imageNode = directChildrenByKind(node.id, 'image', nodesById, outbound).find((item) => !used.has(item.id))
      const videoNode = imageNode
        ? directChildrenByKind(imageNode.id, 'video', nodesById, outbound).find((item) => !used.has(item.id))
        : directChildrenByKind(node.id, 'video', nodesById, outbound).find((item) => !used.has(item.id))
      const shot = buildShot(shots.length + 1, node, imageNode, videoNode)
      shot.nodeIds.forEach((id) => used.add(id))
      shots.push(shot)
      return
    }

    if (kind === 'image') {
      const videoNode = directChildrenByKind(node.id, 'video', nodesById, outbound).find((item) => !used.has(item.id))
      const shot = buildShot(shots.length + 1, undefined, node, videoNode)
      shot.nodeIds.forEach((id) => used.add(id))
      shots.push(shot)
      return
    }

    if (kind === 'video') {
      const shot = buildShot(shots.length + 1, undefined, undefined, node)
      shot.nodeIds.forEach((id) => used.add(id))
      shots.push(shot)
    }
  })

  return shots.map((shot, index) => ({ ...shot, order: index + 1 }))
}
