'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth.store'

// ── Types ──────────────────────────────────────────────────────────────────

type Provider = {
  providerId: string
  label: string
  type: 'image' | 'video'
}

type EnvInfo = {
  cnExecutorConfigured: boolean
  cnSecretConfigured: boolean
  ossBucket: string | null
  ossRegion: string | null
  seedreamModel: string | null
}

type GenerateResult = {
  success: boolean
  status: string
  generationJobId?: string | null
  providerId?: string | null
  providerRegion?: string | null
  executionRegion?: string | null
  storageRegion?: string | null
  executor?: string | null
  executorKind?: string | null
  cnExecutorHttpStatus?: number | null
  projectId?: string | null
  workflowId?: string | null
  nodeId?: string | null
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  stableUrl?: string | null
  assetId?: string | null
  errorCode?: string | null
  errorStage?: string | null
  stageTrace?: unknown
  message?: string | null
  upstreamMessage?: string | null
  upstreamStatus?: number | null
  cnExecutorResult?: unknown
}

// ── Constants ─────────────────────────────────────────────────────────────

const ASPECT_RATIOS = ['16:9', '1:1', '9:16', '4:3', '3:4', '21:9']

const POLL_INTERVAL_MS = 4000
const MAX_POLLS = 60

// ── Helpers ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'succeeded' ? '#22c55e'
    : status === 'failed' ? '#f43f5e'
    : status === 'running' || status === 'queued' ? '#f59e0b'
    : '#6b7280'
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 99,
      background: color + '22',
      border: `1px solid ${color}55`,
      color,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      {status}
    </span>
  )
}

