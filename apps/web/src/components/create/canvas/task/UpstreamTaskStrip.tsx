'use client'

import { useMemo } from 'react'
import type { VisualCanvasNode } from '@/components/create/CanvasNodeCard'
import { getNodeImageUrl } from '@/lib/canvas/media-urls'
import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'
import { getEdgeRole } from '@/lib/canvas/edgeInputBinding'

interface CanvasEdgeLike {
  id: string
  fromNodeId: string
  toNodeId: string
  metadataJson?: unknown
}

interface UpstreamTaskStripProps {
  targetNodeId: string
  nodes: VisualCanvasNode[]
  edges: CanvasEdgeLike[]
}

const ROLE_LABELS: Record<string, string> = {
  primary: '主输入',
  reference: '参考',
  mask: '蒙版',
  control: '控制',
  style: '风格',
  audio: '音频',
}

function UpstreamTaskItem({ node, role }: { node: VisualCanvasNode; role: string }) {
  const roleLabel = ROLE_LABELS[role] ?? role
  const isImage = node.kind === 'image'
  const isVideo = node.kind === 'video'
  const isText = node.kind === 'text'

  let thumbUrl: string | null = null
  if (isImage) {
    const raw = getNodeImageUrl(node)
    if (raw) thumbUrl = getProxiedMediaUrl(raw)
  } else if (isVideo && node.preview?.poster) {
    thumbUrl = getProxiedMediaUrl(node.preview.poster)
  }

  const textPreview = isText && node.resultText
    ? node.resultText.slice(0, 40) + (node.resultText.length > 40 ? '…' : '')
    : null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '6px 8px',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        width: 80,
        minWidth: 80,
        flex: 'none',
      }}
    >
      {/* Thumbnail or icon */}
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={node.title || node.kind}
          style={{
            width: 56,
            height: 40,
            objectFit: 'cover',
            borderRadius: 4,
            flexShrink: 0,
            background: 'rgba(255,255,255,0.06)',
          }}
        />
      ) : (
        <div style={{
          width: 56, height: 40, borderRadius: 4, flexShrink: 0,
          background: 'rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: textPreview ? 10 : 18,
          color: 'rgba(255,255,255,0.4)',
          overflow: 'hidden',
          padding: textPreview ? '2px 4px' : 0,
          lineHeight: 1.3,
          wordBreak: 'break-all',
        }}>
          {textPreview ?? (isImage ? '🖼' : isVideo ? '🎬' : '📝')}
        </div>
      )}

      {/* Title */}
      <div style={{
        fontSize: 10, fontWeight: 600,
        color: 'rgba(255,255,255,0.6)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: '100%',
        textAlign: 'center',
      }}>
        {node.title || node.kind}
      </div>

      {/* Role badge */}
      <span style={{
        fontSize: 9, letterSpacing: '0.03em',
        color: 'rgba(0,210,255,0.6)',
        background: 'rgba(0,210,255,0.06)',
        border: '1px solid rgba(0,210,255,0.15)',
        borderRadius: 3,
        padding: '1px 4px',
        flexShrink: 0,
      }}>
        {roleLabel}
      </span>
    </div>
  )
}

export function UpstreamTaskStrip({ targetNodeId, nodes, edges }: UpstreamTaskStripProps) {
  const incomingItems = useMemo(() => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    return edges
      .filter((e) => e.toNodeId === targetNodeId)
      .map((e) => ({
        edge: e,
        node: nodeMap.get(e.fromNodeId) ?? null,
        role: getEdgeRole(e.metadataJson),
      }))
      .filter((item): item is typeof item & { node: VisualCanvasNode } => item.node !== null)
  }, [targetNodeId, nodes, edges])

  if (incomingItems.length === 0) return null

  return (
    <div
      data-no-node-drag="true"
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.015)',
      }}
    >
      <div style={{
        fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.3)', marginBottom: 6, fontWeight: 600,
      }}>
        上游任务输入 ({incomingItems.length})
      </div>
      <div style={{
        display: 'flex', flexDirection: 'row', gap: 6,
        overflowX: 'auto', paddingBottom: 2,
      }}>
        {incomingItems.map((item) => (
          <UpstreamTaskItem key={item.edge.id} node={item.node} role={item.role} />
        ))}
      </div>
    </div>
  )
}
