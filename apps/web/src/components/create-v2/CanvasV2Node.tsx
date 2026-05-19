'use client'

import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { CanvasV2NodeData } from '@/lib/canvas-v2/canvasV2Adapter'

const KIND_ICONS: Record<string, string> = {
  text: '📝', image: '🖼️', video: '🎬', asset: '📦', generation: '✨',
}
const STATUS_COLORS: Record<string, string> = {
  idle: '#6b7280', running: '#f59e0b', succeeded: '#10b981', failed: '#ef4444',
}
const STATUS_LABELS: Record<string, string> = {
  idle: '待机', running: '生成中…', succeeded: '已完成', failed: '失败',
}
const KIND_LABELS: Record<string, string> = {
  text: '文本节点', image: '图像节点', video: '视频节点', asset: '素材节点', generation: '生成节点',
}
const EXECUTOR_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  aliyun_fc: { label: '🔴 CN FC', color: '#fca5a5', bg: 'rgba(239,68,68,.12)', border: 'rgba(239,68,68,.25)' },
  vercel: { label: '🔵 Vercel', color: '#93c5fd', bg: 'rgba(59,130,246,.12)', border: 'rgba(59,130,246,.25)' },
}

export const CanvasV2Node = memo(function CanvasV2Node({ data, selected }: NodeProps<Node<CanvasV2NodeData>>) {
  const [imgError, setImgError] = useState(false)
  const [assetImgError, setAssetImgError] = useState(false)
  const status = data.status ?? 'idle'
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.idle
  const icon = KIND_ICONS[data.kind] ?? '📄'
  const isVideo = data.kind === 'video'
  const isAsset = data.kind === 'asset'
  const thumbnailSrc = !imgError && !isVideo && !isAsset ? (data.thumbnailUrl ?? data.resultImageUrl) : undefined
  const hasVideo = isVideo && !!data.resultVideoUrl
  const executor = data.executorKind ? EXECUTOR_BADGE[data.executorKind] : null
  const assetThumbnail = isAsset && !assetImgError ? (data.thumbnailUrl ?? data.stableUrl ?? data.resolvedUrl) : undefined

  return (
    <div style={{
      minWidth: 240, maxWidth: 300,
      background: selected
        ? 'linear-gradient(135deg,rgba(124,58,237,.25) 0%,rgba(15,15,30,.92) 100%)'
        : 'linear-gradient(135deg,rgba(15,15,30,.88) 0%,rgba(20,20,40,.92) 100%)',
      border: selected ? '1.5px solid #7c3aed' : '1px solid rgba(124,58,237,.35)',
      borderRadius: 12,
      boxShadow: selected ? '0 0 0 2px rgba(124,58,237,.4),0 8px 32px rgba(0,0,0,.5)' : '0 4px 24px rgba(0,0,0,.4)',
      backdropFilter: 'blur(12px)',
      overflow: 'hidden',
      fontFamily: 'system-ui,sans-serif',
      transition: 'border .15s,box-shadow .15s',
      cursor: 'pointer',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#7c3aed', border: '2px solid #4c1d95', width: 10, height: 10 }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 8px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.title ?? KIND_LABELS[data.kind] ?? '节点'}
        </span>
        {/* Status badge with running pulse animation */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 7px', borderRadius: 10, background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44`, fontWeight: 600, flexShrink: 0 }}>
          {status === 'running' && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0, animation: 'pulse 1s ease-in-out infinite' }} />
          )}
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>

      {/* Prompt (2-line clamp) */}
      {data.prompt && (
        <div style={{
          padding: '8px 12px',
          color: '#94a3b8',
          fontSize: 12,
          lineHeight: 1.5,
          borderBottom: '1px solid rgba(255,255,255,.04)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        } as React.CSSProperties}>
          {data.prompt}
        </div>
      )}

      {/* Thumbnail (image) */}
      {thumbnailSrc && (
        <div style={{ padding: '8px 12px 0' }}>
          <img
            src={thumbnailSrc}
            alt="result"
            onError={() => setImgError(true)}
            style={{ width: '100%', borderRadius: 8, maxHeight: 160, objectFit: 'cover', display: 'block', border: '1px solid rgba(255,255,255,.08)' }}
          />
        </div>
      )}

      {/* Video placeholder or result */}
      {isVideo && (
        <div style={{ padding: '8px 12px 0' }}>
          {hasVideo ? (
            <video
              src={data.resultVideoUrl}
              style={{ width: '100%', borderRadius: 8, maxHeight: 140, display: 'block', border: '1px solid rgba(255,255,255,.08)' }}
              muted
              playsInline
            />
          ) : (
            <div style={{ width: '100%', height: 80, borderRadius: 8, background: 'rgba(124,58,237,.08)', border: '1px solid rgba(124,58,237,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 24 }}>🎬</span>
              <span style={{ fontSize: 10, color: '#4b5563' }}>视频节点</span>
            </div>
          )}
        </div>
      )}

      {/* Asset node content */}
      {isAsset && (
        <div style={{ padding: '8px 12px 0' }}>
          {assetThumbnail ? (
            <img
              src={assetThumbnail}
              alt="asset"
              onError={() => setAssetImgError(true)}
              style={{ width: '100%', borderRadius: 8, maxHeight: 120, objectFit: 'cover', display: 'block', border: '1px solid rgba(255,255,255,.08)' }}
            />
          ) : (
            <div style={{ width: '100%', height: 60, borderRadius: 8, background: 'rgba(124,58,237,.08)', border: '1px solid rgba(124,58,237,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 20 }}>📦</span>
              <span style={{ fontSize: 10, color: '#4b5563' }}>{data.assetId ? data.assetId.slice(0, 12) + '…' : '素材节点'}</span>
            </div>
          )}
        </div>
      )}

      {/* Region + executor badges */}
      {(data.providerRegion || data.executionRegion || executor) && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 12px', flexWrap: 'wrap' }}>
          {data.providerRegion && (
            <Badge label="provider" value={data.providerRegion} isCn={data.providerRegion === 'cn'} />
          )}
          {data.executionRegion && data.executionRegion !== data.providerRegion && (
            <Badge label="exec" value={data.executionRegion} isCn={data.executionRegion === 'cn'} />
          )}
          {executor && (
            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: executor.bg, color: executor.color, border: `1px solid ${executor.border}` }}>
              {executor.label}
            </span>
          )}
        </div>
      )}

      {/* Input assets badge */}
      {Array.isArray(data.inputAssets) && data.inputAssets.length > 0 && (
        <div style={{ padding: '4px 12px', borderTop: '1px solid rgba(255,255,255,.04)', fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>📎 参考素材 {data.inputAssets.length} 个</span>
          {data.assetRegionBridgeRequired && (
            <span style={{ color: '#f59e0b', marginLeft: 4 }}>⚠ 需区域桥接</span>
          )}
        </div>
      )}

      {/* Error display */}
      {status === 'failed' && (data.errorMessage || data.errorCode) && (
        <div style={{ margin: '6px 12px', padding: '6px 8px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6 }}>
          {data.errorCode && <div style={{ color: '#f87171', fontSize: 10, fontWeight: 700, marginBottom: 2 }}>{data.errorCode}</div>}
          {data.errorMessage && <div style={{ color: '#fca5a5', fontSize: 11 }}>{String(data.errorMessage).slice(0, 100)}</div>}
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '6px 12px', display: 'flex', borderTop: '1px solid rgba(255,255,255,.06)', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#374151' }}>双击打开属性</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: '#475569' }}>{data.kind}</span>
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#7c3aed', border: '2px solid #4c1d95', width: 10, height: 10 }} />

      {/* CSS animation for running pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  )
})

function Badge({ label, value, isCn }: { label: string; value: string; isCn: boolean }) {
  return (
    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: isCn ? 'rgba(239,68,68,.12)' : 'rgba(59,130,246,.12)', color: isCn ? '#fca5a5' : '#93c5fd', border: `1px solid ${isCn ? 'rgba(239,68,68,.25)' : 'rgba(59,130,246,.25)'}` }}>
      {label}:{value}
    </span>
  )
}
