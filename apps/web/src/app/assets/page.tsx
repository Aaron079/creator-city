'use client'

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import ChromaGrid, { type ChromaItem } from '@/components/assets/ChromaGrid'

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

function bestUrl(asset: AssetItem): string {
  return asset.resolvedUrl || asset.url || asset.dataUrl || ''
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(sec?: number | null) {
  if (!sec) return null
  if (sec < 60) return `${sec.toFixed(0)}s`
  return `${Math.floor(sec / 60)}m${Math.floor(sec % 60)}s`
}

function shortId(id: string) {
  return id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
}

function assetTitle(asset: AssetItem) {
  return asset.title || asset.name || `Asset ${shortId(asset.id)}`
}

function assetKindLabel(asset: AssetItem) {
  if (asset.type === 'IMAGE') return 'AI Image'
  if (asset.type === 'VIDEO') return 'Video Asset'
  if (asset.type === 'AUDIO') return 'Audio Asset'
  return 'Creative Asset'
}

function placeholderImage(asset: AssetItem, index: number) {
  const palettes = [
    ['#111827', '#2563eb', '#67e8f9'],
    ['#140f1f', '#a855f7', '#f472b6'],
    ['#101816', '#10b981', '#d9f99d'],
    ['#191308', '#f59e0b', '#fde68a'],
    ['#180d16', '#ef4444', '#f0abfc'],
    ['#07151f', '#06b6d4', '#93c5fd'],
  ]
  const [a, b, c] = palettes[index % palettes.length] ?? palettes[0]!
  const title = assetKindLabel(asset)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${a}"/>
          <stop offset="54%" stop-color="${b}"/>
          <stop offset="100%" stop-color="${c}"/>
        </linearGradient>
        <radialGradient id="glow" cx="62%" cy="36%" r="55%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity=".42"/>
          <stop offset="52%" stop-color="#ffffff" stop-opacity=".08"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="720" height="720" fill="url(#bg)"/>
      <rect x="58" y="72" width="604" height="576" rx="54" fill="#030407" opacity=".22" stroke="#fff" stroke-opacity=".22"/>
      <path d="M112 520 C206 400 270 430 366 304 C450 194 526 214 612 130" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".44"/>
      <circle cx="220" cy="415" r="10" fill="#fff" opacity=".78"/>
      <circle cx="494" cy="245" r="10" fill="#fff" opacity=".78"/>
      <rect width="720" height="720" fill="url(#glow)"/>
      <text x="72" y="610" fill="#fff" opacity=".82" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="700">${title}</text>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function previewImage(asset: AssetItem, index: number) {
  if (asset.type === 'IMAGE') return bestUrl(asset) || placeholderImage(asset, index)
  if (asset.thumbnailUrl) return asset.thumbnailUrl
  return placeholderImage(asset, index)
}

const CHROMA_PALETTES = [
  { borderColor: '#4f46e5', gradient: 'linear-gradient(145deg, rgba(79, 70, 229, 0.62), #06050a 72%)' },
  { borderColor: '#10b981', gradient: 'linear-gradient(210deg, rgba(16, 185, 129, 0.56), #050708 72%)' },
  { borderColor: '#f59e0b', gradient: 'linear-gradient(165deg, rgba(245, 158, 11, 0.52), #070604 72%)' },
  { borderColor: '#ef4444', gradient: 'linear-gradient(195deg, rgba(239, 68, 68, 0.48), #080507 72%)' },
  { borderColor: '#8b5cf6', gradient: 'linear-gradient(225deg, rgba(139, 92, 246, 0.56), #06040b 72%)' },
  { borderColor: '#06b6d4', gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.5), #04080a 72%)' },
]

function toChromaItem(asset: AssetItem, index: number): ChromaItem {
  const dur = formatDuration(asset.duration)
  const size = asset.width && asset.height ? `${asset.width} × ${asset.height}` : asset.status ?? 'READY'
  const palette = CHROMA_PALETTES[index % CHROMA_PALETTES.length] ?? CHROMA_PALETTES[0]!
  const visibility = asset.isPublic ? 'Public' : 'Private'
  const project = asset.project?.title ? `@${asset.project.title}` : `#${shortId(asset.id)}`

  return {
    image: previewImage(asset, index),
    title: assetTitle(asset),
    subtitle: [assetKindLabel(asset), dur ?? size].filter(Boolean).join(' · '),
    handle: project,
    location: `${visibility} · ${formatDate(asset.createdAt)}`,
    borderColor: palette.borderColor,
    gradient: palette.gradient,
    url: `/assets/${asset.id}`,
  }
}

const SELECT_STYLE: CSSProperties = {
  padding: '11px 12px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.07)',
  color: '#f8f5ff',
  fontSize: '14px',
  cursor: 'pointer',
  outline: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
}

const TYPE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  IMAGE: { label: '图片', bg: 'rgba(96,165,250,0.16)', color: '#bfdbfe' },
  VIDEO: { label: '视频', bg: 'rgba(251,146,60,0.16)', color: '#fed7aa' },
  AUDIO: { label: '音频', bg: 'rgba(52,211,153,0.16)', color: '#bbf7d0' },
  SCRIPT: { label: '文本', bg: 'rgba(226,232,240,0.12)', color: '#cbd5e1' },
  DOCUMENT: { label: '文件', bg: 'rgba(226,232,240,0.12)', color: '#cbd5e1' },
}

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'IMAGE', label: '图片' },
  { value: 'VIDEO', label: '视频' },
]

