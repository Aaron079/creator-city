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
  createdAt?: string
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
  recipientName?: string | null
  recipientEmail?: string | null
  message?: string | null
  createdAt?: string
  items?: DeliveryItemForClient[]
  comments?: DeliveryCommentForClient[]
}

type Props = {
  projectId: string
  projectTitle: string
  initialShare: DeliveryShareForClient | null
  initialShares: DeliveryShareForClient[]
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

function getDeliveryHref(token: string) {
  return `/delivery/${token}`
}

function getFullDeliveryUrl(token: string) {
  const path = getDeliveryHref(token)
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

function selectedSummary(assetCount: number, nodeCount: number) {
  return `本次客户只能看到以下 ${assetCount + nodeCount} 个作品。`
}

export function ProjectDeliveryClient({ projectId, projectTitle, initialShare, initialShares, assets, canvasNodes }: Props) {
  const router = useRouter()
  const [share, setShare] = useState(initialShare)
  const [shares, setShares] = useState(initialShares.length ? initialShares : initialShare ? [initialShare] : [])
  const [availableAssets, setAvailableAssets] = useState(assets)
  const [nodePickerOpen, setNodePickerOpen] = useState(false)
  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [deliveryTitle, setDeliveryTitle] = useState(`${projectTitle} 交付`)
  const [deliveryMessage, setDeliveryMessage] = useState('')
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [selectedCanvasNodeIds, setSelectedCanvasNodeIds] = useState<string[]>([])
  const [submitResult, setSubmitResult] = useState<{ publicUrl: string; messageText: string } | null>(null)
  const [submittingToClient, setSubmittingToClient] = useState(false)
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null)
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const shareUrl = share ? `/delivery/${share.token}` : ''
  const selectedAssetSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds])
  const selectedCanvasNodeSet = useMemo(() => new Set(selectedCanvasNodeIds), [selectedCanvasNodeIds])
  const includedAssetIds = useMemo(() => new Set(share?.items?.map((item) => item.assetId).filter(Boolean)), [share?.items])
  const includedCanvasNodeIds = useMemo(() => new Set(share?.items?.map((item) => item.canvasNodeId).filter(Boolean)), [share?.items])

  useEffect(() => {
    setShare(initialShare)
  }, [initialShare])

  useEffect(() => {
    setShares(initialShares.length ? initialShares : initialShare ? [initialShare] : [])
  }, [initialShare, initialShares])

  useEffect(() => {
    setAvailableAssets(assets)
  }, [assets])

  useEffect(() => {
    setDeliveryTitle(`${projectTitle} 交付`)
  }, [projectTitle])

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
    if (data.share) {
      setShare(data.share)
      setShares((current) => [data.share!, ...current.filter((item) => item.id !== data.share!.id)])
    }
    setMessage({ ok: true, text: '交付链接已创建。' })
    startTransition(() => router.refresh())
  }

  function toggleAssetSelection(assetId: string) {
    setSelectedAssetIds((current) => (
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]
    ))
  }

  function toggleCanvasNodeSelection(nodeId: string) {
    setSelectedCanvasNodeIds((current) => (
      current.includes(nodeId) ? current.filter((id) => id !== nodeId) : [...current, nodeId]
    ))
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setMessage({ ok: true, text: '链接已复制。' })
    } catch {
      window.prompt('复制客户交付链接', value)
    }
  }

  async function submitToClient() {
    if (selectedAssetIds.length + selectedCanvasNodeIds.length === 0) {
      setMessage({ ok: false, text: '请至少勾选一个要交付给客户的作品。' })
      return
    }
    setSubmittingToClient(true)
    setMessage(null)
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/delivery/submit`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        title: deliveryTitle,
        recipientName,
        recipientEmail,
        message: deliveryMessage,
        assetIds: selectedAssetIds,
        canvasNodeIds: selectedCanvasNodeIds,
      }),
    })
    const data = await res.json().catch(() => ({})) as {
      success?: boolean
      share?: DeliveryShareForClient
      publicUrl?: string
      errorCode?: string
      message?: string
    }
    setSubmittingToClient(false)
    if (!res.ok || !data.success || !data.share) {
      setMessage({ ok: false, text: `${data.errorCode ? `[${data.errorCode}] ` : ''}${data.message ?? '生成客户链接失败'}` })
      return
    }
    setShare(data.share)
    setShares((current) => [data.share!, ...current.filter((item) => item.id !== data.share!.id)])
    const publicUrl = data.publicUrl?.startsWith('/delivery/')
      ? `${window.location.origin}${data.publicUrl}`
      : getFullDeliveryUrl(data.share.token)
    const messageText = `您好，这是本次项目交付链接：\n${publicUrl}\n您可以查看作品并提交修改意见。`
    setSubmitResult({ publicUrl, messageText })
    setSelectedAssetIds([])
    setSelectedCanvasNodeIds([])
    setMessage({ ok: true, text: '客户交付链接已生成。' })
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
    if (data.share) {
      setShare(data.share)
      setShares((current) => [data.share!, ...current.filter((item) => item.id !== data.share!.id)])
    }
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
    if (data.share) {
      setShare(data.share)
      setShares((current) => [data.share!, ...current.filter((item) => item.id !== data.share!.id)])
    }
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSubmitOpen(true)}
              className="rounded-md bg-cyan-200 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-100"
            >
              提交给客户
            </button>
            <button
              type="button"
              onClick={() => void createShare()}
              disabled={isPending}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-100 disabled:opacity-50"
            >
              {share ? '刷新交付链接' : '创建交付链接'}
            </button>
          </div>
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

      {submitOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">提交作品给客户</h2>
                <p className="mt-1 text-sm text-white/45">只勾选本次要交付的作品，客户不会看到未选择内容。</p>
              </div>
              <button type="button" className="rounded-md border border-white/10 px-2 py-1 text-sm text-white/60" onClick={() => setSubmitOpen(false)}>
                关闭
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-white/70">
                客户名称
                <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" placeholder="测试客户" />
              </label>
              <label className="text-sm text-white/70">
                客户邮箱
                <input value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" placeholder="test@example.com" />
              </label>
              <label className="text-sm text-white/70 sm:col-span-2">
                交付标题
                <input value={deliveryTitle} onChange={(event) => setDeliveryTitle(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label className="text-sm text-white/70 sm:col-span-2">
                交付说明
                <textarea value={deliveryMessage} onChange={(event) => setDeliveryMessage(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" rows={3} placeholder="请查看这版作品" />
              </label>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <section>
                <h3 className="text-sm font-semibold text-white">项目素材 Asset</h3>
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                  {assets.length ? assets.map((asset) => (
                    <label key={asset.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
                      <input type="checkbox" checked={selectedAssetSet.has(asset.id)} onChange={() => toggleAssetSelection(asset.id)} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">{asset.title ?? asset.name}</span>
                        <span className="text-xs text-white/40">{asset.type}</span>
                      </span>
                    </label>
                  )) : <p className="text-sm text-white/45">当前项目还没有素材。</p>}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-white">画布节点 CanvasNode</h3>
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                  {canvasNodes.length ? canvasNodes.map((node) => (
                    <label key={node.nodeId} className="flex cursor-pointer items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
                      <input type="checkbox" checked={selectedCanvasNodeSet.has(node.nodeId)} onChange={() => toggleCanvasNodeSelection(node.nodeId)} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">{node.title || node.prompt || '未命名节点'}</span>
                        <span className="text-xs text-white/40">{nodeTypeLabel(node.kind)}</span>
                      </span>
                    </label>
                  )) : <p className="text-sm text-white/45">当前画布还没有可交付节点。</p>}
                </div>
              </section>
            </div>

            <div className="mt-5 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-50">
              {selectedSummary(selectedAssetIds.length, selectedCanvasNodeIds.length)}
            </div>

            {submitResult ? (
              <div className="mt-4 rounded-md border border-emerald-300/20 bg-emerald-300/10 p-3">
                <div className="break-all font-mono text-xs text-emerald-50">{submitResult.publicUrl}</div>
                <textarea readOnly value={submitResult.messageText} className="mt-3 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80 outline-none" rows={4} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void copyText(submitResult.publicUrl)} className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/75">复制链接</button>
                  <button type="button" onClick={() => void copyText(submitResult.messageText)} className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/75">复制消息</button>
                  <a href={submitResult.publicUrl} target="_blank" className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/75">打开链接</a>
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSubmitOpen(false)} className="rounded-md border border-white/10 px-3 py-2 text-sm text-white/70">取消</button>
              <button type="button" onClick={() => void submitToClient()} disabled={submittingToClient} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
                {submittingToClient ? '生成中...' : '生成客户链接'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-base font-semibold text-white">客户交付记录</h2>
        {shares.length === 0 ? (
          <p className="mt-4 text-sm text-white/45">还没有生成客户交付链接。</p>
        ) : (
          <div className="mt-4 space-y-4">
            {shares.map((deliveryShare) => {
              const publicUrl = getDeliveryHref(deliveryShare.token)
              return (
                <div key={deliveryShare.id} className="rounded-md border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{deliveryShare.title}</div>
                      <div className="mt-1 text-xs text-white/40">
                        {deliveryShare.recipientName || '未填写客户'}
                        {deliveryShare.recipientEmail ? ` · ${deliveryShare.recipientEmail}` : ''}
                        {deliveryShare.createdAt ? ` · ${new Date(deliveryShare.createdAt).toLocaleString('zh-CN')}` : ''}
                      </div>
                      <div className="mt-2 break-all font-mono text-xs text-cyan-100">{publicUrl}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button type="button" onClick={() => void copyText(publicUrl)} className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/75">
                        复制链接
                      </button>
                      <a href={getDeliveryHref(deliveryShare.token)} target="_blank" className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/75">
                        打开
                      </a>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/45">
                    <span>作品 {deliveryShare.items?.length ?? 0}</span>
                    <span>反馈 {deliveryShare.comments?.length ?? 0}</span>
                    <span>{deliveryShare.status}</span>
                  </div>
                  {deliveryShare.comments?.length ? (
                    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                      {deliveryShare.comments.map((comment) => (
                        <div key={comment.id} className="rounded-md bg-white/[0.03] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-white/70">
                              {comment.authorName || '客户'}{comment.authorEmail ? ` · ${comment.authorEmail}` : ''}
                            </span>
                            <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[11px] text-sky-200">{statusLabel(comment.status)}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">{comment.body}</p>
                          <p className="mt-1 text-xs text-white/35">{new Date(comment.createdAt).toLocaleString('zh-CN')}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
