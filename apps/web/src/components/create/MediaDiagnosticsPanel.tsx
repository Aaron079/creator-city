'use client'

import { useEffect, useMemo, useState } from 'react'
import type { VisualCanvasNode } from '@/components/create/CanvasNodeCard'
import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'

type MediaType = 'image' | 'video'

type DiagnosticResult = {
  success?: boolean
  reachable?: boolean
  status?: number
  proxyStatus?: number
  upstreamStatus?: number
  contentType?: string
  contentLength?: string
  candidateUrls?: Array<{ source?: string; url?: string; reachable?: boolean; proxyStatus?: number; upstreamStatus?: number }>
  selectedWorkingUrl?: string
  selectedWorkingSource?: string
  proxiedUrl?: string
  proxyUrlRoundTripMatches?: boolean
  queryPreserved?: boolean
  corsBlocked?: boolean
  rangeSupported?: boolean
  hasAssetUrl?: boolean
  hasAssetId?: boolean
  hasMediaPersistence?: boolean
  legacyStableAssetMissing?: boolean
  expiredLikely?: boolean
  message?: string
  errorCode?: string
}

type ResyncResult = {
  success?: boolean
  stableUrl?: string
  assetId?: string
  mediaPersistence?: unknown
  errorCode?: string
  message?: string
  diagnostic?: DiagnosticResult
}

