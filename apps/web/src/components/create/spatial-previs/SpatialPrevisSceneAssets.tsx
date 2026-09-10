'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageIcon, Loader2, Plus, Upload, Video, X } from 'lucide-react'
import type { ProjectAssetItem } from '@/components/create/ProjectAssetsPanel'
import { normalizeAssetType } from '@/lib/assets/normalize'
import { getLocalImportDisplayUrl } from '@/lib/canvas/localImageImport'
import { isRenderableMediaUrl } from '@/lib/media/renderable-url'
import type { SpatialSceneReference } from '@/lib/spatial-previs/types'

type AssetsResponse = {
  success?: boolean
  assets?: ProjectAssetItem[]
  message?: string
  errorCode?: string
}

type SpatialPrevisSceneAssetsProps = {
  projectId: string
  references: readonly SpatialSceneReference[]
  disabled: boolean
  onReferencesChange: (references: SpatialSceneReference[]) => void
  onUpload: (file: File) => Promise<SpatialSceneReference>
}

function sceneAssetTitle(asset: Pick<ProjectAssetItem, 'title' | 'name'>) {
  return asset.title?.trim() || asset.name?.trim() || '未命名素材'
}

function isValidSceneReference(reference: SpatialSceneReference) {
  return Boolean(
    reference.id.trim()
    && reference.assetId.trim()
    && reference.title.trim()
    && isRenderableMediaUrl(reference.url).ok,
  )
}

export function spatialSceneReferenceFromProjectAsset(asset: ProjectAssetItem): SpatialSceneReference | null {
  const assetId = asset.id.trim()
  const mediaType = normalizeAssetType(asset.normalizedType || asset.type)
  const rawUrl = asset.url?.trim() || asset.dataUrl?.trim() || ''
  if (!assetId || (mediaType !== 'image' && mediaType !== 'video') || !rawUrl) return null

  const url = getLocalImportDisplayUrl({ id: assetId, url: rawUrl })
  if (!isRenderableMediaUrl(url).ok) return null

  return {
    id: `scene-project-${assetId}`,
    assetId,
    title: sceneAssetTitle(asset),
    mediaType,
    url,
    source: 'project',
  }
}

export function addSpatialSceneReference(
  references: readonly SpatialSceneReference[],
  reference: SpatialSceneReference,
): SpatialSceneReference[] {
  if (!isValidSceneReference(reference) || references.some((item) => item.id === reference.id || item.assetId === reference.assetId)) {
    return references as SpatialSceneReference[]
  }
  return [...references, reference]
}

export function removeSpatialSceneReference(
  references: readonly SpatialSceneReference[],
  referenceId: string,
): SpatialSceneReference[] {
  return references.filter((reference) => reference.id !== referenceId)
}

