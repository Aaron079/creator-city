'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { VisualCanvasNode } from '@/components/create/CanvasNodeCard'

interface KeyframeExtractorPanelProps {
  nodes: VisualCanvasNode[]
  initialNodeId?: string
  onCreateNode: (
    kind: 'image' | 'video',
    options: { title: string; prompt: string; parentNodeId: string }
  ) => void
  onFocusNode: (nodeId: string) => void
  onClose: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m}:${String(s).padStart(2, '0')}.${ms}`
}

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copy = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedKey(key)
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800)
  }, [])
  return { copiedKey, copy }
}

export function KeyframeExtractorPanel({
  nodes,
  initialNodeId,
  onCreateNode,
  onFocusNode,
  onClose,
}: KeyframeExtractorPanelProps) {
  const videoNodes = nodes.filter(
    (n) => n.kind === 'video' && (n.resultVideoUrl || n.assetId || n.prompt?.trim()),
  )

  const [selectedId, setSelectedId] = useState<string>(
    () => initialNodeId && videoNodes.some((n) => n.id === initialNodeId)
      ? initialNodeId
      : (videoNodes.find((n) => n.status === 'done')?.id ?? videoNodes[0]?.id ?? ''),
  )
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [frameDataUrl, setFrameDataUrl] = useState<string | null>(null)
  const [corsError, setCorsError] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [created, setCreated] = useState<string | null>(null)
  const { copiedKey, copy } = useCopy()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const selectedNode = videoNodes.find((n) => n.id === selectedId) ?? null

  useEffect(() => {
    setFrameDataUrl(null)
    setCorsError(false)
    setVideoError(false)
    setCurrentTime(0)
    setDuration(0)
    setCreated(null)
  }, [selectedId])

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = seconds
    setCurrentTime(seconds)
    setFrameDataUrl(null)
    setCorsError(false)
  }, [])

  const handleSeekToPercent = useCallback(
    (pct: number) => {
      const video = videoRef.current
      if (!video || !duration) return
      seekTo(Math.max(0, Math.min(duration * pct, duration - 0.01)))
    },
    [duration, seekTo],
  )

  const handleExtractFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    setExtracting(true)
    setCorsError(false)
    try {
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 360
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
      setFrameDataUrl(dataUrl)
    } catch {
      setCorsError(true)
      setFrameDataUrl(null)
    } finally {
      setExtracting(false)
    }
  }, [])

  const timeLabel = formatTime(currentTime)
  const durLabel = duration ? formatTime(duration) : '--:--'

  const buildImagePrompt = (node: VisualCanvasNode, time: string) =>
    `参考上游视频「${node.title || '未命名'}」${time} 关键帧，保持主体/构图/风格一致。（关键帧提取草案，请编辑后生成）`

  const buildVideoPrompt = (node: VisualCanvasNode, time: string) =>
    `从上游视频「${node.title || '未命名'}」${time} 关键帧继续，保持主体/环境/光线一致，形成下一镜头。（视频续作草案，请编辑后生成）`

  const handleCreateImageNode = useCallback(() => {
    if (!selectedNode) return
    onCreateNode('image', {
      title: `关键帧参考 ${timeLabel}`,
      prompt: buildImagePrompt(selectedNode, timeLabel),
      parentNodeId: selectedNode.id,
    })
    setCreated('image')
  }, [selectedNode, timeLabel, onCreateNode])

  const handleCreateVideoNode = useCallback(() => {
    if (!selectedNode) return
    onCreateNode('video', {
      title: `视频续作 ${timeLabel}`,
      prompt: buildVideoPrompt(selectedNode, timeLabel),
      parentNodeId: selectedNode.id,
    })
    setCreated('video')
  }, [selectedNode, timeLabel, onCreateNode])

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] flex w-[400px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/97 shadow-2xl backdrop-blur-xl"
      data-no-node-drag="true"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/8 px-5 pb-3 pt-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
            Asset Tools
          </p>
          <h2 className="mt-0.5 text-[14px] font-semibold text-white/90">关键帧提取</h2>
          <p className="mt-1 max-w-[300px] text-[11px] leading-relaxed text-white/40">
            从已有视频节点中选取一帧，作为下一步图片参考或新节点草案。不会自动生成，不消耗 credits。
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-3 mt-0.5 flex-shrink-0 text-[18px] leading-none text-white/25 hover:text-white/55"
          aria-label="关闭"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Node selector */}
        {videoNodes.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-6 text-center">
            <p className="text-[13px] text-white/50">请选择一个已生成的视频节点</p>
            <p className="mt-1 text-[11px] text-white/25">画布中暂无包含视频结果的 video 节点</p>
          </div>
        ) : (
          <>
            {/* Selector */}
            <div className="mb-3">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
                选择视频节点
              </label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/80 outline-none focus:border-violet-500/40"
              >
                {videoNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title || '未命名'} · {n.status}
                  </option>
                ))}
              </select>
              {selectedNode ? (
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/30">
                  <span>{selectedNode.providerId}</span>
                  <span>·</span>
                  <span>{selectedNode.status}</span>
                  {selectedNode.assetId ? <><span>·</span><span className="text-emerald-400/60">已绑定资产</span></> : null}
                </div>
              ) : null}
            </div>

            {/* Video preview */}
            {selectedNode?.resultVideoUrl ? (
              <div className="mb-3">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
                  视频预览
                </label>
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    ref={videoRef}
                    src={selectedNode.resultVideoUrl}
                    controls
                    preload="metadata"
                    className="max-h-[180px] w-full object-contain"
                    crossOrigin="anonymous"
                    onLoadedMetadata={(e) => {
                      setDuration((e.target as HTMLVideoElement).duration)
                      setVideoError(false)
                    }}
                    onTimeUpdate={(e) => {
                      setCurrentTime((e.target as HTMLVideoElement).currentTime)
                    }}
                    onError={() => setVideoError(true)}
                  />
                </div>
                {videoError ? (
                  <p className="mt-1.5 text-[11px] text-amber-400/70">
                    视频预览暂不可用，资产记录仍保留。
                  </p>
                ) : (
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/35">
                    <span>当前：{timeLabel}</span>
                    <span>时长：{durLabel}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-3 rounded-xl border border-white/8 bg-white/3 px-4 py-4 text-center">
                <p className="text-[12px] text-white/40">视频预览暂不可用，资产记录仍保留</p>
                <p className="mt-0.5 text-[10px] text-white/25">可通过提示词参考或资产 ID 继续操作</p>
              </div>
            )}

            {/* Quick seek buttons */}
            {selectedNode?.resultVideoUrl && !videoError ? (
              <div className="mb-3">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
                  快捷时间点
                </label>
                <div className="flex gap-2">
                  {[
                    { label: '起始帧', pct: 0 },
                    { label: '中间帧', pct: 0.5 },
                    { label: '结尾帧', pct: 0.95 },
                  ].map(({ label, pct }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleSeekToPercent(pct)}
                      className="flex-1 rounded-lg border border-white/10 bg-white/4 py-1.5 text-[11px] text-white/60 transition hover:border-white/20 hover:bg-white/8 hover:text-white/80"
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => seekTo(currentTime)}
                    className="flex-1 rounded-lg border border-violet-500/20 bg-violet-500/8 py-1.5 text-[11px] text-violet-300/70 transition hover:border-violet-500/35 hover:text-violet-200"
                  >
                    当前帧
                  </button>
                </div>
              </div>
            ) : null}

            {/* Frame extraction */}
            {selectedNode?.resultVideoUrl && !videoError ? (
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                    提取预览
                  </label>
                  <button
                    type="button"
                    disabled={extracting}
                    onClick={handleExtractFrame}
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60 transition hover:border-white/20 hover:bg-white/10 hover:text-white/80 disabled:opacity-40"
                  >
                    {extracting ? '提取中…' : '预览当前帧'}
                  </button>
                </div>

                {corsError ? (
                  <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 text-[11px] leading-relaxed text-amber-300/80">
                    当前视频不允许浏览器直接截帧（CORS 限制）。可先使用当前帧时间点作为参考，或后续接入服务端截帧。
                  </div>
                ) : frameDataUrl ? (
                  <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={frameDataUrl}
                      alt="关键帧预览"
                      className="max-h-[160px] w-full object-contain bg-black"
                    />
                  </div>
                ) : (
                  <p className="mt-1.5 text-[10px] text-white/25">点击"预览当前帧"后在此显示截图</p>
                )}
              </div>
            ) : null}

            {/* Hidden canvas for frame extraction */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Copy actions */}
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => copy('time', timeLabel)}
                className="flex-1 rounded-lg border border-white/10 bg-white/4 py-1.5 text-[11px] text-white/55 transition hover:bg-white/8 hover:text-white/80"
              >
                {copiedKey === 'time' ? '✓ 已复制' : '复制时间点'}
              </button>
              {selectedNode ? (
                <button
                  type="button"
                  onClick={() => copy('desc', buildImagePrompt(selectedNode, timeLabel))}
                  className="flex-1 rounded-lg border border-white/10 bg-white/4 py-1.5 text-[11px] text-white/55 transition hover:bg-white/8 hover:text-white/80"
                >
                  {copiedKey === 'desc' ? '✓ 已复制' : '复制关键帧说明'}
                </button>
              ) : null}
            </div>

            {/* Create node buttons */}
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-white/30">
                创建草案节点（不自动生成）
              </label>
              <button
                type="button"
                disabled={!selectedNode}
                onClick={handleCreateImageNode}
                className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/8 disabled:opacity-40"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[16px]">🖼</span>
                  <div>
                    <p className="text-[12px] font-medium text-white/80">创建图片节点草案</p>
                    <p className="text-[10px] text-white/35">
                      以 {timeLabel} 帧为参考图，建立 source video → image edge，状态 idle
                    </p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                disabled={!selectedNode}
                onClick={handleCreateVideoNode}
                className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/8 disabled:opacity-40"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[16px]">🎬</span>
                  <div>
                    <p className="text-[12px] font-medium text-white/80">创建视频续作节点草案</p>
                    <p className="text-[10px] text-white/35">
                      从 {timeLabel} 帧继续下一镜头，状态 idle
                    </p>
                  </div>
                </div>
              </button>

              {created ? (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-[11px] text-emerald-300/80">
                  ✓ {created === 'image' ? '图片' : '视频'}草案节点已创建，请在画布中编辑 prompt 后手动生成。
                </div>
              ) : null}
            </div>

            {/* Safety notice */}
            <div className="mt-4 rounded-lg border border-white/6 bg-white/2 px-3 py-2.5">
              <p className="text-[10px] leading-relaxed text-white/25">
                本工具不自动生成 · 不消耗 credits · 不上传 OSS · 不新增 API
              </p>
            </div>
          </>
        )}
      </div>

      {/* Focus node footer */}
      {selectedNode ? (
        <div className="border-t border-white/8 px-5 py-3">
          <button
            type="button"
            onClick={() => onFocusNode(selectedNode.id)}
            className="w-full rounded-lg border border-white/10 py-1.5 text-[11px] text-white/45 transition hover:border-white/20 hover:text-white/70"
          >
            定位到视频节点
          </button>
        </div>
      ) : null}
    </div>
  )
}