interface MediaDiagnosticsPanelProps {
  open: boolean
  node: VisualCanvasNode | null
  mediaType: MediaType
  mediaUrl: string
  projectId?: string
  onClose: () => void
  onPatchNode: (nodeId: string, patch: Partial<VisualCanvasNode>) => void
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function displayValue(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value == null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function isLikelyTemporaryUrl(url: string) {
  const lower = url.toLowerCase()
  return [
    'x-tos-expires',
    'x-tos-signature',
    'x-amz-expires',
    'x-amz-signature',
    'x-oss-expires',
    'x-oss-signature',
    'expires=',
    'signature=',
    'security-token=',
  ].some((pattern) => lower.includes(pattern))
}

function mediaPersistenceStatus(value: unknown) {
  const record = recordValue(value)
  if (record.status === 'persisted' || record.ok === true) return 'persisted'
  if (record.status === 'failed' || record.ok === false || record.errorCode) return 'failed'
  return 'missing'
}

function pluginResultUrls(metadata: Record<string, unknown>, mediaType: MediaType) {
  const pluginResult = recordValue(metadata.pluginResult)
  const pluginData = recordValue(pluginResult.data)
  const pluginOutput = recordValue(pluginResult.output)
  const keys = mediaType === 'image'
    ? ['imageUrl', 'resultImageUrl']
    : ['videoUrl', 'resultVideoUrl']
  return [
    ...keys.map((key) => stringValue(pluginResult[key])),
    ...keys.map((key) => stringValue(pluginData[key])),
    ...keys.map((key) => stringValue(pluginOutput[key])),
  ].filter(Boolean)
}

function resolveUrlSource(node: VisualCanvasNode, mediaType: MediaType, mediaUrl: string) {
  const metadata = recordValue(node.metadataJson)
  const candidates: Array<[string, string]> = mediaType === 'image'
    ? [
        ['resultImageUrl', stringValue(node.resultImageUrl)],
        ['metadata.assetUrl', stringValue(metadata.assetUrl)],
        ['metadata.originalProviderImageUrl', stringValue(metadata.originalProviderImageUrl)],
        ...pluginResultUrls(metadata, mediaType).map((url) => ['metadata.pluginResult', url] as [string, string]),
      ]
    : [
        ['resultVideoUrl', stringValue(node.resultVideoUrl)],
        ['metadata.assetUrl', stringValue(metadata.assetUrl)],
        ['metadata.originalProviderVideoUrl', stringValue(metadata.originalProviderVideoUrl)],
        ...pluginResultUrls(metadata, mediaType).map((url) => ['metadata.pluginResult', url] as [string, string]),
      ]
  return candidates.find(([, url]) => url && url === mediaUrl)?.[0] ?? 'unknown'
}

function StatusPill({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'good' | 'bad' | 'warn' }) {
  const className = tone === 'good'
    ? 'border-emerald-200/25 bg-emerald-200/10 text-emerald-50'
    : tone === 'bad'
      ? 'border-red-200/25 bg-red-200/10 text-red-50'
      : tone === 'warn'
        ? 'border-amber-200/25 bg-amber-200/10 text-amber-50'
        : 'border-white/10 bg-white/[0.06] text-white/68'
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>{children}</span>
}

export function MediaDiagnosticsPanel({
  open,
  node,
  mediaType,
  mediaUrl,
  projectId,
  onClose,
  onPatchNode,
}: MediaDiagnosticsPanelProps) {
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [copyState, setCopyState] = useState<'copied' | 'failed' | ''>('')
  const [syncMessage, setSyncMessage] = useState('')

  const metadata = useMemo(() => recordValue(node?.metadataJson), [node?.metadataJson])
  const urlSource = node ? resolveUrlSource(node, mediaType, mediaUrl) : 'unknown'
  const persistenceStatus = mediaPersistenceStatus(metadata.mediaPersistence)
  const stableAssetUrl = stringValue(metadata.assetUrl)
  const isStableAsset = Boolean(mediaUrl && stableAssetUrl && mediaUrl === stableAssetUrl && persistenceStatus === 'persisted')
  const temporaryUrl = Boolean(mediaUrl && isLikelyTemporaryUrl(mediaUrl))
  const canCheck = Boolean(mediaUrl && !checking && !syncing)
  const canSync = Boolean(mediaUrl && diagnostic?.reachable && !syncing)

  useEffect(() => {
    setDiagnostic(null)
    setSyncMessage('')
    setCopyState('')
  }, [mediaUrl, node?.id])

  if (!open || !node) return null

  const checkLink = async () => {
    if (!mediaUrl) return
    setChecking(true)
    setSyncMessage('')
    try {
      const response = await fetch('/api/media/diagnose', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ url: mediaUrl, type: mediaType, nodeId: node.id, node, metadataJson: node.metadataJson }),
      })
      const data = await response.json().catch(() => ({})) as DiagnosticResult
      setDiagnostic(data)
    } catch (error) {
      setDiagnostic({
        success: false,
        reachable: false,
        status: 0,
        expiredLikely: false,
        message: error instanceof Error ? error.message : '检查链接失败。',
      })
    } finally {
      setChecking(false)
    }
  }

  const copyLink = async () => {
    try {
      if (!mediaUrl || !navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(mediaUrl)
      setCopyState('copied')
      window.setTimeout(() => setCopyState(''), 1400)
    } catch {
      setCopyState('failed')
    }
  }

  const copyDiagnosticJson = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(JSON.stringify({
        nodeId: node.id,
        kind: node.kind,
        title: node.title,
        mediaType,
        mediaUrl,
        proxiedUrl: getProxiedMediaUrl(mediaUrl),
        urlSource,
        diagnostic,
        metadataJson: node.metadataJson,
        resultImageUrl: node.resultImageUrl,
        resultVideoUrl: node.resultVideoUrl,
        selectedUrl: diagnostic?.selectedWorkingUrl || mediaUrl,
        copiedAt: new Date().toISOString(),
      }, null, 2))
      setCopyState('copied')
      window.setTimeout(() => setCopyState(''), 1400)
    } catch {
      setCopyState('failed')
    }
  }

  const resyncMedia = async () => {
    if (!mediaUrl || !diagnostic?.reachable) return
    setSyncing(true)
    setSyncMessage('')
    try {
      const response = await fetch('/api/media/resync', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          url: mediaUrl,
          type: mediaType,
          projectId,
          nodeId: node.id,
          filenameHint: `${node.title || node.id}-${mediaType === 'image' ? 'image.png' : 'video.mp4'}`,
          metadata,
        }),
      })
      const data = await response.json().catch(() => ({})) as ResyncResult
      if (!response.ok || data.success === false || !data.stableUrl) {
        if (data.errorCode === 'MEDIA_SOURCE_EXPIRED') {
          setDiagnostic(data.diagnostic ?? { ...diagnostic, reachable: false, expiredLikely: true })
          setSyncMessage('媒体源当前不可访问，无法同步。可使用原 prompt 重新生成稳定版本。')
          return
        }
        setSyncMessage(data.message || data.errorCode || '重新同步失败。')
        return
      }

      const nextMetadata = {
        ...metadata,
        assetUrl: data.stableUrl,
        assetId: data.assetId,
        recoveredAt: new Date().toISOString(),
        recoveredFrom: mediaUrl,
        recoveryStatus: 'recovered',
        mediaPersistence: data.mediaPersistence,
        mediaResync: {
          sourceUrl: mediaUrl,
          syncedAt: new Date().toISOString(),
        },
      }
      onPatchNode(node.id, {
        ...(mediaType === 'image' ? { resultImageUrl: data.stableUrl } : { resultVideoUrl: data.stableUrl }),
        metadataJson: nextMetadata,
        errorMessage: undefined,
        preview: mediaType === 'video' && node.preview?.type === 'remote-video'
          ? { ...node.preview, url: data.stableUrl, poster: node.preview.poster === mediaUrl ? data.stableUrl : node.preview.poster }
          : node.preview,
      })
      setDiagnostic({
        success: true,
        reachable: true,
        status: 200,
        expiredLikely: false,
        message: '媒体已同步到稳定素材库。',
      })
      setSyncMessage('已重新同步到稳定素材库。')
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : '重新同步失败。')
    } finally {
      setSyncing(false)
    }
  }

  const diagnosticTone = !mediaUrl
    ? 'warn'
    : diagnostic?.reachable
      ? 'good'
      : diagnostic?.expiredLikely
        ? 'bad'
        : diagnostic
          ? 'warn'
          : 'neutral'
  const diagnosticLabel = !mediaUrl
    ? '无 URL'
    : diagnostic?.reachable
      ? '可访问'
      : diagnostic
        ? '不可访问'
        : '未检查'

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/35 px-4 py-6"
      role="presentation"
      data-no-node-drag="true"
      data-media-diagnostics="true"
      onPointerDown={(event) => {
        event.stopPropagation()
        onClose()
      }}
    >
      <aside
        className="max-h-[86vh] w-[min(560px,100%)] overflow-hidden rounded-xl border border-white/12 bg-[#101214]/96 text-white shadow-2xl backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label="资产恢复详情"
        data-no-node-drag="true"
        data-media-diagnostics="true"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/48">Media Diagnostics</p>
              <h2 className="mt-1 text-lg font-semibold text-white">资产恢复详情</h2>
              <p className="mt-1 text-sm text-white/52">{node.title} / {mediaType === 'image' ? 'Image' : 'Video'}</p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-lg leading-none text-white/66 hover:bg-white/10 hover:text-white"
              aria-label="关闭资产恢复详情"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        <div className="max-h-[calc(86vh-80px)] space-y-4 overflow-y-auto px-5 py-4">
          <dl className="grid gap-3 text-sm">
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
              <dt className="text-xs font-medium text-white/42">当前媒体 URL</dt>
              <dd className="mt-2 break-all font-mono text-xs leading-5 text-white/74">{mediaUrl || '未记录'}</dd>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <dt className="text-xs font-medium text-white/42">URL 来源</dt>
                <dd className="mt-2 font-mono text-xs text-white/76">{urlSource}</dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <dt className="text-xs font-medium text-white/42">mediaPersistence</dt>
                <dd className="mt-2"><StatusPill tone={persistenceStatus === 'persisted' ? 'good' : persistenceStatus === 'failed' ? 'bad' : 'warn'}>{persistenceStatus}</StatusPill></dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <dt className="text-xs font-medium text-white/42">稳定资产</dt>
                <dd className="mt-2"><StatusPill tone={isStableAsset ? 'good' : 'warn'}>{isStableAsset ? '是' : '否'}</StatusPill></dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <dt className="text-xs font-medium text-white/42">疑似临时签名链接</dt>
                <dd className="mt-2"><StatusPill tone={temporaryUrl ? 'warn' : 'neutral'}>{temporaryUrl ? '是' : '否'}</StatusPill></dd>
              </div>
            </div>
          </dl>

          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white/86">诊断结果</h3>
              <StatusPill tone={diagnosticTone}>{diagnosticLabel}</StatusPill>
            </div>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-md bg-black/18 p-2">
                <dt className="text-white/38">HTTP status</dt>
                <dd className="mt-1 font-mono text-white/74">{diagnostic?.status ?? '未检查'}</dd>
              </div>
              <div className="rounded-md bg-black/18 p-2">
                <dt className="text-white/38">proxy status</dt>
                <dd className="mt-1 font-mono text-white/74">{diagnostic?.proxyStatus ?? '未检查'}</dd>
              </div>
              <div className="rounded-md bg-black/18 p-2">
                <dt className="text-white/38">upstream status</dt>
                <dd className="mt-1 font-mono text-white/74">{diagnostic?.upstreamStatus ?? '未检查'}</dd>
              </div>
              <div className="rounded-md bg-black/18 p-2">
                <dt className="text-white/38">contentType</dt>
                <dd className="mt-1 truncate font-mono text-white/74">{diagnostic?.contentType || '未记录'}</dd>
              </div>
              <div className="rounded-md bg-black/18 p-2">
                <dt className="text-white/38">contentLength</dt>
                <dd className="mt-1 font-mono text-white/74">{diagnostic?.contentLength || '未记录'}</dd>
              </div>
            </dl>
            {diagnostic?.message ? (
              <p className={`mt-3 rounded-md border p-3 text-sm leading-6 ${!diagnostic.reachable ? 'border-red-200/20 bg-red-200/10 text-red-50' : 'border-white/10 bg-black/16 text-white/66'}`}>
                {!diagnostic.reachable
                  ? `媒体源当前不可访问（HTTP ${diagnostic.status || '网络错误'}）。可尝试重新同步，或使用原 prompt 重新生成。`
                  : diagnostic.message}
              </p>
            ) : null}
            {syncMessage ? (
              <p className="mt-3 rounded-md border border-white/10 bg-black/16 p-3 text-sm leading-6 text-white/68">{syncMessage}</p>
            ) : null}
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <h3 className="text-sm font-semibold text-white/86">媒体字段</h3>
            <dl className="mt-3 space-y-2 text-xs">
              {([
                ['当前实际播放地址 (raw)', mediaUrl],
                ['proxied URL', getProxiedMediaUrl(mediaUrl)],
                ['resultImageUrl', node.resultImageUrl],
                ['resultVideoUrl', node.resultVideoUrl],
                ['metadata.assetUrl', metadata.assetUrl],
                ['metadata.assetId', metadata.assetId],
                ['metadata.originalProviderImageUrl', metadata.originalProviderImageUrl],
                ['metadata.originalProviderVideoUrl', metadata.originalProviderVideoUrl],
                ['candidateUrls', diagnostic?.candidateUrls],
                ['selectedWorkingUrl', diagnostic?.selectedWorkingUrl],
                ['selectedWorkingSource', diagnostic?.selectedWorkingSource],
                ['proxyUrlRoundTripMatches', diagnostic?.proxyUrlRoundTripMatches],
                ['queryPreserved', diagnostic?.queryPreserved],
                ['corsBlocked', diagnostic?.corsBlocked],
                ['rangeSupported', diagnostic?.rangeSupported],
                ['hasAssetUrl', diagnostic?.hasAssetUrl],
                ['hasAssetId', diagnostic?.hasAssetId],
                ['hasMediaPersistence', diagnostic?.hasMediaPersistence],
                ['legacyStableAssetMissing', diagnostic?.legacyStableAssetMissing],
              ] as Array<[string, unknown]>).map(([label, value]) => (
                <div key={label} className="rounded-md bg-black/18 p-2">
                  <dt className="font-mono text-white/38">{label}</dt>
                  <dd className="mt-1 break-all font-mono leading-5 text-white/70">{displayValue(value) || '未记录'}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-45"
              disabled={!mediaUrl}
              onClick={() => { void copyLink() }}
            >
              {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制当前链接'}
            </button>
            <button
              type="button"
              className="rounded-md border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-200/16"
              onClick={() => { void copyDiagnosticJson() }}
            >
              {copyState === 'copied' ? '已复制 JSON' : '复制诊断 JSON'}
            </button>
            <button
              type="button"
              className="rounded-md border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-200/16 disabled:opacity-45"
              disabled={!canCheck}
              onClick={() => { void checkLink() }}
            >
              {checking ? '检查中...' : '检查链接'}
            </button>
            <button
              type="button"
              className="rounded-md border border-emerald-200/22 bg-emerald-200/12 px-3 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-200/18 disabled:opacity-45"
              disabled={!canSync}
              onClick={() => { void resyncMedia() }}
            >
              {syncing ? '同步中...' : '重新同步到素材库'}
            </button>
            <button
              type="button"
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10"
              onClick={onClose}
            >
              关闭
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
