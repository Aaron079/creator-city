'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileText, ImageIcon, LinkIcon, Loader2, Music, Search, Video, X } from 'lucide-react'
import { normalizeAssetType } from '@/lib/assets/normalize'

export interface ProjectAssetItem {
  id: string
  title?: string | null
  name?: string | null
  type: string
  normalizedType?: string | null
  url?: string | null
  dataUrl?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  projectId?: string | null
  providerId?: string | null
  createdAt?: string | Date | null
  metadataJson?: unknown
}

interface ProjectAssetsPanelProps {
  projectId: string
  onClose?: () => void
  onAddAssetToCanvas: (asset: ProjectAssetItem) => void
}

type AssetsResponse = {
  success?: boolean
  assets?: ProjectAssetItem[]
  message?: string
  errorCode?: string
}

function getAssetTitle(asset: ProjectAssetItem) {
  return asset.title?.trim() || asset.name?.trim() || '未命名素材'
}

function getAssetTypeLabel(type: string) {
  const normalized = normalizeAssetType(type)
  if (normalized === 'image') return '图片'
  if (normalized === 'script' || normalized === 'text') return '文本'
  if (normalized === 'video') return '视频'
  if (normalized === 'audio') return '音频'
  return '文件'
}

function getAssetIcon(type: string) {
  const normalized = normalizeAssetType(type)
  if (normalized === 'image') return ImageIcon
  if (normalized === 'script' || normalized === 'text') return FileText
  if (normalized === 'video') return Video
  if (normalized === 'audio') return Music
  return LinkIcon
}

function getAssetPreviewUrl(asset: ProjectAssetItem) {
  return asset.url || asset.dataUrl || ''
}

function formatAssetSize(sizeBytes?: number | null) {
  if (!sizeBytes) return ''
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
}

export function ProjectAssetsPanel({ projectId, onClose, onAddAssetToCanvas }: ProjectAssetsPanelProps) {
  const [assets, setAssets] = useState<ProjectAssetItem[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addingAssetId, setAddingAssetId] = useState('')

  useEffect(() => {
    if (!projectId) {
      setAssets([])
      setLoading(false)
      return
    }

    let cancelled = false
    async function loadAssets() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/assets?projectId=${encodeURIComponent(projectId)}&includeUnbound=1`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        const raw = await response.text()
        const data = raw ? JSON.parse(raw) as AssetsResponse : {}
        if (!response.ok || data.success === false) {
          throw new Error(data.message ?? data.errorCode ?? '素材加载失败。')
        }
        if (!cancelled) setAssets(data.assets ?? [])
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '素材加载失败。'
          setError(message)
          setAssets([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadAssets()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return assets
    return assets.filter((asset) => (
      getAssetTitle(asset).toLowerCase().includes(normalized)
      || asset.type.toLowerCase().includes(normalized)
      || asset.providerId?.toLowerCase().includes(normalized)
    ))
  }, [assets, query])

  const projectAssets = filteredAssets.filter((asset) => asset.projectId === projectId)
  const unboundAssets = filteredAssets.filter((asset) => asset.projectId !== projectId)

  async function handleAddAsset(asset: ProjectAssetItem) {
    if (addingAssetId) return
    setAddingAssetId(asset.id)
    setError('')
    try {
      let nextAsset = asset
      if (asset.projectId !== projectId) {
        const response = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ projectId }),
        })
        const raw = await response.text()
        const data = raw ? JSON.parse(raw) as { success?: boolean; asset?: ProjectAssetItem; message?: string; errorCode?: string } : {}
        if (!response.ok || data.success === false) {
          throw new Error(data.message ?? data.errorCode ?? '绑定素材失败。')
        }
        nextAsset = data.asset ? { ...data.asset, projectId } : { ...asset, projectId }
        setAssets((current) => current.map((item) => (item.id === asset.id ? nextAsset : item)))
      }
      onAddAssetToCanvas(nextAsset)
    } catch (err) {
      const message = err instanceof Error ? err.message : '加入画布失败。'
      setError(message)
    } finally {
      setAddingAssetId('')
    }
  }

  function renderAsset(asset: ProjectAssetItem) {
    const normalizedType = normalizeAssetType(asset.normalizedType || asset.type)
    const Icon = getAssetIcon(normalizedType)
    const title = getAssetTitle(asset)
    const previewUrl = getAssetPreviewUrl(asset)
    const isImage = normalizedType === 'image' && previewUrl
    const bound = asset.projectId === projectId
    const assetSize = formatAssetSize(asset.sizeBytes)
    return (
      <article key={asset.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
        <div className="flex gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-slate-950/70">
            {isImage ? (
              <img src={previewUrl} alt={title} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <Icon size={24} className="text-white/65" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{title}</div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-white/55">
              <span className="rounded border border-white/10 px-1.5 py-0.5">{getAssetTypeLabel(normalizedType)}</span>
              <span className="rounded border border-white/10 px-1.5 py-0.5">{asset.providerId || 'asset-library'}</span>
              {assetSize ? <span className="rounded border border-white/10 px-1.5 py-0.5">{assetSize}</span> : null}
            </div>
            <div className={`mt-2 text-[11px] ${bound ? 'text-emerald-300' : 'text-amber-200'}`}>
              {bound ? '已绑定到当前项目' : '未绑定素材'}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={addingAssetId === asset.id}
          onClick={() => { void handleAddAsset(asset) }}
        >
          {addingAssetId === asset.id ? '加入中...' : '加入画布'}
        </button>
      </article>
    )
  }

  const hasAssets = projectAssets.length > 0 || unboundAssets.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">项目素材</h2>
          <p className="mt-1 text-xs text-white/50">从素材库选择已绑定或未绑定素材加入画布。</p>
        </div>
        <button type="button" className="rounded-md border border-white/10 p-2 text-white/70 hover:border-white/25 hover:text-white" onClick={onClose} aria-label="关闭素材面板">
          <X size={18} />
        </button>
      </div>

      <label className="mt-4 flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white/70">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索素材"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
        />
      </label>

      {error ? (
        <div className="mt-3 rounded-md border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-100">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-white/55">
          <Loader2 size={18} className="animate-spin" />
          加载素材中...
        </div>
      ) : !hasAssets ? (
        <div className="mt-5 rounded-md border border-white/10 bg-white/[0.04] p-4">
          <div className="text-sm font-semibold text-white">当前项目还没有素材。</div>
          <div className="mt-1 text-xs leading-5 text-white/55">可以去素材库上传或绑定素材。</div>
        </div>
      ) : (
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          <section>
            <div className="mb-2 flex items-center justify-between text-xs text-white/50">
              <span>当前项目素材</span>
              <span>{projectAssets.length}</span>
            </div>
            <div className="grid gap-2">{projectAssets.map(renderAsset)}</div>
          </section>

          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-white/50">
              <span>未绑定素材</span>
              <span>{unboundAssets.length}</span>
            </div>
            <div className="grid gap-2">
              {unboundAssets.length > 0 ? unboundAssets.map(renderAsset) : (
                <div className="rounded-md border border-white/10 px-3 py-3 text-xs text-white/45">没有可加入的未绑定素材。</div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