function TypeChip({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] ?? { label: type, bg: 'rgba(226,232,240,0.12)', color: '#cbd5e1' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 26, padding: '0 10px', borderRadius: 999, fontSize: 12, fontWeight: 650, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ minWidth: 126, padding: '16px 18px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)', background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.045))', boxShadow: '0 18px 45px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.10)' }}>
      <div style={{ fontSize: 26, fontWeight: 720, color: accent ?? '#f8f5ff', letterSpacing: 0 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(248,245,255,0.55)', marginTop: 5 }}>{label}</div>
    </div>
  )
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [allAssets, setAllAssets] = useState<AssetItem[]>([])

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
      const data = await res.json() as ApiResponse
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
  useEffect(() => { if (!typeFilter) setAllAssets(assets) }, [assets, typeFilter])

  const displayed = useMemo(() => {
    const searchLower = search.trim().toLowerCase()
    if (!searchLower) return assets
    return assets.filter((asset) =>
      (asset.prompt ?? '').toLowerCase().includes(searchLower)
      || (asset.title ?? '').toLowerCase().includes(searchLower)
      || asset.name.toLowerCase().includes(searchLower)
      || (asset.project?.title ?? '').toLowerCase().includes(searchLower)
    )
  }, [assets, search])

  const statsSource = allAssets.length > 0 ? allAssets : assets
  const stats = {
    total: statsSource.length,
    images: statsSource.filter((asset) => asset.type === 'IMAGE').length,
    videos: statsSource.filter((asset) => asset.type === 'VIDEO').length,
  }
  const chromaItems = displayed.map(toChromaItem)

  return (
    <div style={{ minHeight: '100vh', background: '#0b0710', color: '#f8f5ff', fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,sans-serif', overflowX: 'hidden' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 18% 12%, rgba(236,72,153,0.18), transparent 24%), radial-gradient(circle at 78% 8%, rgba(79,70,229,0.20), transparent 28%), radial-gradient(circle at 50% 92%, rgba(20,184,166,0.14), transparent 30%), linear-gradient(180deg, #120d19 0%, #08060b 48%, #050407 100%)' }} />

      <header style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 14, padding: '0 32px', height: 66, background: 'rgba(10,7,14,0.72)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
        <a href="/community" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(248,245,255,0.64)', textDecoration: 'none', padding: '7px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.10)' }}>
          ← 社群
        </a>
        <a href="/create" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#fff', textDecoration: 'none', padding: '8px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)' }}>
          AI Canvas
        </a>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)' }} />
        <h1 style={{ fontSize: 14, fontWeight: 650, color: '#fff', margin: 0 }}>作品展示</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'rgba(248,245,255,0.42)' }}>Gallery · Assets</span>
          <button
            type="button"
            onClick={() => { void fetchAssets() }}
            disabled={loading}
            style={{ padding: '8px 13px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: 'rgba(248,245,255,0.84)', fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? '加载中…' : '刷新'}
          </button>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 1480, margin: '0 auto', padding: '34px 28px 96px' }}>
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'end', gap: 24, marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: 'clamp(32px, 4.6vw, 58px)', lineHeight: 0.96, letterSpacing: 0, fontWeight: 760 }}>作品展示</h2>
            <p style={{ margin: 0, maxWidth: 720, color: 'rgba(248,245,255,0.58)', fontSize: 14, lineHeight: 1.65 }}>
              以作品墙方式浏览图片、视频与可复用资产。鼠标移动会唤醒局部色彩，点击卡片进入资产详情。
            </p>
          </div>
          {!loading && !error ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <StatCard label="全部资产" value={stats.total} />
              <StatCard label="图片资产" value={stats.images} accent="#93c5fd" />
              <StatCard label="视频资产" value={stats.videos} accent="#fdba74" />
            </div>
          ) : null}
        </section>

        <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.045)', borderRadius: 22, padding: 12, boxShadow: '0 20px 70px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={SELECT_STYLE} aria-label="按类型筛选">
            {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索 prompt / 标题 / 项目…"
            style={{ ...SELECT_STYLE, minWidth: 220, flex: 1, maxWidth: 420 }}
            aria-label="搜索资产"
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {typeFilter ? <TypeChip type={typeFilter} /> : <span style={{ color: 'rgba(248,245,255,0.50)', fontSize: 12, alignSelf: 'center' }}>全部类型</span>}
            {displayed.length > 0 ? <span style={{ color: 'rgba(248,245,255,0.50)', fontSize: 12, alignSelf: 'center' }}>显示 {displayed.length} 条</span> : null}
          </div>
        </section>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 420, color: 'rgba(248,245,255,0.58)', fontSize: 14 }}>
            加载中…
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 420, justifyContent: 'center', gap: 12, borderRadius: 28, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.045)' }}>
            <div style={{ fontSize: 15, color: '#fca5a5' }}>无法读取资产列表，请稍后重试</div>
            <div style={{ fontSize: 12, color: 'rgba(248,245,255,0.52)' }}>{error}</div>
            <button
              type="button"
              onClick={() => { void fetchAssets() }}
              style={{ marginTop: 8, padding: '9px 18px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.09)', color: '#fff', fontSize: 13, cursor: 'pointer' }}
            >
              重试
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 420, justifyContent: 'center', gap: 10, borderRadius: 28, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.045)' }}>
            <div style={{ fontSize: 15, color: 'rgba(248,245,255,0.72)' }}>暂无资产</div>
            <div style={{ fontSize: 12, color: 'rgba(248,245,255,0.44)' }}>
              {typeFilter || search ? '当前筛选条件下没有匹配的资产' : '请先在画布生成图片或视频，资产将自动出现在这里'}
            </div>
            <a href="/create" style={{ marginTop: 12, padding: '10px 18px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)', background: '#fff', color: '#09070c', fontSize: 13, textDecoration: 'none', fontWeight: 650 }}>
              去画布生成
            </a>
          </div>
        ) : (
          <ChromaGrid items={chromaItems} columns={3} rows={Math.ceil(chromaItems.length / 3)} radius={360} />
        )}
      </main>
    </div>
  )
}
