'use client'

import { useState, useCallback } from 'react'
import { X, RefreshCw, Copy, Plus, Check } from 'lucide-react'
import { parseShotList, buildShotListReport, SHOT_SIZE_LABELS } from '@/lib/canvas/shot-list'
import type { ShotDraft, ShotSize, ShotKind } from '@/lib/canvas/shot-list'
import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'

interface SourceNode {
  id: string
  title?: string
  kind: string
  prompt?: string
  resultText?: string
}

interface ShotListBuilderPanelProps {
  nodes: SourceNode[]
  initialNodeId?: string
  onCreateNode: (kind: VisualCanvasNodeKind, options: { title?: string; prompt?: string; parentNodeId?: string }) => void
  onClose: () => void
}

const SHOT_SIZE_OPTIONS: Array<{ value: ShotSize; label: string }> = [
  { value: 'wide', label: '全景' },
  { value: 'medium', label: '中景' },
  { value: 'close', label: '近景' },
  { value: 'extreme-close', label: '特写' },
]

function getNodeText(node: SourceNode): string {
  return (node.resultText ?? node.prompt ?? '').trim()
}

function getNodeLabel(node: SourceNode): string {
  return node.title ?? `${node.kind === 'text' ? '文本' : node.kind === 'image' ? '图片' : '视频'}节点`
}

