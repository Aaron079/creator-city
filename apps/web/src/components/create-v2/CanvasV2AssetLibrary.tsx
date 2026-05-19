'use client'

import { useState, useEffect } from 'react'
import type { CanvasV2AssetItem } from '@/lib/canvas-v2/canvasV2Adapter'

type Props = {
  projectId: string | undefined
  onDragStart: (asset: CanvasV2AssetItem) => void
  isOpen: boolean
  onClose: () => void
}

const KIND_ICONS: Record<string, string> = { image: '🖼️', video: '🎬', text: '📝', asset: '📦' }

export function CanvasV2AssetLibrary({ projectId, onDragStart, isOpen, onClose }: Props) {
  const [assets, setAssets] = useState<CanvasV2AssetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<string>('all')
  const [regionFilter, setRegionFilter] = useState<string>('all')

  useEffect(() => {
    if (!projectId || !isOpen) return
    setLoading(true)
    setError('')
    fetch(`/api/projects/${encodeURIComponent(projectId)}/assets`, { credentials: 'include' })
      .then(r => r.json())
      .then((data: { ok: boolean; assets?: CanvasV2AssetItem[]; error?: string }) => {
        if (data.ok && Array.isArray(data.assets)) setAssets(data.assets)
        else setError(data.error ?? 'canvas_v2_assets_load_failed')
      })
      .catch(() => setError('canvas_v2_assets_load_failed'))
      .finally(() => setLoading(false))
  }, [projectId, isOpen])

  if (!isOpen) return null

  const filtered = assets.filter(a => {
    if (kindFilter !== 'all' && a.kind !== kindFilter) return false
    if (regionFilter !== 'all' && a.storageRegion !== regionFilter && a.sourceProviderRegion !== regionFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!a.id.toLowerCase().includes(q) && !a.provider?.toLowerCase().includes(q) && !a.kind.toLowerCase().includes(q)) return false
    }
    return true
  })

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 8px',
    fontSize: 11,
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: active ? 700 : 400,
    background: active ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)',
    border: active ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.1)',
    color: active ? '#c4b5fd' : '#94a3b8',
  })

  const regionBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '2px 8px',
    fontSize: 10,
    borderRadius: 5,
    cursor: 'pointer',
    fontWeight: active ? 700 : 400,
    background: active ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
    border: active ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.08)',
    color: active ? '#93c5fd' : '#6b7280',
  })

  return (
    <div style={{
      position: 'absolute', top: 0, left: 70, bottom: 0, width: 260, zIndex: 15,
      background: 'rgba(8,8,20,0.97)', borderRight: '1px solid rgba(124,58,237,0.25)',
      display: 'flex', flexDirection: 'column', backdropFilter: 'blur(12px)',
      fontFamily: 'system-ui,sans-serif',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', flex: 1 }}>项目素材库</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px 6px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索素材…"
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Kind filter */}
      <div style={{ display: 'flex', gap: 4, padding: '4px 10px', flexWrap: 'wrap' }}>
        {(['all', 'image', 'video', 'text', 'asset'] as const).map(k => (
          <button key={k} onClick={() => setKindFilter(k)} style={btnStyle(kindFilter === k)}>
            {k === 'all' ? '全部' : k === 'image' ? '图片' : k === 'video' ? '视频' : k === 'text' ? '文本' : '资产'}
          </button>
        ))}
      </div>

      {/* Region filter */}
      <div style={{ display: 'flex', gap: 4, padding: '2px 10px 6px' }}>
        {(['all', 'cn', 'global'] as const).map(r => (
          <button key={r} onClick={() => setRegionFilter(r)} style={regionBtnStyle(regionFilter === r)}>
            {r === 'all' ? '全部区域' : r.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Count */}
      {!loading && !error && (
        <div style={{ padding: '2px 12px 6px', fontSize: 11, color: '#4b5563' }}>{filtered.length} 个素材</div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 12px' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#6b7280', fontSize: 13 }}>加载中…</div>
        )}
        {error && !loading && (
          <div style={{ margin: 8, padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#fca5a5', fontSize: 12 }}>
            {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: '#4b5563', fontSize: 12, lineHeight: 1.6 }}>
            当前项目还没有素材，生成图片或上传素材后会出现在这里。
          </div>
        )}
        {!loading && !error && filtered.map(asset => (
          <div
            key={asset.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/creator-city-asset', JSON.stringify(asset))
              e.dataTransfer.effectAllowed = 'copy'
              onDragStart(asset)
            }}
            style={{ marginBottom: 8, background: 'rgba(15,15,30,0.8)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, overflow: 'hidden', cursor: 'grab', transition: 'border .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(124,58,237,0.5)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(124,58,237,0.2)' }}
          >
            {/* Thumbnail */}
            {asset.kind === 'image' && (asset.thumbnailUrl || asset.stableUrl || asset.url) && (
              <img
                src={asset.thumbnailUrl ?? asset.stableUrl ?? asset.url}
                alt=""
                style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block', background: '#111' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            {asset.kind === 'video' && (
              <div style={{ width: '100%', height: 60, background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎬</div>
            )}
            {/* Info */}
            <div style={{ padding: '6px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <span style={{ fontSize: 12 }}>{KIND_ICONS[asset.kind] ?? '📦'}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#c4b5fd' }}>{asset.kind}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 5px', borderRadius: 4, background: asset.storageRegion === 'cn' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)', color: asset.storageRegion === 'cn' ? '#fca5a5' : '#93c5fd' }}>
                  {(asset.storageRegion ?? 'CN').toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {asset.provider} · {asset.id.slice(0, 8)}
              </div>
              <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>
                {new Date(asset.createdAt).toLocaleDateString('zh-CN')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
