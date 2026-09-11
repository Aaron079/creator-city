'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageIcon, Loader2, Plus, Upload, Video, X } from 'lucide-react'
import type { ProjectAssetItem } from '@/components/create/ProjectAssetsPanel'
import { normalizeAssetType } from '@/lib/assets/normalize'
import { getLocalImportDisplayUrl } from '@/lib/canvas/localImageImport'
import { isRenderableMediaUrl } from '@/lib/media/renderable-url'
import type { SpatialAssetRole, SpatialAssetSet, SpatialSceneReference } from '@/lib/spatial-previs/types'

type AssetsResponse = {
  success?: boolean
  assets?: ProjectAssetItem[]
  message?: string
  errorCode?: string
}

type SpatialPrevisSceneAssetsProps = {
  projectId: string
  references: readonly SpatialSceneReference[]
  assetSets: readonly SpatialAssetSet[]
  disabled: boolean
  onReferencesChange: (references: SpatialSceneReference[]) => void
  onAddAssetSet: (references: readonly SpatialSceneReference[], role: SpatialAssetRole) => void
  onUpload: (file: File) => Promise<SpatialSceneReference>
  onUploadFiles?: (files: readonly File[]) => Promise<SpatialSceneReference[]>
  onUploadPending?: (isPending: boolean) => void
}

const ASSET_ROLES: Array<{ role: SpatialAssetRole; label: string }> = [
  { role: 'scene', label: '场景' },
  { role: 'character', label: '人物' },
  { role: 'prop', label: '道具' },
  { role: 'reference', label: '参考' },
]

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

function spatialSceneReferenceFromAsset(
  asset: ProjectAssetItem,
  source: Extract<SpatialSceneReference['source'], 'project' | 'library'>,
): SpatialSceneReference | null {
  const assetId = asset.id.trim()
  const mediaType = normalizeAssetType(asset.normalizedType || asset.type)
  const rawUrl = asset.url?.trim() || asset.dataUrl?.trim() || ''
  if (!assetId || (mediaType !== 'image' && mediaType !== 'video') || !rawUrl) return null

  const url = getLocalImportDisplayUrl({ id: assetId, url: rawUrl })
  if (!isRenderableMediaUrl(url).ok) return null

  return {
    id: `scene-${source}-${assetId}`,
    assetId,
    title: sceneAssetTitle(asset),
    mediaType,
    url,
    source,
  }
}

export function spatialSceneReferenceFromProjectAsset(asset: ProjectAssetItem): SpatialSceneReference | null {
  return spatialSceneReferenceFromAsset(asset, 'project')
}