export function ShotListBuilderPanel({
  nodes,
  initialNodeId,
  onCreateNode,
  onClose,
}: ShotListBuilderPanelProps) {
  const textNodes = nodes.filter((n) => getNodeText(n).length > 0)

  const firstId = initialNodeId && textNodes.find((n) => n.id === initialNodeId)
    ? initialNodeId
    : textNodes[0]?.id ?? ''

  const [selectedNodeId, setSelectedNodeId] = useState(firstId)
  const [shots, setShots] = useState<ShotDraft[]>(() => {
    const node = textNodes.find((n) => n.id === firstId)
    return node ? parseShotList(getNodeText(node)) : []
  })
  const [copyDone, setCopyDone] = useState(false)
  const [createdCount, setCreatedCount] = useState<number | null>(null)

  const selectedNode = textNodes.find((n) => n.id === selectedNodeId)

  const reanalyze = useCallback((nodeId: string) => {
    const node = textNodes.find((n) => n.id === nodeId)
    setShots(node ? parseShotList(getNodeText(node)) : [])
    setCreatedCount(null)
  }, [textNodes])

  const handleNodeChange = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    reanalyze(nodeId)
  }

  const patchShot = (id: string, patch: Partial<ShotDraft>) => {
    setShots((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s))
  }

  const toggleAll = (selected: boolean) => {
    setShots((prev) => prev.map((s) => ({ ...s, selected })))
  }

  const handleCopy = () => {
    const title = selectedNode ? getNodeLabel(selectedNode) : '未知来源'
    const report = buildShotListReport(shots, title)
    void navigator.clipboard.writeText(report).then(() => {
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), 2000)
    })
  }

  const handleCreate = () => {
    const toCreate = shots.filter((s) => s.selected)
    if (toCreate.length === 0) return
    toCreate.forEach((shot) => {
      const kindLabel = shot.kind === 'video' ? `视频 ${shot.duration}s` : '图片'
      const sizeLabel = SHOT_SIZE_LABELS[shot.shotSize]
      const title = `镜头 · ${sizeLabel} · ${kindLabel}`
      const prompt = `${shot.description}\n\n[${shot.cinematicNote}]`
      onCreateNode(shot.kind as VisualCanvasNodeKind, {
        title,
        prompt,
        parentNodeId: selectedNodeId || undefined,
      })
    })
    setCreatedCount(toCreate.length)
  }

  const selectedCount = shots.filter((s) => s.selected).length

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] flex max-h-[88vh] w-[480px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/96 shadow-2xl backdrop-blur-xl"
      data-no-node-drag="true"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/8 px-5 py-3.5">
        <span className="text-[13px]">🎬</span>
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-white/40">分镜清单生成器</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-white/30 transition hover:bg-white/6 hover:text-white/70"
          aria-label="关闭"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Source selector */}
        <div className="mb-4">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
            来源节点
          </label>
          {textNodes.length === 0 ? (
            <p className="rounded-lg border border-white/8 bg-white/3 px-3 py-3 text-[12px] text-white/40">
              画布中没有可用的文本节点。请先创建一个文本节点并输入内容。
            </p>
          ) : (
            <div className="flex gap-2">
              <select
                value={selectedNodeId}
                onChange={(e) => handleNodeChange(e.target.value)}
                className="flex-1 rounded-lg border border-white/10 bg-[#1a1d26] px-3 py-1.5 text-[12px] text-white/80 outline-none focus:border-white/25"
              >
                {textNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {getNodeLabel(n)}
                    {getNodeText(n).length > 0 ? ` — ${getNodeText(n).slice(0, 40)}…` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => reanalyze(selectedNodeId)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-[12px] text-white/60 transition hover:bg-white/8 hover:text-white/90"
                title="重新分析"
              >
                <RefreshCw size={13} strokeWidth={2.2} />
                <span>重新分析</span>
              </button>
            </div>
          )}
          {selectedNode && getNodeText(selectedNode).length > 0 ? (
            <p className="mt-2 rounded-lg border border-white/6 bg-white/3 px-3 py-2 text-[11px] leading-relaxed text-white/40">
              {getNodeText(selectedNode).slice(0, 120)}
              {getNodeText(selectedNode).length > 120 ? '…' : ''}
            </p>
          ) : null}
        </div>

        {/* Shot list */}
        {shots.length > 0 ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                分镜清单（{shots.length} 镜）
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => toggleAll(true)}
                  className="text-[11px] text-white/35 transition hover:text-white/70"
                >
                  全选
                </button>
                <button
                  type="button"
                  onClick={() => toggleAll(false)}
                  className="text-[11px] text-white/35 transition hover:text-white/70"
                >
                  全不选
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {shots.map((shot, i) => (
                <div
                  key={shot.id}
                  className={`rounded-xl border px-4 py-3 transition ${
                    shot.selected
                      ? 'border-white/14 bg-white/5'
                      : 'border-white/6 bg-white/2 opacity-50'
                  }`}
                >
                  {/* Shot header */}
                  <div className="mb-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => patchShot(shot.id, { selected: !shot.selected })}
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
                        shot.selected
                          ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-300'
                          : 'border-white/20 bg-transparent text-transparent'
                      }`}
                      aria-label={shot.selected ? '取消选择' : '选择'}
                    >
                      <Check size={10} strokeWidth={3} />
                    </button>
                    <span className="text-[10px] font-semibold text-white/40">镜头 {i + 1}</span>

                    {/* Kind toggle */}
                    <div className="ml-auto flex overflow-hidden rounded-md border border-white/10">
                      {(['image', 'video'] as ShotKind[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => patchShot(shot.id, { kind: k })}
                          className={`px-2 py-0.5 text-[10px] transition ${
                            shot.kind === k
                              ? 'bg-white/12 text-white/90'
                              : 'text-white/35 hover:text-white/60'
                          }`}
                        >
                          {k === 'image' ? '图片' : '视频'}
                        </button>
                      ))}
                    </div>

                    {/* Shot size */}
                    <select
                      value={shot.shotSize}
                      onChange={(e) => patchShot(shot.id, { shotSize: e.target.value as ShotSize })}
                      className="rounded-md border border-white/10 bg-[#1a1d26] px-1.5 py-0.5 text-[10px] text-white/70 outline-none"
                    >
                      {SHOT_SIZE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>

                    {/* Duration — video only */}
                    {shot.kind === 'video' ? (
                      <select
                        value={shot.duration}
                        onChange={(e) => patchShot(shot.id, { duration: Number(e.target.value) as 5 | 10 })}
                        className="rounded-md border border-white/10 bg-[#1a1d26] px-1.5 py-0.5 text-[10px] text-white/70 outline-none"
                      >
                        <option value={5}>5s</option>
                        <option value={10}>10s</option>
                      </select>
                    ) : null}
                  </div>

                  {/* Description */}
                  <textarea
                    value={shot.description}
                    onChange={(e) => patchShot(shot.id, { description: e.target.value })}
                    rows={2}
                    placeholder="画面描述"
                    className="mb-2 w-full resize-none rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-[12px] leading-relaxed text-white/80 placeholder-white/20 outline-none focus:border-white/20"
                  />

                  {/* Cinematic note */}
                  <textarea
                    value={shot.cinematicNote}
                    onChange={(e) => patchShot(shot.id, { cinematicNote: e.target.value })}
                    rows={1}
                    placeholder="镜头语言"
                    className="w-full resize-none rounded-lg border border-white/6 bg-transparent px-3 py-1.5 text-[11px] leading-relaxed text-white/45 placeholder-white/15 outline-none focus:border-white/15"
                  />
                </div>
              ))}
            </div>
          </>
        ) : textNodes.length > 0 ? (
          <p className="rounded-lg border border-white/8 bg-white/3 px-3 py-3 text-center text-[12px] text-white/40">
            未能从所选节点解析出分镜内容。请确认节点有足够文本内容。
          </p>
        ) : null}
      </div>

      {/* Footer */}
      {shots.length > 0 ? (
        <div className="border-t border-white/8 px-5 py-3.5">
          {createdCount !== null ? (
            <p className="mb-2.5 text-center text-[11px] text-emerald-400/80">
              已创建 {createdCount} 个草案节点
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-[12px] text-white/60 transition hover:bg-white/8 hover:text-white/90"
            >
              {copyDone ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2.2} />}
              <span>{copyDone ? '已复制' : '复制分镜清单'}</span>
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={selectedCount === 0}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600/80 px-4 py-2 text-[12px] font-semibold text-white/90 transition hover:bg-indigo-500/90 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>
                {selectedCount > 0 ? `创建 ${selectedCount} 个草案节点` : '请选择镜头'}
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
