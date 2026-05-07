'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export type DeliveryAssetForClient = {
  id: string
  name: string
  title?: string | null
  type: string
  url: string
  dataUrl?: string | null
  projectId?: string | null
  project?: { id: string; title: string } | null
  metadataJson?: unknown
  metadata?: unknown
  normalizedType?: string | null
}

export type DeliveryCanvasNodeForClient = {
  id: string
  nodeId: string
  kind: string
  title?: string | null
  prompt?: string | null
  resultText?: string | null
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  resultAudioUrl?: string | null
  resultPreview?: string | null
  createdAt: string
}

export type DeliveryItemForClient = {
  id: string
  assetId?: string | null
  canvasNodeId?: string | null
  type: string
  title?: string | null
  url?: string | null
  contentText?: string | null
}

export type DeliveryCommentForClient = {
  id: string
  itemId?: string | null
  authorName?: string | null
  authorEmail?: string | null
  body: string
  status: string
  createdAt: string
  item?: { id: string; title: string | null } | null
}

export type DeliveryShareForClient = {
  id: string
  token: string
  title: string
  status: string
  items?: DeliveryItemForClient[]
  comments?: DeliveryCommentForClient[]
}

type Props = {
  projectId: string
  projectTitle: string
  initialShare: DeliveryShareForClient | null
  assets: DeliveryAssetForClient[]
  canvasNodes: DeliveryCanvasNodeForClient[]
}

function getTextFromAsset(asset: DeliveryAssetForClient) {
  const metadata = asset.metadataJson && typeof asset.metadataJson === 'object'
    ? asset.metadataJson as Record<string, unknown>
    : asset.metadata && typeof asset.metadata === 'object'
      ? asset.metadata as Record<string, unknown>
      : {}
  return typeof metadata.contentText === 'string' ? metadata.contentText : ''
}

function statusLabel(status: string) {
  if (status === 'approved') return '已通过'
  if (status === 'change_requested') return '要求修改'
  return '评论'
}

function nodeTypeLabel(kind: string) {
  if (kind === 'image') return '图片节点'
  if (kind === 'video') return '视频节点'
  if (kind === 'audio') return '音频节点'
  if (kind === 'text') return '文本节点'
  return '画布节点'
}

