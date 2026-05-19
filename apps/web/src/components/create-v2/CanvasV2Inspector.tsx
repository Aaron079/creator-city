'use client'

import { useState, useEffect } from 'react'
import type { CanvasV2NodeData, CanvasV2NodeKind } from '@/lib/canvas-v2/canvasV2Adapter'

type Props = {
  node: { id: string; data: CanvasV2NodeData } | null
  projectId?: string
  workflowId?: string
  onClose: () => void
  onSave: (nodeId: string, updates: Partial<CanvasV2NodeData>) => void
  onGenerate: (nodeId: string, kind: CanvasV2NodeKind, prompt: string, providerId?: string) => Promise<void>
  onDeleteNode: (nodeId: string) => void
  onRemoveInputAsset?: (nodeId: string, assetId: string) => void
}

const PROVIDER_BY_KIND: Partial<Record<CanvasV2NodeKind, string>> = {
  image: 'volcengine-seedream-image',
  video: 'volcengine-seedance-video',
  generation: 'volcengine-seedream-image',
}

const EXECUTOR_LABELS: Record<string, string> = {
  aliyun_fc: '🔴 CN FC',
  vercel: '🔵 Vercel',
}

const PROJECT_REQUIRED_CODE = 'canvas_v2_project_required'
const PROJECT_REQUIRED_MESSAGE = '当前画布未关联项目，无法生成。请先创建或选择项目。'
const PROJECT_REQUIRED_DETAIL = `错误码：${PROJECT_REQUIRED_CODE}\n说明：${PROJECT_REQUIRED_MESSAGE}\nmissingFields: ["projectId"]`

function readMissingFields(d: CanvasV2NodeData) {
  if (Array.isArray(d.missingFields)) return d.missingFields
  const metadataMissingFields = d.metadataJson?.missingFields
  return Array.isArray(metadataMissingFields)
    ? metadataMissingFields.filter((value): value is string => typeof value === 'string')
    : []
}

