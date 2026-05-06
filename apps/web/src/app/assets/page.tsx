'use client'

import { useEffect, useRef, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'

type AssetItem = {
  id: string
  name: string
  title?: string | null
  projectId?: string | null
  type: string
  url: string
  dataUrl?: string | null
  mimeType: string
  sizeBytes?: number | null
  providerId?: string | null
  metadata?: unknown
  metadataJson?: unknown
  createdAt: string
  project?: { id: string; title: string } | null
}

type ProjectItem = {
  id: string
  title: string
}

function assetTypeLabel(type: string) {
  if (type === 'IMAGE') return '图片'
  if (type === 'VIDEO') return '视频'
  if (type === 'AUDIO') return '音频'
  if (type === 'SCRIPT') return '文本'
  return '文档'
}

function getAssetContentText(asset: AssetItem) {
  const metadata = asset.metadataJson && typeof asset.metadataJson === 'object'
    ? asset.metadataJson as Record<string, unknown>
    : asset.metadata && typeof asset.metadata === 'object'
      ? asset.metadata as Record<string, unknown>
      : {}
  return typeof metadata.contentText === 'string' ? metadata.contentText : null
}

function formatBytes(size?: number | null) {
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export default function AssetsPage() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [bindingAssetId, setBindingAssetId] = useState<string | null>(null)
  const [openPickerAssetId, setOpenPickerAssetId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null)

  async function loadAssets() {
    setLoading(true)
    try {
      const response = await fetch('/api/assets', {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const data = await response.json().catch(() => ({})) as { assets?: AssetItem[]; message?: string }
      if (response.status === 401) {
        setMessage({ type: 'error', text: '请先登录后查看素材。' })
        setAssets([])
        return
      }
      if (!response.ok) throw new Error(data.message ?? '加载素材失败')
      setAssets(data.assets ?? [])
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '加载素材失败' })
    } finally {
      setLoading(false)
    }
  }

  async function loadProjects() {
    try {
      const response = await fetch('/api/projects?scope=owned&limit=20', {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const data = await response.json().catch(() => ({})) as { projects?: ProjectItem[] }
      if (response.ok) setProjects(data.projects ?? [])
    } catch (error) {
      console.warn('[assets] failed to load projects', error)
    }
  }

  useEffect(() => {
    void loadAssets()
    void loadProjects()
  }, [])

  async function bindAsset(assetId: string, projectId: string | null) {
    setBindingAssetId(assetId)
    setMessage(null)
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}`, {
        method: 'PATCH',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await response.json().catch(() => ({})) as {
        success?: boolean
        asset?: AssetItem
        errorCode?: string
        message?: string
      }
      if (!response.ok || !data.success || !data.asset) {
        throw new Error(`${data.errorCode ? `[${data.errorCode}] ` : ''}${data.message ?? '绑定项目失败'}`)
      }
      setAssets((current) => current.map((asset) => asset.id === assetId ? data.asset! : asset))
      setOpenPickerAssetId(null)
      setMessage({ type: 'success', text: projectId ? '素材已绑定项目。' : '素材已取消项目关联。' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '绑定项目失败' })
    } finally {
      setBindingAssetId(null)
    }
  }

  async function uploadFile(file: File) {
    setUploading(true)
    setMessage({ type: 'info', text: '正在上传素材...' })
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('title', file.name)
      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        body: formData,
      })
      const data = await response.json().catch(() => ({})) as {
        success?: boolean
        asset?: AssetItem
        errorCode?: string
        message?: string
      }
      if (!response.ok || !data.success || !data.asset) {
        const text = data.errorCode === 'STORAGE_NOT_CONFIGURED'
          ? '对象存储未配置，请在 /admin/china 配置 OSS/COS。'
          : `${data.errorCode ? `[${data.errorCode}] ` : ''}${data.message ?? '上传素材失败'}`
        throw new Error(text)
      }
      setAssets((current) => [data.asset!, ...current.filter((asset) => asset.id !== data.asset!.id)])
      setMessage({ type: 'success', text: '素材已上传。' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '上传素材失败' })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <DashboardShell>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">素材库</h1>
            <p className="mt-2 text-sm text-white/50">自动保存的生成结果和上传素材，可加入项目交付链接。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void uploadFile(file)
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? '上传中...' : '上传素材'}
            </button>
            <a href="/create" className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-white/75 hover:border-white/20 hover:text-white">
              去生成
            </a>
          </div>
        </div>

        {message ? (
          <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
            message.type === 'error'
              ? 'border-red-400/25 bg-red-400/10 text-red-200'
              : message.type === 'success'
                ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
                : 'border-sky-400/25 bg-sky-400/10 text-sky-100'
          }`}>
            {message.text}
          </div>
        ) : null}

        {loading ? (
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/45">
            正在加载素材...
          </section>
        ) : assets.length === 0 ? (
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-8 text-center">
            <h2 className="text-base font-semibold text-white">还没有素材</h2>
            <p className="mt-2 text-sm text-white/45">生成文本、图片或上传文件后，素材会出现在这里。</p>
          </section>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => {
              const contentText = getAssetContentText(asset)
              const previewUrl = asset.url || asset.dataUrl || ''
              return (
                <article key={asset.id} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                  {asset.type === 'IMAGE' && previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt={asset.title ?? asset.name} className="h-48 w-full object-cover" />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-white/[0.04] px-5 text-sm leading-6 text-white/55">
                      <p className="line-clamp-6 whitespace-pre-wrap">{contentText ?? asset.name}</p>
                    </div>
                  )}
                  <div className="p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-xs text-sky-200">{assetTypeLabel(asset.type)}</span>
                      <span className="text-xs text-white/35">{new Date(asset.createdAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <h2 className="line-clamp-2 text-sm font-semibold text-white">{asset.title ?? asset.name}</h2>
                    <p className="mt-2 text-xs text-white/40">
                      {asset.project ? `项目：${asset.project.title}` : '未关联项目'}
                      {formatBytes(asset.sizeBytes) ? ` · ${formatBytes(asset.sizeBytes)}` : ''}
                    </p>
                    {asset.providerId ? <p className="mt-1 text-xs text-white/25">Provider: {asset.providerId}</p> : null}
                    <div className="mt-3">
                      {openPickerAssetId === asset.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={asset.project?.id ?? ''}
                            disabled={bindingAssetId === asset.id}
                            onChange={(event) => void bindAsset(asset.id, event.target.value || null)}
                            className="min-w-0 flex-1 rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white disabled:opacity-50"
                          >
                            <option value="">未关联项目</option>
                            {projects.map((project) => (
                              <option key={project.id} value={project.id}>{project.title}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setOpenPickerAssetId(null)}
                            className="rounded-md border border-white/10 px-2 py-1.5 text-xs text-white/65 hover:border-white/25 hover:text-white"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setOpenPickerAssetId(asset.id)}
                          className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/75 hover:border-white/25 hover:text-white"
                        >
                          绑定项目
                        </button>
                      )}
                      {openPickerAssetId === asset.id && projects.length === 0 ? (
                        <p className="mt-2 text-xs text-white/35">暂无可绑定项目。</p>
                      ) : null}
                    </div>
                    {previewUrl && asset.type !== 'IMAGE' ? (
                      <a href={previewUrl} className="mt-3 inline-flex text-xs font-semibold text-cyan-200 underline" target="_blank" rel="noreferrer">
                        打开文件
                      </a>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </DashboardShell>
  )
}
