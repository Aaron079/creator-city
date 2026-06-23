'use client'

import { useState, useMemo } from 'react'
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

const MAX_VISIBLE = 2

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

  const textSummary = isText && node.resultText
    ? node.resultText.slice(0, 80) + (node.resultText.length > 80 ? '…' : '')
    : null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        minWidth: 0,
        flex: 1,
      }}
    >
      {/* Thumbnail or icon */}
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={node.title || node.kind}
          style={{
            width: 36,
            height: 36,
            objectFit: 'cover',
            borderRadius: 5,
            flexShrink: 0,
            background: 'rgba(255,255,255,0.06)',
          }}
        />
      ) : (
        <div style={{
          width: 36, height: 36, borderRadius: 5, flexShrink: 0,
          background: 'rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>
          {isImage ? '🖼' : isVideo ? '🎬' : '📝'}
        </div>
      )}

      {/* Labels */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 11, fontWeight: 600,
          color: 'rgba(255,255,255,0.72)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {node.title || node.kind}
        </div>
        {textSummary ? (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1, lineHeight: 1.3 }}>
            {textSummary}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>
            {node.status === 'done' ? '已完成' : node.status === 'idle' ? '待生成' : node.status}
          </div>
        )}
      </div>

      {/* Role badge */}
      <span style={{
        fontSize: 9, letterSpacing: '0.04em',
        color: 'rgba(0,210,255,0.6)',
        background: 'rgba(0,210,255,0.06)',
        border: '1px solid rgba(0,210,255,0.15)',
        borderRadius: 4,
        padding: '1px 5px',
        flexShrink: 0,
      }}>
        {roleLabel}
      </span>
    </div>
  )
}

export function UpstreamTaskStrip({ targetNodeId, nodes, edges }: UpstreamTaskStripProps) {
  const [expanded, setExpanded] = useState(false)

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

  const visible = expanded ? incomingItems : incomingItems.slice(0, MAX_VISIBLE)
  const hiddenCount = incomingItems.length - MAX_VISIBLE

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visible.map((item) => (
          <UpstreamTaskItem key={item.edge.id} node={item.node} role={item.role} />
        ))}
        {!expanded && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)', fontSize: 10, textAlign: 'left',
              padding: '2px 4px',
            }}
          >
            另有 {hiddenCount} 个上游节点…
          </button>
        )}
      </div>
    </div>
  )
}