export function CanvasV2Inspector({ node, projectId, workflowId, onClose, onSave, onGenerate, onDeleteNode, onRemoveInputAsset }: Props) {
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [copyDone, setCopyDone] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (node) {
      setPrompt(node.data.prompt ?? '')
      setTitle(node.data.title ?? '')
      setError('')
      setConfirmDelete(false)
    }
  }, [node?.id])

  if (!node) return null

  const d = node.data
  const canGenerate = d.kind === 'image' || d.kind === 'video' || d.kind === 'generation'
  const hasProjectBinding = Boolean(projectId || d.projectId)
  const generationDisabled = canGenerate && !hasProjectBinding
  const generationDisabledReason = PROJECT_REQUIRED_MESSAGE
  const missingFields = readMissingFields(d)
  const isProjectRequiredError = generationDisabled || (d.errorCode === 'missing_generation_input' && missingFields.includes('projectId'))
  const displayErrorCode = isProjectRequiredError && d.errorCode === 'missing_generation_input' ? PROJECT_REQUIRED_CODE : d.errorCode
  const displayErrorMessage = isProjectRequiredError ? PROJECT_REQUIRED_MESSAGE : d.errorMessage

  async function handleGenerate() {
    if (!hasProjectBinding) {
      setError(PROJECT_REQUIRED_DETAIL)
      return
    }
    if (!prompt.trim()) { setError('请输入 Prompt'); return }
    setError('')
    setGenerating(true)
    try {
      await onGenerate(node!.id, d.kind as CanvasV2NodeKind, prompt.trim(), PROVIDER_BY_KIND[d.kind as CanvasV2NodeKind])
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  function handleSave() {
    onSave(node!.id, { title: title.trim() || undefined, prompt: prompt.trim() || undefined })
    onClose()
  }

  function handleCopyDiag() {
    const diagnostic = hasProjectBinding
      ? d
      : {
          ...d,
          projectId: d.projectId ?? projectId ?? null,
          workflowId: d.workflowId ?? workflowId ?? null,
          errorCode: PROJECT_REQUIRED_CODE,
          errorMessage: PROJECT_REQUIRED_MESSAGE,
          missingFields: ['projectId'],
          metadataJson: {
            ...d.metadataJson,
            errorCode: PROJECT_REQUIRED_CODE,
            missingFields: ['projectId'],
          },
        }
    const payload = JSON.stringify(diagnostic, null, 2)
    navigator.clipboard.writeText(payload).then(() => {
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), 2000)
    }).catch(() => {
      // Fallback: show in prompt
      window.prompt('复制诊断 JSON:', payload)
    })
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    onDeleteNode(node!.id)
    onClose()
  }

  const executorLabel = d.executorKind ? (EXECUTOR_LABELS[d.executorKind] ?? d.executorKind) : null

  return (
    <div style={{
      position: 'absolute', right: 16, top: 16, bottom: 16, width: 310, zIndex: 20,
      background: 'rgba(10,10,22,.97)', border: '1px solid rgba(124,58,237,.35)', borderRadius: 16,
      padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
      backdropFilter: 'blur(16px)', boxShadow: '0 8px 40px rgba(0,0,0,.6)',
      overflowY: 'auto', fontFamily: 'system-ui,sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 14, fontWeight: 700 }}>节点属性</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>

      {/* Kind + Status badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
        <Tag text={d.kind} color="#c4b5fd" bg="rgba(124,58,237,.18)" border="rgba(124,58,237,.3)" />
        <Tag
          text={d.status ?? 'idle'}
          color={d.status === 'succeeded' ? '#6ee7b7' : d.status === 'failed' ? '#fca5a5' : d.status === 'running' ? '#fbbf24' : '#94a3b8'}
          bg={d.status === 'succeeded' ? 'rgba(16,185,129,.12)' : d.status === 'failed' ? 'rgba(239,68,68,.12)' : d.status === 'running' ? 'rgba(251,191,36,.12)' : 'rgba(148,163,184,.1)'}
          border={d.status === 'succeeded' ? 'rgba(16,185,129,.25)' : d.status === 'failed' ? 'rgba(239,68,68,.3)' : d.status === 'running' ? 'rgba(251,191,36,.3)' : 'rgba(148,163,184,.2)'}
        />
        {executorLabel && (
          <Tag text={executorLabel} color="#93c5fd" bg="rgba(59,130,246,.1)" border="rgba(59,130,246,.25)" />
        )}
      </div>

      {/* Title */}
      <Field label="标题">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="节点标题…"
          style={inputStyle}
        />
      </Field>

      {/* Prompt */}
      <Field label="Prompt">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="输入生成提示词…"
          rows={5}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </Field>

      {/* Metadata fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <InfoRow label="Project ID" value={d.projectId ?? projectId ?? '未关联项目'} mono />
        <InfoRow label="Workflow ID" value={d.workflowId ?? workflowId ?? '未绑定 workflow'} mono />
        {d.providerId && <InfoRow label="Provider" value={d.providerId} />}
        {d.providerRegion && <InfoRow label="Provider 区域" value={d.providerRegion} />}
        {d.executionRegion && <InfoRow label="执行区域" value={d.executionRegion} />}
        {d.storageRegion && <InfoRow label="存储区域" value={d.storageRegion} />}
        {d.executorKind && <InfoRow label="执行器" value={executorLabel ?? d.executorKind} />}
        {d.generationJobId && <InfoRow label="生成任务 ID" value={d.generationJobId} mono />}
        {d.assetId && <InfoRow label="Asset ID" value={d.assetId} mono copyable />}
      </div>

      {/* Asset node extra fields */}
      {d.kind === 'asset' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#c4b5fd', fontWeight: 700, marginBottom: 2 }}>素材详情</div>
          {d.stableUrl && <InfoRow label="Stable URL" value={d.stableUrl} mono copyable />}
          {d.resolvedUrl && d.resolvedUrl !== d.stableUrl && <InfoRow label="Resolved URL" value={d.resolvedUrl} mono />}
          {d.storageProvider && <InfoRow label="存储提供商" value={d.storageProvider} />}
          {(d.metadataJson?.storageKey as string | undefined) && <InfoRow label="Storage Key" value={d.metadataJson?.storageKey as string} mono />}
          {(d.metadataJson?.sourceProviderRegion as string | undefined) && <InfoRow label="来源区域" value={d.metadataJson?.sourceProviderRegion as string} />}
        </div>
      )}

      {/* Input Assets section */}
      {Array.isArray(d.inputAssets) && d.inputAssets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>
            参考素材 ({d.inputAssets.length})
          </div>
          {d.assetRegionBridgeRequired && (
            <div style={{ padding: '6px 8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, fontSize: 11, color: '#fcd34d' }}>
              ⚠ asset_region_bridge_required
              {d.assetRegionBridgeReason && <div style={{ color: '#fbbf24', marginTop: 2, fontSize: 10 }}>{d.assetRegionBridgeReason}</div>}
            </div>
          )}
          {d.inputAssets.map((a) => (
            <div key={a.assetId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}>
              <span style={{ fontSize: 14 }}>{a.kind === 'image' ? '🖼️' : a.kind === 'video' ? '🎬' : '📦'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.assetId.slice(0, 12)}…</div>
                <div style={{ fontSize: 10, color: '#6b7280' }}>{a.storageRegion ?? 'cn'} / {a.sourceProviderRegion ?? 'cn'}</div>
              </div>
              {onRemoveInputAsset && (
                <button
                  onClick={() => onRemoveInputAsset(node!.id, a.assetId)}
                  title="删除此参考素材"
                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}
                >✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {canGenerate && !hasProjectBinding && (
        <div style={{ padding: '8px 10px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 8, color: '#fcd34d', fontSize: 12, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 800 }}>错误码：{PROJECT_REQUIRED_CODE}</div>
          <div>说明：{PROJECT_REQUIRED_MESSAGE}</div>
        </div>
      )}

      {/* Error info */}
      {d.status === 'failed' && (d.errorMessage || d.errorCode || d.upstreamMessage) && (
        <div style={{ padding: '8px 10px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {displayErrorCode && <span style={{ color: '#f87171', fontSize: 11, fontWeight: 700 }}>{displayErrorCode}</span>}
          {displayErrorMessage && <span style={{ color: '#fca5a5', fontSize: 12 }}>{displayErrorMessage}</span>}
          {d.upstreamMessage && (
            <details style={{ cursor: 'pointer' }}>
              <summary style={{ color: '#f87171', fontSize: 11, fontWeight: 600 }}>上游消息</summary>
              <span style={{ color: '#fca5a5', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>{d.upstreamMessage}</span>
            </details>
          )}
        </div>
      )}

      {/* Result preview */}
      {d.resultImageUrl && (
        <div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>生成结果</div>
          <img src={d.resultImageUrl} alt="result" style={{ width: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,.08)' }} />
        </div>
      )}
      {d.resultVideoUrl && (
        <div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>生成视频</div>
          <video src={d.resultVideoUrl} controls style={{ width: '100%', borderRadius: 8 }} />
        </div>
      )}

      {/* Error from generate action */}
      {error && (
        <div style={{ padding: '7px 10px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: '#fca5a5', fontSize: 12, whiteSpace: 'pre-line' }}>
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8, flexShrink: 0 }}>
        <button
          onClick={handleSave}
          style={{ flex: 1, padding: '8px 0', background: 'rgba(124,58,237,.18)', border: '1px solid rgba(124,58,237,.4)', borderRadius: 8, color: '#c4b5fd', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
        >
          保存节点
        </button>
        {canGenerate && (
          <button
            onClick={handleGenerate}
            disabled={generating || generationDisabled}
            title={generationDisabled ? generationDisabledReason : undefined}
            style={{ flex: 1, padding: '8px 0', background: generating || generationDisabled ? 'rgba(124,58,237,.1)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: '1px solid rgba(124,58,237,.5)', borderRadius: 8, color: generating || generationDisabled ? '#6b7280' : '#fff', fontSize: 13, cursor: generating || generationDisabled ? 'not-allowed' : 'pointer', fontWeight: 700 }}
          >
            {generating ? '生成中…' : '生成'}
          </button>
        )}
      </div>

      {/* Secondary buttons */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleCopyDiag}
          style={{ flex: 1, padding: '7px 0', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: copyDone ? '#6ee7b7' : '#64748b', fontSize: 12, cursor: 'pointer' }}
        >
          {copyDone ? '✓ 已复制' : '复制诊断 JSON'}
        </button>
        <button
          onClick={handleDelete}
          style={{ flex: 1, padding: '7px 0', background: confirmDelete ? 'rgba(239,68,68,.18)' : 'rgba(255,255,255,.04)', border: `1px solid ${confirmDelete ? 'rgba(239,68,68,.5)' : 'rgba(255,255,255,.1)'}`, borderRadius: 8, color: confirmDelete ? '#fca5a5' : '#64748b', fontSize: 12, cursor: 'pointer' }}
          onBlur={() => setTimeout(() => setConfirmDelete(false), 300)}
        >
          {confirmDelete ? '确认删除？' : '删除节点'}
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 8,
  padding: '7px 10px',
  color: '#e2e8f0',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

function Tag({ text, color, bg, border }: { text: string; color: string; bg: string; border: string }) {
  return (
    <span style={{ padding: '2px 8px', background: bg, border: `1px solid ${border}`, borderRadius: 6, color, fontSize: 11, fontWeight: 600 }}>
      {text}
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  )
}

function InfoRow({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => window.prompt('复制:', value))
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all', textAlign: 'right' }}>{value.length > 40 ? value.slice(0, 38) + '…' : value}</span>
        {copyable && (
          <button onClick={handleCopy} title="复制" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: copied ? '#6ee7b7' : '#4b5563', padding: 0, flexShrink: 0 }}>
            {copied ? '✓' : '⎘'}
          </button>
        )}
      </span>
    </div>
  )
}
