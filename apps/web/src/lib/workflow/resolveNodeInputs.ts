/**
 * Pure workflow input resolution utilities.
 * No React, no DOM, no side effects — safe to import anywhere.
 */

// Minimal node shape required for resolution — compatible with VisualCanvasNode
export type WorkflowNode = {
  id: string
  kind: string
  metadataJson?: unknown
  resultImageUrl?: string | null
  preview?: { url?: string | null } | null
}

export type WorkflowEdge = {
  fromNodeId: string
  toNodeId: string
}

export type ResolvedVideoInput =
  | {
      mode: 'text-to-video'
      sourceImageNodeId?: undefined
      imageUrl?: undefined
      reason: 'no_upstream_image'
    }
  | {
      mode: 'text-to-video'
      sourceImageNodeId: string
      imageUrl?: undefined
      reason: 'upstream_image_missing_url'
    }
  | {
      mode: 'image-to-video'
      sourceImageNodeId: string
      imageUrl: string
      reason: 'upstream_image_found'
    }

/**
 * Resolves the image input for a video node based on canvas edges.
 *
 * Priority:
 *  1. No upstream image node → text-to-video
 *  2. Upstream image node with resolvable URL → image-to-video
 *  3. Upstream image node but no URL → text-to-video + reason
 *
 * v1 limitation: only the first connected image node is used.
 */
export function resolveImageInputForVideoNode(params: {
  videoNode: WorkflowNode
  allNodes: WorkflowNode[]
  edges: WorkflowEdge[]
}): ResolvedVideoInput {
  const { videoNode, allNodes, edges } = params

  const upstreamEdges = edges.filter((e) => e.toNodeId === videoNode.id)
  const upstreamImageNodes = upstreamEdges
    .map((e) => allNodes.find((n) => n.id === e.fromNodeId))
    .filter((n): n is WorkflowNode => n?.kind === 'image')

  if (upstreamImageNodes.length === 0) {
    return { mode: 'text-to-video', reason: 'no_upstream_image' }
  }

  // v1: use the first upstream image node
  // upstreamImageNodes.length > 0 is guaranteed by the guard above
  const sourceNode = upstreamImageNodes[0]!
  const imageUrl = extractImageUrl(sourceNode)

  if (!imageUrl) {
    return {
      mode: 'text-to-video',
      sourceImageNodeId: sourceNode.id,
      reason: 'upstream_image_missing_url',
    }
  }

  return {
    mode: 'image-to-video',
    sourceImageNodeId: sourceNode.id,
    imageUrl,
    reason: 'upstream_image_found',
  }
}

/**
 * Extracts the best available image URL from a node's metadata and fields.
 * Priority mirrors the stable URL fields written by cn-executor and the
 * image generation chain.
 */
export function extractImageUrl(node: WorkflowNode): string {
  const meta = metaRecord(node.metadataJson)
  return (
    httpsStr(meta.stableUrl)
    || httpsStr(meta.resolvedUrl)
    || httpsStr(meta.assetUrl)
    || httpsStr(node.resultImageUrl)
    || httpsStr(meta.imageUrl)
    || httpsStr(meta.providerOriginalUrl)
    || httpsStr(metaRecord(meta.mediaPersistence).stableUrl)
    || httpsStr(metaRecord(meta.mediaPersistence).resolvedUrl)
    || ''
  )
}

function metaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function httpsStr(value: unknown): string {
  if (typeof value !== 'string') return ''
  const v = value.trim()
  return v && /^https?:\/\//i.test(v) ? v : ''
}
