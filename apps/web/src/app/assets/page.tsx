'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetItem {
  id: string
  name: string
  title?: string | null
  type: string
  status?: string | null
  url: string
  dataUrl?: string | null
  thumbnailUrl?: string | null
  resolvedUrl?: string | null
  mimeType: string
  sizeBytes?: number | null
  width?: number | null
  height?: number | null
  duration?: number | null
  prompt?: string | null
  providerId?: string | null
  generationJobId?: string | null
  projectId?: string | null
  nodeId?: string | null
  isPublic?: boolean | null
  createdAt: string
  project?: { id: string; title: string } | null
}

interface ApiResponse {
  assets?: AssetItem[]
  message?: string
  errorCode?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bestUrl(asset: AssetItem): string {
  return asset.resolvedUrl || asset.url || asset.dataUrl || ''
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(sec?: number | null) {
  if (!sec) return null
  if (sec < 60) return `${sec.toFixed(0)}s`
  return `${Math.floor(sec / 60)}m${Math.floor(sec % 60)}s`
}

function formatBytes(size?: number | null) {
  if (!size) return null
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function shortId(id: string) {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id
}

function promptPreview(prompt?: string | null) {
  if (!prompt) return null
  return prompt.length > 80 ? `${prompt.slice(0, 80)}…` : prompt
}

// ─── Style constants ──────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  IMAGE: { label: '图片', bg: '#e8f0ff', color: '#2563eb' },
  VIDEO: { label: '视频', bg: '#fff7ed', color: '#c2410c' },
  AUDIO: { label: '音频', bg: '#ecfdf3', color: '#2e7d5b' },
  SCRIPT: { label: '文本', bg: '#f2f4f7', color: '#667085' },
  DOCUMENT: { label: '文件', bg: '#f2f4f7', color: '#667085' },
}

const SELECT_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid #dbe3ef',
  background: '#fff',
  color: '#344054',
  fontSize: '14px',
  cursor: 'pointer',
  outline: 'none',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeChip({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] ?? { label: type, bg: '#f2f4f7', color: '#667085' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '7px', fontSize: '11px', fontWeight: 650, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copy = () => {
    void navigator.clipboard?.writeText(text)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      style={{ padding: '3px 9px', borderRadius: '8px', border: '1px solid #dbe3ef', background: '#fff', color: copied ? '#2e7d5b' : '#667085', fontSize: '11px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
    >
      {copied ? '已复制' : '复制'}
    </button>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #dbe3ef', borderRadius: '14px', padding: '16px 20px', minWidth: '112px', boxShadow: '0 8px 24px rgba(16,24,40,0.04)' }}>
      <div style={{ fontSize: '24px', fontWeight: 700, color: accent ?? '#101828', letterSpacing: 0 }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#667085', marginTop: '4px' }}>{label}</div>
    </div>
  )
}

function ImagePreview({ asset }: { asset: AssetItem }) {
  const url = bestUrl(asset)
  if (!url) {
    return (
      <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f2f6fb', color: '#98a2b3', fontSize: '12px' }}>
        暂无预览
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={asset.title ?? asset.name}
      style={{ display: 'block', width: '100%', height: '180px', objectFit: 'cover', background: '#f2f6fb' }}
    />
  )
}

function VideoPreview({ asset }: { asset: AssetItem }) {
  const url = bestUrl(asset)
  if (!url) {
    return (
      <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff7ed', color: '#98a2b3', fontSize: '12px' }}>
        暂无预览
      </div>
    )
  }
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      src={url}
      controls
      playsInline
      preload="metadata"
      style={{ display: 'block', width: '100%', height: '180px', objectFit: 'cover', background: '#101828' }}
    />
  )
}

function VisibilityToggle({ asset, onToggled }: { asset: AssetItem; onToggled: (id: string, next: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !asset.isPublic }),
      })
      if (res.ok) onToggled(asset.id, !asset.isPublic)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      type="button"
      onClick={(e) => { void toggle(e) }}
      disabled={busy}
      title={asset.isPublic ? '设为私有' : '设为公开'}
      style={{
        padding: '2px 8px',
        borderRadius: '8px',
        border: '1px solid #dbe3ef',
        background: asset.isPublic ? '#ecfdf3' : '#f8fafc',
        color: asset.isPublic ? '#2e7d5b' : '#667085',
        fontSize: '10px',
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.5 : 1,
        whiteSpace: 'nowrap',
        fontWeight: 500,
      }}
    >
      {busy ? '…' : asset.isPublic ? '🌐 公开' : '🔒 私有'}
    </button>
  )
}

function AssetCard({ asset, onPublicToggled }: { asset: AssetItem; onPublicToggled: (id: string, next: boolean) => void }) {
  const url = bestUrl(asset)
  const preview = promptPreview(asset.prompt)
  const bytes = formatBytes(asset.sizeBytes)
  const dur = formatDuration(asset.duration)
  const wh = asset.width && asset.height ? `${asset.width}×${asset.height}` : null

  return (
    <article
      style={{
        background: '#fff',
        border: '1px solid #dbe3ef',
        borderRadius: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: '0 10px 30px rgba(16,24,40,0.05)',
      }}
    >
      {/* Media preview */}
      {asset.type === 'IMAGE' ? <ImagePreview asset={asset} /> : null}
      {asset.type === 'VIDEO' ? <VideoPreview asset={asset} /> : null}

      {/* Card body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        {/* Top row: type chip + visibility + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <TypeChip type={asset.type} />
          {dur ? <span style={{ fontSize: '11px', color: '#667085', background: '#f2f4f7', padding: '2px 6px', borderRadius: '6px' }}>{dur}</span> : null}
          <VisibilityToggle asset={asset} onToggled={onPublicToggled} />
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#98a2b3', flexShrink: 0 }}>{formatDate(asset.createdAt)}</span>
        </div>

        {/* Title */}
        {asset.title || asset.name ? (
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 650, color: '#101828', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {asset.title ?? asset.name}
          </p>
        ) : null}

        {/* Prompt preview */}
        {preview ? (
          <p style={{ margin: 0, fontSize: '12px', color: '#667085', lineHeight: '1.5', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {preview}
          </p>
        ) : null}

        {/* Meta row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {asset.providerId ? (
            <div style={{ fontSize: '11px', color: '#667085' }}>
              <span style={{ color: '#98a2b3' }}>Provider </span>{asset.providerId}
            </div>
          ) : null}
          {wh || bytes ? (
            <div style={{ fontSize: '11px', color: '#667085' }}>
              {[wh, bytes].filter(Boolean).join(' · ')}
            </div>
          ) : null}
          {asset.project ? (
            <div style={{ fontSize: '11px', color: '#667085' }}>
              <span style={{ color: '#98a2b3' }}>项目 </span>{asset.project.title}
            </div>
          ) : null}
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid #edf1f7' }}>
          <a
            href={`/assets/${asset.id}`}
            style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid #c8d7ee', background: '#e8f0ff', color: '#2563eb', fontSize: '11px', textDecoration: 'none', whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            详情
          </a>
          {url ? (
            <>
              <CopyButton text={url} label="复制 URL" />
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{ padding: '3px 9px', borderRadius: '8px', border: '1px solid #dbe3ef', background: '#fff', color: '#667085', fontSize: '11px', textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                打开 ↗
              </a>
            </>
          ) : null}
          {asset.generationJobId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
              <code style={{ fontFamily: 'ui-monospace,monospace', fontSize: '10px', color: '#98a2b3' }}>
                {shortId(asset.generationJobId)}
              </code>
              <CopyButton text={asset.generationJobId} label="复制任务 ID" />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

// ─── Filter options ───────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'IMAGE', label: '图片' },
  { value: 'VIDEO', label: '视频' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '80' })
      if (typeFilter) params.set('type', typeFilter)
      const res = await fetch(`/api/assets?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const data: ApiResponse = await res.json() as ApiResponse
      if (res.status === 401) {
        setError('请先登录后查看资产。')
        setAssets([])
        return
      }
      if (res.status === 503 || data.errorCode === 'SERVICE_UNAVAILABLE') {
        setError('服务暂时不可用，请稍后重试。')
        setAssets([])
        return
      }
      if (!res.ok) {
        setError(data.message ?? data.errorCode ?? '加载资产失败')
        setAssets([])
        return
      }
      setAssets(data.assets ?? [])
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => { void fetchAssets() }, [fetchAssets])

  // Client-side search filter on prompt / title / name
  const searchLower = search.trim().toLowerCase()
  const displayed = searchLower
    ? assets.filter((a) =>
        (a.prompt ?? '').toLowerCase().includes(searchLower)
        || (a.title ?? '').toLowerCase().includes(searchLower)
        || a.name.toLowerCase().includes(searchLower)
      )
    : assets

  // Stats (over all loaded assets, ignoring type/search filter for stat cards)
  const [allAssets, setAllAssets] = useState<AssetItem[]>([])
  useEffect(() => { if (!typeFilter) setAllAssets(assets) }, [assets, typeFilter])
  const statsSource = allAssets.length > 0 ? allAssets : assets
  const stats = {
    total: statsSource.length,
    images: statsSource.filter((a) => a.type === 'IMAGE').length,
    videos: statsSource.filter((a) => a.type === 'VIDEO').length,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fb', color: '#101828', fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,sans-serif' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '16px', padding: '0 32px', height: '60px', background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid #dbe3ef' }}>
        <a href="/community" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#667085', textDecoration: 'none', padding: '5px 9px', borderRadius: '7px' }}>
          ← 社群
        </a>
        <div style={{ width: '1px', height: '16px', background: '#dbe3ef' }} />
        <a href="/create" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#2563eb', textDecoration: 'none', padding: '6px 10px', borderRadius: '9px', border: '1px solid #c8d7ee', background: '#e8f0ff' }}>
          ← 返回画布
        </a>
        <div style={{ width: '1px', height: '20px', background: '#dbe3ef' }} />
        <h1 style={{ fontSize: '14px', fontWeight: 650, color: '#101828', margin: 0 }}>Gallery · 资产中心</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#98a2b3' }}>只读 · 不触发生成</span>
          <button
            type="button"
            onClick={() => { void fetchAssets() }}
            disabled={loading}
            style={{ padding: '6px 12px', borderRadius: '9px', border: '1px solid #dbe3ef', background: '#fff', color: '#475467', fontSize: '12px', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? '加载中…' : '刷新'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '1180px', margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* Title */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#101828', margin: '0 0 8px', letterSpacing: 0 }}>资产中心</h2>
          <p style={{ fontSize: '14px', color: '#667085', margin: 0 }}>集中管理已生成图片、视频与可复用创作素材</p>
        </div>

        {/* Stats */}
        {!loading && !error ? (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '32px' }}>
            <StatCard label="全部资产" value={stats.total} />
            <StatCard label="图片资产" value={stats.images} accent={stats.images > 0 ? '#2563eb' : undefined} />
            <StatCard label="视频资产" value={stats.videos} accent={stats.videos > 0 ? '#c2410c' : undefined} />
          </div>
        ) : null}

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'center', border: '1px solid #dbe3ef', background: '#fff', borderRadius: '16px', padding: '12px', boxShadow: '0 8px 24px rgba(16,24,40,0.04)' }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={SELECT_STYLE} aria-label="按类型筛选">
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 prompt / 标题…"
            style={{ ...SELECT_STYLE, minWidth: '200px', flex: 1, maxWidth: '320px' }}
            aria-label="搜索资产"
          />
          {displayed.length > 0 ? (
            <span style={{ fontSize: '12px', color: '#667085', marginLeft: 'auto' }}>
              显示 {displayed.length} 条
            </span>
          ) : null}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#667085', fontSize: '14px' }}>
            加载中…
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', gap: '12px' }}>
            <div style={{ fontSize: '14px', color: '#b42318' }}>无法读取资产列表，请稍后重试</div>
            <div style={{ fontSize: '12px', color: '#667085' }}>{error}</div>
            <button
              type="button"
              onClick={() => { void fetchAssets() }}
              style={{ marginTop: '8px', padding: '8px 16px', borderRadius: '10px', border: '1px solid #c8d7ee', background: '#e8f0ff', color: '#2563eb', fontSize: '13px', cursor: 'pointer' }}
            >
              重试
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', gap: '8px' }}>
            <div style={{ fontSize: '14px', color: '#667085' }}>暂无资产</div>
            <div style={{ fontSize: '12px', color: '#98a2b3' }}>
              {typeFilter || search ? '当前筛选条件下没有匹配的资产' : '请先在画布生成图片或视频，资产将自动出现在这里'}
            </div>
            <a
              href="/create"
              style={{ marginTop: '12px', padding: '8px 18px', borderRadius: '10px', border: '1px solid #c8d7ee', background: '#e8f0ff', color: '#2563eb', fontSize: '13px', textDecoration: 'none' }}
            >
              去画布生成 →
            </a>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {displayed.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onPublicToggled={(id, next) => {
                    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, isPublic: next } : a))
                  }}
                />
              ))}
          </div>
        )}
      </main>
    </div>
  )
}