function DebugRow({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null
  const display = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
  const isCode = typeof value === 'object' || display.length > 80
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ flexShrink: 0, width: 180, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{label}</span>
      {isCode ? (
        <pre style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', flex: 1 }}>
          {display}
        </pre>
      ) : (
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', wordBreak: 'break-all' }}>{display}</span>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function GenerationLabPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  const [providers, setProviders] = useState<Provider[]>([])
  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null)
  const [envLoading, setEnvLoading] = useState(true)

  const [prompt, setPrompt] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('volcengine-seedream-image')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [generatingType, setGeneratingType] = useState<'image' | 'video'>('image')

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [pollStatus, setPollStatus] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Auth guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth/login?next=/generation-lab')
    }
  }, [isAuthenticated, router])

  // ── Load providers + env info ───────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/lab/generate', { credentials: 'include' })
        const data = await res.json() as { providers?: Provider[]; env?: EnvInfo }
        if (data.providers) setProviders(data.providers)
        if (data.env) setEnvInfo(data.env)
      } catch {
        // non-fatal
      } finally {
        setEnvLoading(false)
      }
    })()
  }, [])

  // ── Cleanup poll on unmount ─────────────────────────────────────────────
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current) }, [])

  // ── Provider type inference ─────────────────────────────────────────────
  function getProviderType(pid: string): 'image' | 'video' {
    return providers.find((p) => p.providerId === pid)?.type ?? 'image'
  }

  // ── Poll image/video status ─────────────────────────────────────────────
  async function pollStatus_image(jobId: string, polls = 0): Promise<void> {
    if (polls >= MAX_POLLS) {
      setPollStatus(null)
      setResult((prev) => prev ? { ...prev, status: 'failed', errorCode: 'poll_timeout', message: '轮询超时，请在 /admin/health 查看任务状态。' } : prev)
      return
    }
    setPollStatus(`轮询中… (${polls + 1}/${MAX_POLLS})`)
    pollRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/generate/image/status?generationJobId=${encodeURIComponent(jobId)}`, { credentials: 'include' })
        const data = await res.json() as GenerateResult
        setResult((prev) => ({ ...prev, ...data }))
        if (data.status === 'running' || data.status === 'queued') {
          await pollStatus_image(jobId, polls + 1)
        } else {
          setPollStatus(null)
          setLoading(false)
        }
      } catch {
        setPollStatus(null)
        setLoading(false)
      }
    }, POLL_INTERVAL_MS)
  }

  async function pollStatus_video(jobId: string, polls = 0): Promise<void> {
    if (polls >= MAX_POLLS) {
      setPollStatus(null)
      setResult((prev) => prev ? { ...prev, status: 'failed', errorCode: 'poll_timeout', message: '视频轮询超时。' } : prev)
      return
    }
    setPollStatus(`视频轮询中… (${polls + 1}/${MAX_POLLS})`)
    pollRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/generate/video/status?generationJobId=${encodeURIComponent(jobId)}`, { credentials: 'include' })
        const data = await res.json() as GenerateResult
        setResult((prev) => ({ ...prev, ...data }))
        if (data.status === 'running' || data.status === 'queued') {
          await pollStatus_video(jobId, polls + 1)
        } else {
          setPollStatus(null)
          setLoading(false)
        }
      } catch {
        setPollStatus(null)
        setLoading(false)
      }
    }, POLL_INTERVAL_MS)
  }

  // ── Generate ────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!prompt.trim() || loading) return
    const type = getProviderType(selectedProvider)
    setGeneratingType(type)
    setLoading(true)
    setResult(null)
    setPollStatus(null)
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }

    try {
      const res = await fetch('/api/lab/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), providerId: selectedProvider, aspectRatio, type }),
      })
      const data = await res.json() as GenerateResult
      setResult(data)

      const jobId = data.generationJobId
      if (jobId && (data.status === 'running' || data.status === 'queued' || data.status === 'QUEUED' || data.status === 'PROCESSING')) {
        if (type === 'video') {
          await pollStatus_video(jobId)
        } else {
          await pollStatus_image(jobId)
        }
      } else {
        setLoading(false)
      }
    } catch (err) {
      setResult({ success: false, status: 'failed', errorCode: 'network_error', message: err instanceof Error ? err.message : '请求失败' })
      setLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>跳转到登录页…</p>
      </div>
    )
  }

  const mediaUrl = result?.stableUrl || result?.resultImageUrl || result?.resultVideoUrl
  const isVideo = generatingType === 'video' || Boolean(result?.resultVideoUrl)

  return (
    <div style={{ minHeight: '100vh', background: '#080c14', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>← Creator City</Link>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>Generation Lab</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', padding: '2px 8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4 }}>最小诊断链路</span>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Env Info Panel */}
        {!envLoading && envInfo && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>环境检查</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {([
                ['CN Executor URL', envInfo.cnExecutorConfigured],
                ['CN Secret', envInfo.cnSecretConfigured],
                ['OSS Bucket', envInfo.ossBucket ? `${envInfo.ossBucket}` : false],
                ['OSS Region', envInfo.ossRegion ? `${envInfo.ossRegion}` : false],
                ['Seedream Model', envInfo.seedreamModel ? '已配置' : false],
              ] as [string, string | boolean][]).map(([label, val]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{val ? '✅' : '❌'}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                  {typeof val === 'string' && val !== 'true' && (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{val}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>最小生成请求</div>

          {/* Prompt */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="输入生成 prompt，不经过风格圣经或 skills 处理"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '10px 14px',
                color: '#fff',
                fontSize: 14,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Provider + Ratio */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Provider</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {providers.length > 0 ? providers.map((p) => (
                  <option key={p.providerId} value={p.providerId}>{p.label} [{p.type}]</option>
                )) : (
                  <>
                    <option value="volcengine-seedream-image">火山 Seedream 图片 [image]</option>
                    <option value="volcengine-seedance-video">火山 Seedance 视频 [video]</option>
                  </>
                )}
              </select>
            </div>

            <div style={{ flex: '0 0 140px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {ASPECT_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={() => { void handleGenerate() }}
            disabled={loading || !prompt.trim()}
            style={{
              background: loading ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              padding: '11px 24px',
              color: loading ? 'rgba(255,255,255,0.3)' : '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              letterSpacing: '0.03em',
            }}
          >
            {loading ? (pollStatus ?? '生成中…') : '生成'}
          </button>

          {/* Minimal payload preview */}
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>发送的最小请求体（不含风格圣经/skills/assets）</div>
            <pre style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify({ prompt: prompt || '<prompt>', providerId: selectedProvider, aspectRatio, type: getProviderType(selectedProvider) }, null, 2)}
            </pre>
          </div>
        </div>

        {/* Result Panel */}
        {result && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Status header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>结果</div>
              <StatusBadge status={result.status} />
              {result.errorCode && (
                <span style={{ fontSize: 12, color: '#f43f5e', fontFamily: 'monospace' }}>{result.errorCode}</span>
              )}
            </div>

            {/* Media output */}
            {mediaUrl && (
              <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.08)' }}>
                {isVideo ? (
                  <video
                    src={mediaUrl}
                    controls
                    style={{ width: '100%', maxHeight: 400, display: 'block' }}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl}
                    alt="生成结果"
                    style={{ width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block' }}
                  />
                )}
                <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.4)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <a href={mediaUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', wordBreak: 'break-all', flex: 1 }}>
                    {mediaUrl}
                  </a>
                </div>
              </div>
            )}

            {/* Debug fields */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>Debug</div>
              <DebugRow label="generationJobId" value={result.generationJobId} />
              <DebugRow label="status" value={result.status} />
              <DebugRow label="errorCode" value={result.errorCode} />
              <DebugRow label="errorStage" value={result.errorStage} />
              <DebugRow label="message" value={result.message} />
              <DebugRow label="upstreamStatus" value={result.upstreamStatus} />
              <DebugRow label="upstreamMessage" value={result.upstreamMessage} />
              <DebugRow label="providerId" value={result.providerId} />
              <DebugRow label="providerRegion" value={result.providerRegion} />
              <DebugRow label="executionRegion" value={result.executionRegion} />
              <DebugRow label="executor" value={result.executor} />
              <DebugRow label="executorKind" value={result.executorKind} />
              <DebugRow label="cnExecutorHttpStatus" value={result.cnExecutorHttpStatus} />
              <DebugRow label="projectId" value={result.projectId} />
              <DebugRow label="workflowId" value={result.workflowId} />
              <DebugRow label="nodeId" value={result.nodeId} />
              <DebugRow label="assetId" value={result.assetId} />
              <DebugRow label="stableUrl" value={result.stableUrl} />
              <DebugRow label="resultImageUrl" value={result.resultImageUrl} />
              <DebugRow label="resultVideoUrl" value={result.resultVideoUrl} />
              {result.stageTrace !== undefined && result.stageTrace !== null && (
                <DebugRow label="stageTrace" value={result.stageTrace} />
              )}
              {result.cnExecutorResult !== undefined && result.cnExecutorResult !== null && (
                <DebugRow label="cnExecutorResult (full)" value={result.cnExecutorResult} />
              )}
            </div>
          </div>
        )}

        {/* Links */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { href: '/create', label: '→ 正式 Canvas' },
            { href: '/admin/providers', label: '→ Provider 配置' },
            { href: '/admin/health', label: '→ 系统健康' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, transition: 'all 0.15s' }}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