export function SpatialPrevisSceneAssets({
  projectId,
  references,
  disabled,
  onReferencesChange,
  onUpload,
}: SpatialPrevisSceneAssetsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [assets, setAssets] = useState<ProjectAssetItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isOpen || !projectId) return

    const controller = new AbortController()
    async function loadAssets() {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/assets?projectId=${encodeURIComponent(projectId)}&includeUnbound=1`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        const raw = await response.text()
        let data: AssetsResponse = {}
        try {
          data = raw ? JSON.parse(raw) as AssetsResponse : {}
        } catch {
          data = { success: false, message: '素材接口返回了非 JSON 响应。' }
        }
        if (!response.ok || data.success === false) {
          throw new Error(data.message || data.errorCode || '素材加载失败。')
        }
        if (!controller.signal.aborted) setAssets(data.assets ?? [])
      } catch (caught) {
        if (!controller.signal.aborted) {
          setAssets([])
          setError(caught instanceof Error ? caught.message : '素材加载失败。')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadAssets()
    return () => controller.abort()
  }, [isOpen, projectId])

  const projectMediaAssets = useMemo(() => assets
    .filter((asset) => asset.projectId === projectId)
    .map(spatialSceneReferenceFromProjectAsset)
    .filter((reference): reference is SpatialSceneReference => reference !== null), [assets, projectId])

  const selectReference = (reference: SpatialSceneReference) => {
    if (disabled) return
    const next = addSpatialSceneReference(references, reference)
    if (next !== references) onReferencesChange(next)
  }

  const removeReference = (referenceId: string) => {
    if (disabled) return
    onReferencesChange(removeSpatialSceneReference(references, referenceId))
  }

  const uploadFile = async (file: File | undefined) => {
    if (!file || disabled || isUploading) return
    setIsUploading(true)
    setError(null)
    try {
      const reference = await onUpload(file)
      const next = addSpatialSceneReference(references, reference)
      if (next !== references) onReferencesChange(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '上传失败。')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <section className="border-b border-white/[0.08] pb-3" aria-label="场景资产">
      <button
        type="button"
        aria-label="添加场景资产"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.035] px-2 py-1.5 text-[11px] font-medium text-white/78 transition hover:border-indigo-200/35 hover:bg-indigo-300/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Plus size={13} aria-hidden="true" />
        Scene assets
      </button>

      <div hidden={!isOpen} className="mt-2 space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          className="sr-only"
          onChange={(event) => {
            void uploadFile(event.currentTarget.files?.[0])
            event.currentTarget.value = ''
          }}
        />
        <div
          data-scene-asset-dropzone="true"
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (!disabled) setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragOver(false)
            void uploadFile(event.dataTransfer.files[0])
          }}
          className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 border border-dashed px-3 py-2 text-[11px] transition ${isDragOver ? 'border-indigo-200/60 bg-indigo-300/[0.1] text-indigo-50' : 'border-white/15 bg-black/15 text-white/55'} ${disabled || isUploading ? 'cursor-not-allowed opacity-45' : 'hover:border-white/30 hover:text-white/75'}`}
        >
          {isUploading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
          <span>{isUploading ? '上传中…' : '拖放或选择图片 / 视频'}</span>
        </div>

        {error ? <p role="alert" className="text-[11px] text-amber-200/85">{error}</p> : null}

        {references.length > 0 ? (
          <ul className="space-y-1" aria-label="已选场景资产">
            {references.map((reference) => (
              <li key={reference.id} className="flex min-w-0 items-center gap-2 border border-white/[0.08] bg-white/[0.025] px-2 py-1.5">
                {reference.mediaType === 'video' ? <Video size={13} className="shrink-0 text-white/55" aria-hidden="true" /> : <ImageIcon size={13} className="shrink-0 text-white/55" aria-hidden="true" />}
                <span className="min-w-0 flex-1 truncate text-[11px] text-white/72">{reference.title}</span>
                <button
                  type="button"
                  aria-label={`移除场景资产 ${reference.title}`}
                  disabled={disabled}
                  onClick={() => removeReference(reference.id)}
                  className="shrink-0 p-1 text-white/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="max-h-32 space-y-1 overflow-y-auto pr-1" aria-label="项目图片和视频素材">
          {isLoading ? (
            <p className="flex items-center gap-1.5 py-1 text-[11px] text-white/45"><Loader2 size={13} className="animate-spin" /> 加载素材中…</p>
          ) : projectMediaAssets.length > 0 ? projectMediaAssets.map((reference) => (
            <button
              key={reference.id}
              type="button"
              disabled={disabled || references.some((item) => item.assetId === reference.assetId)}
              onClick={() => selectReference(reference)}
              className="flex w-full min-w-0 items-center gap-2 border border-white/[0.08] px-2 py-1.5 text-left text-[11px] text-white/65 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {reference.mediaType === 'video' ? <Video size={13} className="shrink-0" aria-hidden="true" /> : <ImageIcon size={13} className="shrink-0" aria-hidden="true" />}
              <span className="truncate">{reference.title}</span>
            </button>
          )) : (
            <p className="py-1 text-[11px] text-white/38">没有可用的项目图片或视频素材。</p>
          )}
        </div>
      </div>
    </section>
  )
}
