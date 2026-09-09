'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { SeedanceDeliveryReceipt } from '@/lib/seedance-previs/receipts'
import { assembleReviewTimeline, compareChainBoundaries } from '@/lib/seedance-previs/review'
import { isSegmentRetryEligible } from '@/lib/seedance-previs/retry'

export type SeedanceChainRetryRequest = {
  deliveryId: string
  segmentId: string
  reviewFindingCode?: 'MANUAL_REVIEW' | 'CAMERA_HANDOFF_DRIFT'
}

type SeedanceChainReviewPanelProps = {
  receipt: SeedanceDeliveryReceipt
  onRetry: (input: SeedanceChainRetryRequest) => Promise<{ success: boolean; message: string }>
}

function formatTime(value: number) {
  const wholeSeconds = Math.max(0, Math.floor(value))
  return `${String(Math.floor(wholeSeconds / 60)).padStart(2, '0')}:${String(wholeSeconds % 60).padStart(2, '0')}`
}

function statusLabel(status: string) {
  if (status === 'succeeded') return '已完成'
  if (status === 'failed') return '需恢复'
  if (status === 'submitted' || status === 'submitting') return '生成中'
  return '等待中'
}

export function SeedanceChainReviewPanel({ receipt, onRetry }: SeedanceChainReviewPanelProps) {
  const timeline = useMemo(() => assembleReviewTimeline(receipt), [receipt])
  const findings = useMemo(() => compareChainBoundaries(receipt), [receipt])
  const [currentTimeSec, setCurrentTimeSec] = useState(0)
  const [manualReviewSegmentId, setManualReviewSegmentId] = useState<string | null>(null)
  const [retryStatus, setRetryStatus] = useState<string | null>(null)
  const [retryingSegmentId, setRetryingSegmentId] = useState<string | null>(null)
  const autoPlayNextRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const activeItem = timeline.items.find((item) => currentTimeSec >= item.startSec && currentTimeSec < item.endSec)
    ?? timeline.items.at(-1)
  const activeFinding = activeItem ? findings.find((finding) => finding.segmentId === activeItem.segmentId) : undefined

  useEffect(() => {
    if (!activeItem || !autoPlayNextRef.current) return
    const video = videoRef.current
    if (!video) return
    const startAt = Math.max(0, currentTimeSec - activeItem.startSec)
    const play = () => {
      video.currentTime = startAt
      void video.play().catch(() => {})
      autoPlayNextRef.current = false
    }
    if (video.readyState >= 1) play()
    else video.addEventListener('loadedmetadata', play, { once: true })
  }, [activeItem, currentTimeSec])

  const seek = (timeSec: number) => {
    const nextTime = Math.min(timeline.durationSec, Math.max(0, timeSec))
    setCurrentTimeSec(nextTime)
    const item = timeline.items.find((candidate) => nextTime >= candidate.startSec && nextTime < candidate.endSec)
    if (item && item.segmentId === activeItem?.segmentId && videoRef.current) {
      videoRef.current.currentTime = Math.max(0, nextTime - item.startSec)
    }
  }

  const retry = async (segmentId: string, reviewFindingCode?: 'MANUAL_REVIEW' | 'CAMERA_HANDOFF_DRIFT') => {
    if (retryingSegmentId) return
    setRetryingSegmentId(segmentId)
    setRetryStatus(null)
    try {
      const result = await onRetry({ deliveryId: receipt.deliveryId, segmentId, ...(reviewFindingCode ? { reviewFindingCode } : {}) })
      setRetryStatus(result.message)
    } catch {
      setRetryStatus('片段恢复提交失败。')
    } finally {
      setRetryingSegmentId(null)
    }
  }

  return (
    <section aria-label="Seedance 生成复核" className="space-y-3 rounded-md border border-white/10 bg-[#14171c]/90 p-3 text-xs text-white/72">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-white/82">主镜头回看</span>
        <span className="font-mono text-white/45">{formatTime(currentTimeSec)} / {formatTime(timeline.durationSec)}</span>
      </div>

      <div className="overflow-hidden rounded border border-white/10 bg-black/35">
        {activeItem?.videoUrl ? (
          <video
            key={activeItem.segmentId}
            ref={videoRef}
            controls
            preload="metadata"
            src={activeItem.videoUrl}
            className="block aspect-video w-full bg-black"
            onTimeUpdate={(event) => setCurrentTimeSec(activeItem.startSec + event.currentTarget.currentTime)}
            onEnded={() => {
              const next = timeline.items.find((item) => item.index === activeItem.index + 1)
              if (!next?.videoUrl) return
              autoPlayNextRef.current = true
              setCurrentTimeSec(next.startSec)
            }}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center px-4 text-center text-[11px] text-white/40">
            {activeItem ? `片段 ${activeItem.index + 1} ${statusLabel(activeItem.status)}` : '尚无可回看的片段'}
          </div>
        )}
      </div>

      <div data-master-review-timeline="true" className="space-y-1.5">
        <input
          aria-label="主时间线"
          type="range"
          min="0"
          max={timeline.durationSec}
          step="0.1"
          value={Math.min(currentTimeSec, timeline.durationSec)}
          onChange={(event) => seek(Number(event.currentTarget.value))}
          className="w-full accent-indigo-300"
        />
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(timeline.items.length, 1)}, minmax(0, 1fr))` }}>
          {timeline.items.map((item) => {
            const selected = item.segmentId === activeItem?.segmentId
            return (
              <button
                key={item.segmentId}
                type="button"
                aria-pressed={selected}
                onClick={() => seek(item.startSec)}
                className={`min-w-0 border px-1.5 py-1 text-left text-[10px] ${selected ? 'border-indigo-200/45 bg-indigo-300/[0.14] text-indigo-50' : 'border-white/10 bg-white/[0.025] text-white/52 hover:bg-white/[0.07]'}`}
              >
                <span className="block truncate">{formatTime(item.startSec)} - {formatTime(item.endSec)}</span>
                <span className="block truncate text-white/38">{statusLabel(item.status)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5 border-t border-white/[0.08] pt-2">
        {timeline.items.map((item) => {
          const finding = findings.find((candidate) => candidate.segmentId === item.segmentId)
          const manuallyMarked = manualReviewSegmentId === item.segmentId
          const retryEligible = isSegmentRetryEligible(receipt, item.segmentId, Boolean(finding) || manuallyMarked)
          const reviewFindingCode = finding?.code === 'CAMERA_HANDOFF_DRIFT'
            ? 'CAMERA_HANDOFF_DRIFT'
            : manuallyMarked ? 'MANUAL_REVIEW' : undefined
          return (
            <div key={item.segmentId} className="flex items-center justify-between gap-2 border border-white/[0.07] px-2 py-1.5">
              <div className="min-w-0">
                <span className="mr-2 text-white/76">片段 {item.index + 1}</span>
                <span className="text-white/40">{statusLabel(item.status)}</span>
                {finding ? <span className="ml-2 text-amber-100/75">{finding.message}</span> : null}
                {manuallyMarked ? <span className="ml-2 text-amber-100/75">已标记连续性差异</span> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {!finding && item.status === 'succeeded' ? (
                  <button
                    type="button"
                    onClick={() => setManualReviewSegmentId((current) => current === item.segmentId ? null : item.segmentId)}
                    className="text-[10px] text-white/48 hover:text-white/78"
                  >
                    {manuallyMarked ? '取消标记' : '标记偏差'}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!retryEligible || retryingSegmentId !== null}
                  onClick={() => { void retry(item.segmentId, reviewFindingCode) }}
                  className="rounded border border-amber-300/30 px-1.5 py-1 text-[10px] text-amber-50 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {retryingSegmentId === item.segmentId ? '提交中…' : '仅重新生成此段'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {retryStatus ? <p role="status" className="text-[11px] text-indigo-100/75">{retryStatus}</p> : null}
      {activeFinding ? <p className="text-[11px] text-amber-100/70">{activeFinding.recommendedAction}</p> : null}
    </section>
  )
}