export function spatialSceneReferenceFromLibraryAsset(asset: ProjectAssetItem): SpatialSceneReference | null {
  return spatialSceneReferenceFromAsset(asset, 'library')
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

export function mergeUploadedSpatialSceneReference(
  references: readonly SpatialSceneReference[],
  reference: SpatialSceneReference,
): SpatialSceneReference[] {
  return addSpatialSceneReference(references, reference)
}

export class SpatialSceneAssetUploadFailure extends Error {
  readonly uploadedReferences: SpatialSceneReference[]
  readonly remainingFiles: File[]

  constructor(caught: unknown, uploadedReferences: readonly SpatialSceneReference[], remainingFiles: readonly File[]) {
    super(caught instanceof Error ? caught.message : '上传失败。')
    this.name = 'SpatialSceneAssetUploadFailure'
    this.uploadedReferences = uploadedReferences.map((reference) => ({ ...reference }))
    this.remainingFiles = [...remainingFiles]
  }
}

export async function uploadSceneAssetFiles(
  files: readonly File[],
  upload: (file: File) => Promise<SpatialSceneReference>,
) {
  const references: SpatialSceneReference[] = []
  for (const [index, file] of files.entries()) {
    try {
      references.push(await upload(file))
    } catch (caught) {
      throw new SpatialSceneAssetUploadFailure(caught, references, files.slice(index))
    }
  }
  return references
}

export function isSceneAssetInteractionDisabled(disabled: boolean, isUploading: boolean) {
  return disabled || isUploading
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
  assetSets,
  disabled,
  onReferencesChange,
  onAddAssetSet,
  onUpload,
  onUploadFiles,
  onUploadPending,
}: SpatialPrevisSceneAssetsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [assets, setAssets] = useState<ProjectAssetItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [pendingReferences, setPendingReferences] = useState<SpatialSceneReference[]>([])
  const [pendingRole, setPendingRole] = useState<SpatialAssetRole>('scene')
  const [retryFiles, setRetryFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const interactionDisabled = isSceneAssetInteractionDisabled(disabled, isUploading)
  const activeAssetSet = assetSets[assetSets.length - 1]
  const activeSetReferences = activeAssetSet
    ? activeAssetSet.referenceIds.flatMap((referenceId) => {
        const reference = references.find((item) => item.id === referenceId)
        return reference ? [reference] : []
      })
    : []
  const activeReference = activeSetReferences[0] ?? references[0]
  const activeRoleLabel = ASSET_ROLES.find((item) => item.role === activeAssetSet?.role)?.label
  const activeReferenceCount = activeSetReferences.length || references.length

  useEffect(() => {
    if (!isOpen || !projectId) return

    const controller = new AbortController()
    async function loadAssets() {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/assets?limit=200', {
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
  const libraryMediaAssets = useMemo(() => assets
    .filter((asset) => asset.projectId !== projectId)
    .map(spatialSceneReferenceFromLibraryAsset)
    .filter((reference): reference is SpatialSceneReference => reference !== null), [assets, projectId])

  const togglePendingReference = (reference: SpatialSceneReference) => {
    if (interactionDisabled) return
    const next = pendingReferences.some((item) => item.id === reference.id)
      ? pendingReferences.filter((item) => item.id !== reference.id)
      : [...pendingReferences, reference]
    setPendingReferences(next)
    if (next.length === 0) setPendingRole('scene')
  }

  const removeReference = (referenceId: string) => {
    if (interactionDisabled) return
    onReferencesChange(removeSpatialSceneReference(references, referenceId))
  }

  const addPendingAssetSet = () => {
    if (interactionDisabled || pendingReferences.length === 0) return
    const selected = pendingReferences
    setPendingReferences([])
    setPendingRole('scene')
    onAddAssetSet(selected, pendingRole)
  }

  const uploadFiles = async (files: readonly File[]) => {
    if (files.length === 0 || interactionDisabled) return
    setIsUploading(true)
    onUploadPending?.(true)
    setIsDragOver(false)
    setRetryFiles([])
    setError(null)
    try {
      const uploaded = onUploadFiles
        ? await onUploadFiles(files)
        : await uploadSceneAssetFiles(files, onUpload)
      if (uploaded.length > 0) onAddAssetSet(uploaded, 'scene')
    } catch (caught) {
      if (caught instanceof SpatialSceneAssetUploadFailure) {
        if (caught.uploadedReferences.length > 0) onAddAssetSet(caught.uploadedReferences, 'scene')
        setRetryFiles(caught.remainingFiles)
      }
      setError(caught instanceof Error ? caught.message : '上传失败。')
    } finally {
      setIsUploading(false)
      onUploadPending?.(false)
    }
  }

  return (
    <section className="border-b border-white/[0.08] pb-3" aria-label="场景资产">
      <button
        type="button"
        aria-label="添加场景资产"
        disabled={interactionDisabled}
        onClick={() => {
          if (!interactionDisabled) setIsOpen((current) => !current)
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.035] px-2 py-1.5 text-[11px] font-medium text-white/78 transition hover:border-indigo-200/35 hover:bg-indigo-300/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
      >
        {activeReference ? (
          <>
            <span className="max-w-32 truncate">{activeRoleLabel ? `${activeRoleLabel} · ` : ''}{activeReference.title}</span>
            <span>{activeReferenceCount} assets</span>
            <Plus size={13} aria-hidden="true" />
          </>
        ) : (
          <>
            <Plus size={13} aria-hidden="true" />
            Scene assets
          </>
        )}
      </button>

      <div hidden={!isOpen} className="mt-2 space-y-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          className="sr-only"
          disabled={interactionDisabled}
          onChange={(event) => {
            void uploadFiles(Array.from(event.currentTarget.files ?? []))
            event.currentTarget.value = ''
          }}
        />
        <div
          data-scene-asset-dropzone="true"
          role="button"
          aria-disabled={interactionDisabled}
          tabIndex={interactionDisabled ? -1 : 0}
          onClick={() => {
            if (!interactionDisabled) inputRef.current?.click()
          }}
          onKeyDown={(event) => {
            if (!interactionDisabled && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (!interactionDisabled) setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragOver(false)
            if (!interactionDisabled) void uploadFiles(Array.from(event.dataTransfer.files))
          }}
          className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 border border-dashed px-3 py-2 text-[11px] transition ${isDragOver ? 'border-indigo-200/60 bg-indigo-300/[0.1] text-indigo-50' : 'border-white/15 bg-black/15 text-white/55'} ${interactionDisabled ? 'cursor-not-allowed opacity-45' : 'hover:border-white/30 hover:text-white/75'}`}
        >
          {isUploading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
          <span>{isUploading ? '上传中…' : '拖放或选择图片 / 视频'}</span>
        </div>

        {error ? <p role="alert" className="text-[11px] text-amber-200/85">{error}</p> : null}
        {retryFiles.length > 0 ? (
          <button
            type="button"
            disabled={interactionDisabled}
            onClick={() => { void uploadFiles(retryFiles) }}
            className="text-[11px] text-indigo-100 underline decoration-indigo-200/45 underline-offset-2 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            重试剩余文件
          </button>
        ) : null}

        {pendingReferences.length > 0 ? (
          <div className="space-y-2 border border-white/[0.08] bg-white/[0.025] p-2">
            <div role="group" aria-label="素材角色" className="inline-flex overflow-hidden rounded-md border border-white/12">
              {ASSET_ROLES.map(({ role, label }) => (
                <button
                  key={role}
                  type="button"
                  aria-pressed={pendingRole === role}
                  disabled={interactionDisabled}
                  onClick={() => setPendingRole(role)}
                  className={`px-2 py-1 text-[11px] transition ${pendingRole === role ? 'bg-indigo-300/20 text-indigo-50' : 'text-white/52 hover:bg-white/[0.05] hover:text-white/78'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={interactionDisabled}
              onClick={addPendingAssetSet}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-indigo-200/30 bg-indigo-300/[0.12] px-2 py-1.5 text-[11px] font-medium text-indigo-50 transition hover:bg-indigo-300/[0.18] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Plus size={13} aria-hidden="true" />
              添加素材组
            </button>
          </div>
        ) : null}

        {references.length > 0 ? (
          <ul className="space-y-1" aria-label="已选场景资产">
            {references.map((reference) => (
              <li key={reference.id} className="flex min-w-0 items-center gap-2 border border-white/[0.08] bg-white/[0.025] px-2 py-1.5">
                {reference.mediaType === 'video' ? <Video size={13} className="shrink-0 text-white/55" aria-hidden="true" /> : <ImageIcon size={13} className="shrink-0 text-white/55" aria-hidden="true" />}
                <span className="min-w-0 flex-1 truncate text-[11px] text-white/72">{reference.title}</span>
                <button
                  type="button"
                  aria-label={`移除场景资产 ${reference.title}`}
                  disabled={interactionDisabled}
                  onClick={() => removeReference(reference.id)}
                  className="shrink-0 p-1 text-white/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="max-h-32 space-y-1 overflow-y-auto pr-1" aria-label="场景图片和视频素材">
          {isLoading ? (
            <p className="flex items-center gap-1.5 py-1 text-[11px] text-white/45"><Loader2 size={13} className="animate-spin" /> 加载素材中…</p>
          ) : projectMediaAssets.length + libraryMediaAssets.length > 0 ? (
            <>
              {libraryMediaAssets.length > 0 ? <p className="px-1 pt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-white/38">资产库</p> : null}
              {libraryMediaAssets.map((reference) => (
                <button
                  key={reference.id}
                  type="button"
                  aria-pressed={pendingReferences.some((item) => item.id === reference.id)}
                  disabled={interactionDisabled || references.some((item) => item.assetId === reference.assetId)}
                  onClick={() => togglePendingReference(reference)}
                  className="flex w-full min-w-0 items-center gap-2 border border-white/[0.08] px-2 py-1.5 text-left text-[11px] text-white/65 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {reference.mediaType === 'video' ? <Video size={13} className="shrink-0" aria-hidden="true" /> : <ImageIcon size={13} className="shrink-0" aria-hidden="true" />}
                  <span className="truncate">{reference.title}</span>
                </button>
              ))}
              {projectMediaAssets.length > 0 ? <p className="px-1 pt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-white/38">本项目</p> : null}
              {projectMediaAssets.map((reference) => (
                <button
                  key={reference.id}
                  type="button"
                  aria-pressed={pendingReferences.some((item) => item.id === reference.id)}
                  disabled={interactionDisabled || references.some((item) => item.assetId === reference.assetId)}
                  onClick={() => togglePendingReference(reference)}
                  className="flex w-full min-w-0 items-center gap-2 border border-white/[0.08] px-2 py-1.5 text-left text-[11px] text-white/65 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {reference.mediaType === 'video' ? <Video size={13} className="shrink-0" aria-hidden="true" /> : <ImageIcon size={13} className="shrink-0" aria-hidden="true" />}
                  <span className="truncate">{reference.title}</span>
                </button>
              ))}
            </>
          ) : (
            <p className="py-1 text-[11px] text-white/38">没有可用的项目图片或视频素材。</p>
          )}
        </div>
      </div>
    </section>
  )
}
