'use client'

import { useState, useCallback } from 'react'
import { DirectorToolPanelFrame } from '@/components/canvas/tools/DirectorToolPanelFrame'
import type { DirectorSourceNode } from '@/components/canvas/tools/DirectorToolPanelFrame'
import type { AssetTransformResult } from '@/lib/asset-transform/assetTransformTypes'
import { getTransformErrorInfo } from '@/lib/asset-transform/assetTransformErrors'

export interface RemoveBackgroundPanelProps {
  /** Source image node. resultImageUrl is used only to confirm the node has a result; URL is NOT sent to server. */
  sourceNode: DirectorSourceNode & { id: string; resultImageUrl?: string | null }
  projectId: string
  workflowId?: string | null
  onCreateDerivedNode: (opts: {
    sourceNodeId: string
    title: string
    resultImageUrl?: string
    maskUrl?: string
    assetTransformMeta: Record<string, unknown>
  }) => void
  onClose: () => void
}

type JobStatus = 'idle' | 'submitting' | 'polling' | 'done' | 'failed' | 'unavailable'

const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 40 // 2 minutes

export function RemoveBackgroundPanel({
  sourceNode,
  projectId,
  workflowId,
  onCreateDerivedNode,
  onClose,
}: RemoveBackgroundPanelProps) {
  const [featherRadius, setFeatherRadius] = useState(2)
  const [status, setStatus] = useState<JobStatus>('idle')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [result, setResult] = useState<AssetTransformResult | null>(null)

  // sourceImageUrl is used only to verify the node has a result before submitting.
  // The server resolves the actual URL from the DB — we never send it.
  const hasSourceResult = !!sourceNode.resultImageUrl

  const handleExecute = useCallback(async () => {
    if (!hasSourceResult) return
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
          transformKind: 'remove-background',
          projectId,
          workflowId: workflowId ?? undefined,
          sourceNodeId: sourceNode.id,
          // sourceMediaUrl is intentionally omitted — server resolves from DB
          params: {
            mode: 'auto', // V1: auto mode only; text mode available when executor confirms support
            featherRadius,
          },
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
  }, [sourceNode.id, hasSourceResult, projectId, workflowId, featherRadius])

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
      // All four platform ingestion fields must be present before a derived node can be created.
      // A result with status='done' but missing any field is TRANSFORM_OUTPUT_INGESTION_BLOCKED —
      // even if outputMediaUrl (executor-ephemeral) is present.
      if (
        r.ingestionStatus === 'validated' &&
        r.outputAssetId &&
        r.stableOutputMediaUrl &&
        r.outputOwner === 'creator-city'
      ) {
        setStatus('done')
      } else {
        setErrorCode('TRANSFORM_OUTPUT_INGESTION_BLOCKED')
        setStatus('failed')
      }
    } else {
      setErrorCode(r.errorCode ?? 'TRANSFORM_OUTPUT_MISSING')
      setStatus('failed')
    }
  }, [])

  const handleCreateNode = useCallback(() => {
    // All five ingestion criteria required. stableOutputMediaUrl is the platform-owned URL —
    // never the executor-ephemeral outputMediaUrl.
    if (
      !result?.outputAssetId ||
      !result.stableOutputMediaUrl ||
      result.outputOwner !== 'creator-city' ||
      result.ingestionStatus !== 'validated'
    ) return
    onCreateDerivedNode({
      sourceNodeId: sourceNode.id,
      title: `${sourceNode.title ?? '图片'} · 主体抠图`,
      resultImageUrl: result.stableOutputMediaUrl,
      maskUrl: result.maskUrl,
      assetTransformMeta: {
        transformKind: 'remove-background',
        transformId: result.transformId,
        sourceNodeId: sourceNode.id,
        outputAssetId: result.outputAssetId,
        executorId: 'asset-transform-executor',
        params: { mode: 'auto', featherRadius },
        createdAt: new Date().toISOString(),
      },
    })
    onClose()
  }, [result, sourceNode.id, sourceNode.title, featherRadius, onCreateDerivedNode, onClose])

  const errorInfo = errorCode ? getTransformErrorInfo(errorCode) : null

  const primaryLabel =
    status === 'submitting' ? '提交中…' :
    status === 'polling' ? '处理中…' :
    status === 'done' ? '创建主体节点' :
    '执行主体抠图'

  const primaryDisabled =
    !hasSourceResult ||
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
      title="主体抠图"
      titleEn="Subject Extraction"
      icon="✂"
      accentColor="indigo"
      summary={
        status === 'idle' ? '自动识别并提取主体为透明 PNG' :
        status === 'submitting' ? '提交任务中…' :
        status === 'polling' ? '执行器处理中，请稍候…' :
        status === 'done' ? '主体提取完成 — 点击创建派生节点' :
        status === 'failed' ? (errorInfo?.title ?? '处理失败') :
        status === 'unavailable' ? '功能未启用' :
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
      {/* ── Feature disabled / executor unavailable ── */}
      {status === 'unavailable' && (
        <div style={{
          margin: '16px 12px',
          padding: '14px',
          borderRadius: 8,
          border: '1px solid rgba(239,68,68,0.25)',
          background: 'rgba(239,68,68,0.06)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(239,68,68,0.85)', marginBottom: 6 }}>
            功能未启用
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            主体抠图需要专用 GPU 执行器（SAM2 / rembg）。当前环境尚未配置此服务，请联系运营团队开通。
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {status === 'failed' && errorInfo && (
        <div style={{
          margin: '16px 12px',
          padding: '14px',
          borderRadius: 8,
          border: '1px solid rgba(239,68,68,0.2)',
          background: 'rgba(239,68,68,0.05)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(239,68,68,0.85)', marginBottom: 4 }}>
            {errorInfo.title}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: errorInfo.canRetry ? 10 : 0 }}>
            {errorInfo.description}
          </div>
          {errorInfo.canRetry && (
            <div style={{ fontSize: 10, color: 'rgba(99,102,241,0.7)' }}>源资产未受影响。可重试。</div>
          )}
        </div>
      )}

      {/* ── Done: checkerboard preview ── */}
      {status === 'done' && result?.stableOutputMediaUrl && (
        <div style={{ margin: '12px 12px 0', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{
            background: 'repeating-conic-gradient(#333 0% 25%, #444 0% 50%) 0 0 / 16px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 120,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.stableOutputMediaUrl}
              alt="主体抠图结果预览"
              style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
            />
          </div>
          <div style={{ padding: '8px 12px', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            棋盘格表示透明区域 · 主体已提取
          </div>
        </div>
      )}

      {/* ── Idle / failed: controls ── */}
      {(status === 'idle' || status === 'failed') && (
        <div style={{ padding: '12px 12px 0' }}>
          {/* Mode: V1 auto only — text/click modes shown when executor confirms support */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              提取模式
            </div>
            <div style={{
              padding: '6px 11px',
              borderRadius: 6,
              border: '1px solid rgba(99,102,241,0.3)',
              background: 'rgba(99,102,241,0.08)',
              color: 'rgba(167,139,250,0.9)',
              fontSize: 11,
              display: 'inline-block',
            }}>
              自动识别主体
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 5, lineHeight: 1.5 }}>
              V1 仅支持自动模式。文本/点击指定模式待执行器能力确认后开放。
            </div>
          </div>

          {/* Feather */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                边缘羽化
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{featherRadius}px</div>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={featherRadius}
              onChange={(e) => setFeatherRadius(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#6366f1' }}
            />
          </div>

          {/* Source immutable notice */}
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
            源资产不会被修改。抠图结果将创建为新的派生图片节点。
          </div>
        </div>
      )}

      {/* ── Polling indicator ── */}
      {(status === 'submitting' || status === 'polling') && (
        <div style={{ padding: '24px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
            {status === 'submitting' ? '正在提交任务…' : '执行器处理中，请耐心等待…'}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
            不要关闭此面板，处理完成后将自动显示结果。
          </div>
        </div>
      )}
    </DirectorToolPanelFrame>
  )
}