export function ProjectDeliveryClient({ projectId, projectTitle, initialShare, assets, canvasNodes }: Props) {
  const router = useRouter()
  const [share, setShare] = useState(initialShare)
  const [availableAssets, setAvailableAssets] = useState(assets)
  const [nodePickerOpen, setNodePickerOpen] = useState(false)
  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null)
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const shareUrl = share ? `/delivery/${share.token}` : ''
  const includedAssetIds = useMemo(() => new Set(share?.items?.map((item) => item.assetId).filter(Boolean)), [share?.items])
  const includedCanvasNodeIds = useMemo(() => new Set(share?.items?.map((item) => item.canvasNodeId).filter(Boolean)), [share?.items])

  useEffect(() => {
    setShare(initialShare)
  }, [initialShare])

  useEffect(() => {
    setAvailableAssets(assets)
  }, [assets])

  async function loadAvailableAssets() {
    setAssetPickerOpen(true)
    setLoadingAssets(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/assets?projectId=${encodeURIComponent(projectId)}&includeUnbound=1&limit=200`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const data = await res.json().catch(() => ({})) as { assets?: DeliveryAssetForClient[]; message?: string; errorCode?: string }
      if (!res.ok) throw new Error(`${data.errorCode ? `[${data.errorCode}] ` : ''}${data.message ?? '加载素材失败'}`)
      setAvailableAssets(data.assets ?? [])
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : '加载素材失败' })
    } finally {
      setLoadingAssets(false)
    }
  }

  async function createShare() {
    setMessage(null)
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/delivery`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ title: `${projectTitle} 客户交付` }),
    })
    const data = await res.json().catch(() => ({})) as { share?: DeliveryShareForClient; message?: string }
    if (!res.ok) {
      setMessage({ ok: false, text: data.message ?? '创建交付链接失败' })
      return
    }
    if (data.share) setShare(data.share)
    setMessage({ ok: true, text: '交付链接已创建。' })
    startTransition(() => router.refresh())
  }

  async function addAsset(asset: DeliveryAssetForClient) {
    if (!share) return
    setPendingAssetId(asset.id)
    setMessage(null)
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/delivery/items`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        shareId: share.id,
        assetId: asset.id,
        title: asset.title ?? asset.name,
        contentText: getTextFromAsset(asset) || undefined,
      }),
    })
    const data = await res.json().catch(() => ({})) as { share?: DeliveryShareForClient; message?: string; errorCode?: string }
    setPendingAssetId(null)
    if (!res.ok) {
      setMessage({ ok: false, text: `${data.errorCode ? `[${data.errorCode}] ` : ''}${data.message ?? '添加素材失败'}` })
      return
    }
    if (data.share) setShare(data.share)
    setMessage({ ok: true, text: '素材已加入交付。' })
    startTransition(() => router.refresh())
  }

  async function addCanvasNode(node: DeliveryCanvasNodeForClient) {
    if (!share) return
    setPendingNodeId(node.nodeId)
    setMessage(null)
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/delivery/items`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        shareId: share.id,
        canvasNodeId: node.nodeId,
      }),
    })
    const data = await res.json().catch(() => ({})) as { share?: DeliveryShareForClient; message?: string; errorCode?: string }
    setPendingNodeId(null)
    if (!res.ok) {
      setMessage({ ok: false, text: `${data.errorCode ? `[${data.errorCode}] ` : ''}${data.message ?? '添加画布节点失败'}` })
      return
    }
    if (data.share) setShare(data.share)
    setMessage({ ok: true, text: '画布节点已加入交付。' })
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">交付链接</h2>
            <p className="mt-1 text-sm text-white/45">客户无需登录即可查看交付内容并提交反馈。</p>
          </div>
          <button
            type="button"
            onClick={() => void createShare()}
            disabled={isPending}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-100 disabled:opacity-50"
          >
            {share ? '刷新交付链接' : '创建交付链接'}
          </button>
        </div>
        {share ? (
          <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
            <div className="break-all font-mono text-xs text-cyan-100">{shareUrl}</div>
            <a href={`/delivery/${share.token}`} target="_blank" className="mt-3 inline-flex text-sm font-semibold text-cyan-200 underline">
              打开客户交付页
            </a>
          </div>
        ) : null}
        {message ? <p className={`mt-3 text-sm ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</p> : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">交付素材</h2>
            <button
              type="button"
              onClick={() => void loadAvailableAssets()}
              disabled={!share || loadingAssets}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/75 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loadingAssets ? '加载中...' : '添加素材到交付'}
            </button>
            <button
              type="button"
              onClick={() => setNodePickerOpen((current) => !current)}
              disabled={!share}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/75 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              添加画布节点到交付
            </button>
          </div>

          {!share?.items?.length ? (
            <p className="mt-4 text-sm text-white/45">还没有加入交付的素材。</p>
          ) : (
            <div className="mt-4 space-y-3">
              {share.items.map((item) => (
                <div key={item.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{item.title ?? '未命名交付项'}</div>
                    <div className="mt-1 text-xs text-white/40">{item.type}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {assetPickerOpen ? (
            <div className="mt-5 border-t border-white/10 pt-4">
              {availableAssets.length === 0 ? (
                <p className="text-sm text-white/45">当前项目还没有素材，请先去素材库上传或绑定素材。</p>
              ) : (
                <div className="space-y-3">
                  {availableAssets.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{asset.title ?? asset.name}</div>
                        <div className="mt-1 text-xs text-white/40">
                          {asset.type} · {asset.projectId === projectId ? '已绑定当前项目' : asset.project ? `项目：${asset.project.title}` : '未关联项目'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void addAsset(asset)}
                        disabled={!share || includedAssetIds.has(asset.id) || pendingAssetId === asset.id}
                        className="shrink-0 rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/75 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {includedAssetIds.has(asset.id) ? '已添加' : pendingAssetId === asset.id ? '添加中...' : '加入交付'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {nodePickerOpen ? (
            <div className="mt-5 border-t border-white/10 pt-4">
              {canvasNodes.length === 0 ? (
                <p className="text-sm text-white/45">当前画布还没有可加入交付的节点。</p>
              ) : (
                <div className="space-y-3">
                  {canvasNodes.map((node) => (
                    <div key={node.nodeId} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{node.title || node.prompt || '未命名节点'}</div>
                        <div className="mt-1 text-xs text-white/40">
                          {nodeTypeLabel(node.kind)}
                          {node.resultImageUrl || node.resultVideoUrl || node.resultAudioUrl ? ' · 有链接结果' : node.resultText ? ' · 有文本结果' : ' · 占位内容'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void addCanvasNode(node)}
                        disabled={!share || includedCanvasNodeIds.has(node.nodeId) || pendingNodeId === node.nodeId}
                        className="shrink-0 rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/75 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {includedCanvasNodeIds.has(node.nodeId) ? '已添加' : pendingNodeId === node.nodeId ? '添加中...' : '加入交付'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-base font-semibold text-white">客户反馈</h2>
          {!share?.comments?.length ? (
            <p className="mt-4 text-sm text-white/45">暂无客户反馈。</p>
          ) : (
            <div className="mt-4 space-y-3">
              {share.comments.map((comment) => (
                <div key={comment.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">{comment.authorName || '客户'}</span>
                    <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-xs text-sky-200">{statusLabel(comment.status)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">{comment.body}</p>
                  <div className="mt-2 text-xs text-white/35">
                    {comment.item?.title ? `关联：${comment.item.title} · ` : ''}
                    {new Date(comment.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
