'use client'

import { useState, useCallback } from 'react'
import { DirectorToolPanelFrame } from '@/components/canvas/tools/DirectorToolPanelFrame'
import type { DirectorSourceNode } from '@/components/canvas/tools/DirectorToolPanelFrame'
import type { AssetTransformResult } from '@/lib/asset-transform/assetTransformTypes'
import { getTransformErrorInfo } from '@/lib/asset-transform/assetTransformErrors'

export interface HdReconstructionPanelProps {
  sourceNode: DirectorSourceNode & {
    id: string
    resultImageUrl?: string | null
    /** Optional known dimensions of the source image. */
    sourceWidth?: number
    sourceHeight?: number
  }
  projectId: string
  workflowId?: string | null
  onCreateDerivedNode: (opts: {
    sourceNodeId: string
    title: string
    resultImageUrl?: string
    assetTransformMeta: Record<string, unknown>
  }) => void
  onClose: () => void
}

type ScaleFactor = 2 | 4
type ReconstructionMode = 'general' | 'illustration'
type JobStatus = 'idle' | 'submitting' | 'polling' | 'done' | 'failed' | 'unavailable'

const POLL_INTERVAL_MS = 4000
const MAX_POLLS = 45 // 3 minutes

export function HdReconstructionPanel({
  sourceNode,
  projectId,
  workflowId,
  onCreateDerivedNode,
  onClose,
}: HdReconstructionPanelProps) {
  const [scale, setScale] = useState<ScaleFactor>(2)
  const [mode, setMode] = useState<ReconstructionMode>('general')
  const [denoisingStrength, setDenoisingStrength] = useState(0.35)
  const [status, setStatus] = useState<JobStatus>('idle')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [result, setResult] = useState<AssetTransformResult | null>(null)

  const sourceImageUrl = sourceNode.resultImageUrl ?? null
  const sw = sourceNode.sourceWidth
  const sh = sourceNode.sourceHeight

  const handleExecute = useCallback(async () => {
    if (!sourceImageUrl) return
    setStatus('submitting')
    setErrorCode(null)
    setResult(null)

    try {
      const res = await fetch('/api/asset-transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          transformKind: 'upscale',
          projectId,
          workflowId: workflowId ?? undefined,
          sourceNodeId: sourceNode.id,
          // sourceMediaUrl intentionally omitted — server resolves from DB
          params: { scale, mode, denoisingStrength },
        }),
      })

      const body = await res.json().catch(() => ({})) as {
        success?: boolean
        result?: AssetTransformResult
        errorCode?: string
        message?: string
      }

      if (!res.ok) {
        const code = body.errorCode ?? 'TRANSFORM_UNKNOWN'
        if (code === 'TRANSFORM_EXECUTOR_UNAVAILABLE') {
          setStatus('unavailable')
        } else {
          setErrorCode(code)
          setStatus('failed')
        }
        return
      }

      const transformResult = body.result
      if (!transformResult) {
        setErrorCode('TRANSFORM_UNKNOWN')
        setStatus('failed')
        return
      }

      if (transformResult.status === 'queued' || transformResult.status === 'running') {
        setStatus('polling')
        await pollUntilDone(transformResult.transformId)
        return
      }

      handleDone(transformResult)
    } catch {
      setErrorCode('TRANSFORM_UNKNOWN')
      setStatus('failed')
    }
  }, [sourceNode.id, projectId, workflowId, scale, mode, denoisingStrength, sourceImageUrl])

  const pollUntilDone = useCallback(async (transformId: string) => {
    let polls = 0
    while (polls < MAX_POLLS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      polls++
      try {
        const res = await fetch(`/api/asset-transform?transformId=${encodeURIComponent(transformId)}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        const body = await res.json().catch(() => ({})) as { result?: AssetTransformResult }
        const r = body.result
        if (!r) continue
        if (r.status === 'done' || r.status === 'failed' || r.status === 'cancelled') {
          handleDone(r)
          return
        }
      } catch {
        // continue polling
      }
    }
    setErrorCode('TRANSFORM_TIMEOUT')
    setStatus('failed')
  }, [])

  const handleDone = useCallback((r: AssetTransformResult) => {
    setResult(r)
    if (r.status === 'done') {
      if (r.outputAssetId && r.outputMediaUrl) {
        // Both a stable platform asset ID and a media URL are required.
        // outputAssetId confirms the output was ingested into platform storage.
        setStatus('done')
      } else {
        // Executor completed but no stable asset ID — ingestion not complete.
        // Do not allow derived node creation with executor-ephemeral URL.
        setErrorCode('TRANSFORM_OUTPUT_INGESTION_BLOCKED')
        setStatus('failed')
      }
    } else {
      setErrorCode(r.errorCode ?? 'TRANSFORM_OUTPUT_MISSING')
      setStatus('failed')
    }
  }, [])

  const handleCreateNode = useCallback(() => {
    // Require outputAssetId to confirm platform ingestion before creating derived node.
    // Never write executor-ephemeral outputMediaUrl to the canvas without a stable asset ID.
    if (!result?.outputAssetId || !result.outputMediaUrl) return
    onCreateDerivedNode({
      sourceNodeId: sourceNode.id,
      title: `${sourceNode.title ?? '图片'} · ${scale}× HD`,
      resultImageUrl: result.outputMediaUrl,
      assetTransformMeta: {
        transformKind: 'upscale',
        transformId: result.transformId,
        sourceNodeId: sourceNode.id,
        outputAssetId: result.outputAssetId,
        executorId: 'asset-transform-executor',
        params: { scale, mode, denoisingStrength },
        outputDimensions: result.metadata?.outputDimensions,
        createdAt: new Date().toISOString(),
      },
    })
    onClose()
  }, [result, sourceNode.id, sourceNode.title, scale, mode, denoisingStrength, onCreateDerivedNode, onClose])

  const errorInfo = errorCode ? getTransformErrorInfo(errorCode) : null

  const primaryLabel =
    status === 'submitting' ? '提交中…' :
    status === 'polling' ? '处理中…' :
    status === 'done' ? '创建高清节点' :
    '执行高清重建'

  const primaryDisabled =
    !sourceImageUrl ||
    status === 'submitting' ||
    status === 'polling' ||
    status === 'unavailable'

  function handlePrimary() {
    if (status === 'done') {
      handleCreateNode()
    } else {
      void handleExecute()
    }
  }

  return (
    <DirectorToolPanelFrame
      title="高清重建"
      titleEn="HD Reconstruction"
      icon="⬆"
      accentColor="amber"
      summary={
        status === 'idle' ? '2× / 4× 分辨率重建。源资产不变。' :
        status === 'submitting' ? '提交任务中…' :
        status === 'polling' ? '执行器处理中，请稍候…' :
        status === 'done' ? `${scale}× 重建完成 — 点击创建派生节点` :
        status === 'failed' ? (errorInfo?.title ?? '处理失败') :
        status === 'unavailable' ? '执行器未配置' :
        ''
      }
      sourceNode={sourceNode}
      primaryLabel={primaryLabel}
      primaryDisabled={primaryDisabled}
      onPrimary={handlePrimary}
      onClear={status !== 'idle' ? () => {
        setStatus('idle')
        setResult(null)
        setErrorCode(null)
      } : undefined}
      clearLabel="重置"
      onClose={onClose}
    >
      {/* ── Executor unavailable ── */}
      {status === 'unavailable' && (
        <div style={{
          margin: '16px 12px',
          padding: '14px 14px',
          borderRadius: 8,
          border: '1px solid rgba(239,68,68,0.25)',
          background: 'rgba(239,68,68,0.06)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(239,68,68,0.85)', marginBottom: 6 }}>
            执行器未配置
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            高清重建需要专用 GPU 执行器支持（Real-ESRGAN 或商业等效服务）。
            当前生产环境尚未配置此服务，请联系运营团队开通后再使用此功能。
          </div>
          <div style={{ fontSize: 10, color: 'rgba(245,158,11,0.6)', marginTop: 8 }}>
            注：高清重建只能增强现有细节，无法凭空恢复不存在的真实信息。
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {status === 'failed' && errorInfo && (
        <div style={{
          margin: '16px 12px',
          padding: '14px 14px',
          borderRadius: 8,
          border: '1px solid rgba(239,68,68,0.2)',
          background: 'rgba(239,68,68,0.05)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(239,68,68,0.85)', marginBottom: 4 }}>
            {errorInfo.title}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            {errorInfo.description}
          </div>
        </div>
      )}

      {/* ── Done: result preview ── */}
      {status === 'done' && result?.outputMediaUrl && (
        <div style={{ margin: '12px 12px 0' }}>
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.outputMediaUrl}
              alt="高清重建结果预览"
              style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: 200 }}
            />
          </div>
          {typeof result.metadata?.outputDimensions === 'string' && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
              输出尺寸：{result.metadata.outputDimensions}
            </div>
          )}
        </div>
      )}

      {/* ── Idle / failed: controls ── */}
      {(status === 'idle' || status === 'failed') && (
        <div style={{ padding: '12px 12px 0' }}>
          {/* Scale factor */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              目标倍率
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([2, 4] as ScaleFactor[]).map((s) => {
                const outW = sw ? sw * s : null
                const outH = sh ? sh * s : null
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScale(s)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 6,
                      border: `1px solid ${scale === s ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      background: scale === s ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
                      color: scale === s ? 'rgba(252,211,77,0.9)' : 'rgba(255,255,255,0.45)',
                      fontSize: 12,
                      fontWeight: scale === s ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                      flexShrink: 0,
                    }}
                  >
                    {s}×
                    {outW && outH ? (
                      <span style={{ fontSize: 9, opacity: 0.55, display: 'block', marginTop: 1 }}>
                        {outW}×{outH}
                      </span>
                    ) : null}
                  </button>
                )
              })}
              {!sw && !sh && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', alignSelf: 'center', paddingLeft: 4 }}>
                  原图尺寸未知
                </div>
              )}
            </div>
          </div>

          {/* Mode */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              重建模式
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                { value: 'general' as ReconstructionMode, label: '通用' },
                { value: 'illustration' as ReconstructionMode, label: '插画 / 动漫' },
              ] satisfies { value: ReconstructionMode; label: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 6,
                    border: `1px solid ${mode === opt.value ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    background: mode === opt.value ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
                    color: mode === opt.value ? 'rgba(252,211,77,0.9)' : 'rgba(255,255,255,0.45)',
                    fontSize: 11,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Denoising strength */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                去噪强度
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{denoisingStrength.toFixed(2)}</div>
            </div>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.05}
              value={denoisingStrength}
              onChange={(e) => setDenoisingStrength(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#f59e0b' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>
              <span>保留更多细节</span>
              <span>重建更多内容</span>
            </div>
          </div>

          {/* Source immutable + disclaimer */}
          <div style={{
            marginTop: 16,
            padding: '8px 10px',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontSize: 10,
            color: 'rgba(255,255,255,0.25)',
            lineHeight: 1.6,
          }}>
            源资产不会被修改。高清版本将创建为新的派生图片节点。
            高清重建只能增强现有细节，无法恢复不存在的真实信息。
          </div>
        </div>
      )}

      {/* ── Polling indicator ── */}
      {(status === 'submitting' || status === 'polling') && (
        <div style={{ padding: '24px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
            {status === 'submitting' ? '正在提交任务…' : '高清重建处理中，请耐心等待…'}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
            高清重建通常需要 30–90 秒。不要关闭此面板。
          </div>
        </div>
      )}
    </DirectorToolPanelFrame>
  )
}
