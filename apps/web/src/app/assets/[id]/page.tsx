'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  LICENSE_MODES,
  LICENSE_MODE_CONFIG,
  getLicenseIntent,
  type LicenseMode,
} from '@/lib/assets/license-intent'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SourceAssetItem {
  id: string
  unavailable?: boolean
  reason?: string
  title?: string | null
  type?: string
  resolvedUrl?: string | null
  thumbnailUrl?: string | null
  provider?: string | null
  source?: string | null
  mimeType?: string | null
}

interface AssetDetail {
  id: string
  name: string
  title?: string | null
  type: string
  status?: string | null
  mimeType: string
  url: string
  resolvedUrl?: string | null
  thumbnailUrl?: string | null
  width?: number | null
  height?: number | null
  duration?: number | null
  sizeBytes?: number | null
  prompt?: string | null
  negativePrompt?: string | null
  source?: string | null
  provider?: string | null
  providerId?: string | null
  providerJobId?: string | null
  generationJobId?: string | null
  projectId?: string | null
  workflowId?: string | null
  nodeId?: string | null
  storageProvider?: string | null
  isPublic: boolean
  isOwner: boolean
  tags?: string[]
  metadataJson?: unknown
  createdAt: string
  updatedAt: string
  owner?: { id: string; displayName: string }
  project?: { id: string; title: string } | null
  sourceAssets?: SourceAssetItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(b?: number | null) {
  if (!b) return null
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    IMAGE: { bg: 'rgba(96,165,250,0.12)', text: '#93c5fd' },
    VIDEO: { bg: 'rgba(167,139,250,0.12)', text: '#c4b5fd' },
    AUDIO: { bg: 'rgba(52,211,153,0.12)', text: '#6ee7b7' },
    SCRIPT: { bg: 'rgba(251,191,36,0.12)', text: '#fde68a' },
    CHARACTER: { bg: 'rgba(244,114,182,0.12)', text: '#fbcfe8' },
  }
  const c = colors[type] ?? { bg: 'rgba(255,255,255,0.07)', text: 'rgba(255,255,255,0.45)' }
  return (
    <span style={{ padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: c.bg, color: c.text, letterSpacing: '0.03em' }}>
      {type}
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
      <div style={{ width: '140px', flexShrink: 0, fontSize: '11px', color: 'rgba(255,255,255,0.32)', paddingTop: '2px', fontWeight: 500 }}>{label}</div>
      <div style={{ flex: 1, fontSize: '12px', color: 'rgba(255,255,255,0.72)', wordBreak: 'break-all' }}>{children}</div>
    </div>
  )
}

function MetaSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: '4px', fontWeight: 600 }}>{title}</div>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0 14px' }}>{children}</div>
    </div>
  )
}

// ─── Provenance Section ───────────────────────────────────────────────────────

function ProvenanceSection({ sourceAssets }: { sourceAssets?: SourceAssetItem[] }) {
  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: '4px', fontWeight: 600 }}>Provenance / 创作来源</div>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 14px' }}>
        {sourceAssets && sourceAssets.length > 0 ? (
          <>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '10px' }}>此资产基于以下来源资产创作</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sourceAssets.map((src) =>
                src.unavailable ? (
                  <div key={src.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', flexShrink: 0, fontSize: '16px' }}>🔒</div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>私有资产（无访问权限）</div>
                      <code style={{ fontSize: '10px', fontFamily: 'ui-monospace,monospace', color: 'rgba(255,255,255,0.18)' }}>{src.id.slice(0, 12)}…</code>
                    </div>
                  </div>
                ) : (
                  <a key={src.id} href={`/assets/${src.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', textDecoration: 'none' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {(src.resolvedUrl ?? src.thumbnailUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src.resolvedUrl ?? src.thumbnailUrl ?? ''} alt={src.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '16px', opacity: 0.3 }}>{src.type === 'VIDEO' ? '🎬' : src.type === 'AUDIO' ? '🎵' : '🖼️'}</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.title ?? src.id.slice(0, 16)}</div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '2px', alignItems: 'center' }}>
                        {src.type ? <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>{src.type}</span> : null}
                        {src.provider ?? src.source ? <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>· {src.provider ?? src.source}</span> : null}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>→</span>
                  </a>
                )
              )}
            </div>
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '10px', color: 'rgba(255,255,255,0.18)', lineHeight: 1.6 }}>创作来源为元数据声明，不代表平台核查或正式法律确权。</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>无输入资产记录（v0 生成或旧资产）</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.22)', lineHeight: 1.6 }}>后续版本将在生成时记录 inputAssetIds，用于追踪资产复用关系。</div>
            <div style={{ marginTop: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.18)', lineHeight: 1.6 }}>创作来源为元数据声明，不代表平台核查或正式法律确权。</div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── License Intent Editor ────────────────────────────────────────────────────

const DISCLAIMER = '授权意图为创作者本人声明，不代表平台核查、链上确权或正式法律合同。正式授权交易、定价和收益分成将在 Marketplace 阶段接入。'

function LicenseIntentEditor({
  assetId,
  currentMode,
  onSaved,
}: {
  assetId: string
  currentMode: LicenseMode | null
  onSaved: (mode: LicenseMode) => void
}) {
  const [selected, setSelected] = useState<LicenseMode>(currentMode ?? 'private_only')
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function save() {
    setSaving(true)
    setSaveResult(null)
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseIntent: { mode: selected } }),
      })
      const data = await res.json() as { message?: string; errorCode?: string }
      if (!res.ok) {
        setSaveResult({ ok: false, msg: data.message ?? data.errorCode ?? '保存失败' })
        return
      }
      setSaveResult({ ok: true, msg: '授权意图已保存' })
      onSaved(selected)
      setTimeout(() => setSaveResult(null), 3000)
    } catch {
      setSaveResult({ ok: false, msg: '网络错误，请稍后重试' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '14px 0 6px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {LICENSE_MODES.map((mode) => {
          const cfg = LICENSE_MODE_CONFIG[mode]
          const isSelected = selected === mode
          const isDisabled = !cfg.available

          return (
            <button
              key={mode}
              type="button"
              disabled={isDisabled}
              onClick={() => { if (!isDisabled) setSelected(mode) }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '9px',
                border: isSelected
                  ? '1px solid rgba(147,197,253,0.45)'
                  : '1px solid rgba(255,255,255,0.07)',
                background: isSelected
                  ? 'rgba(147,197,253,0.07)'
                  : isDisabled
                    ? 'rgba(255,255,255,0.01)'
                    : 'rgba(255,255,255,0.02)',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.45 : 1,
                textAlign: 'left',
                width: '100%',
              }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  border: isSelected ? '4px solid #93c5fd' : '2px solid rgba(255,255,255,0.25)',
                  flexShrink: 0,
                  marginTop: '2px',
                  background: 'transparent',
                }}
              />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: isDisabled ? 'rgba(255,255,255,0.3)' : isSelected ? '#93c5fd' : 'rgba(255,255,255,0.75)' }}>
                  {cfg.label}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px', lineHeight: 1.5 }}>
                  {cfg.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          onClick={() => { void save() }}
          disabled={saving}
          style={{
            padding: '7px 18px',
            borderRadius: '8px',
            border: '1px solid rgba(147,197,253,0.3)',
            background: saving ? 'rgba(147,197,253,0.04)' : 'rgba(147,197,253,0.1)',
            color: '#93c5fd',
            fontSize: '12px',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? '保存中…' : '保存授权意图'}
        </button>
        {saveResult ? (
          <span style={{ fontSize: '12px', color: saveResult.ok ? '#6ee7b7' : 'rgba(248,113,113,0.85)' }}>
            {saveResult.msg}
          </span>
        ) : null}
      </div>

      <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}>
        ⚠️ {DISCLAIMER}
      </div>
    </div>
  )
}

function LicenseIntentReadOnly({ mode, isPublic }: { mode: LicenseMode | null; isPublic: boolean }) {
  const effectiveMode = mode ?? (isPublic ? 'public_showcase' : 'private_only')
  const cfg = LICENSE_MODE_CONFIG[effectiveMode]
  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{cfg.label}</span>
        {!mode ? (
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>（默认）</span>
        ) : null}
      </div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>{cfg.description}</div>
      <div style={{ marginTop: '10px', fontSize: '10px', color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>
        {DISCLAIMER}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const assetId = typeof params.id === 'string' ? params.id : ''

  const [asset, setAsset] = useState<AssetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingPublic, setTogglingPublic] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const fetchAsset = useCallback(async () => {
    if (!assetId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/assets/${assetId}`, { credentials: 'include', cache: 'no-store' })
      const data = await res.json() as { asset?: AssetDetail; message?: string; errorCode?: string }
      if (!res.ok) {
        setError(data.message ?? data.errorCode ?? '加载失败')
        return
      }
      setAsset(data.asset ?? null)
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [assetId])

  useEffect(() => { void fetchAsset() }, [fetchAsset])

  async function togglePublic() {
    if (!asset || !asset.isOwner) return
    setTogglingPublic(true)
    setToggleError(null)
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !asset.isPublic }),
      })
      const data = await res.json() as { asset?: { isPublic?: boolean }; message?: string }
      if (!res.ok) {
        setToggleError(data.message ?? '更新失败')
        return
      }
      setAsset((prev) => prev ? { ...prev, isPublic: !prev.isPublic } : prev)
    } catch {
      setToggleError('网络错误')
    } finally {
      setTogglingPublic(false)
    }
  }

  function handleLicenseSaved(mode: LicenseMode) {
    setAsset((prev) => {
      if (!prev) return prev
      const existing: Record<string, unknown> =
        prev.metadataJson && typeof prev.metadataJson === 'object' && !Array.isArray(prev.metadataJson)
          ? (prev.metadataJson as Record<string, unknown>)
          : {}
      return {
        ...prev,
        metadataJson: {
          ...existing,
          licenseIntent: { mode },
        },
      }
    })
  }

  const mediaUrl = asset?.resolvedUrl ?? asset?.url ?? ''
  const licenseIntent = asset ? getLicenseIntent(asset.metadataJson) : null

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e8e8f0', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '12px', padding: '0 24px', height: '56px', background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'rgba(255,255,255,0.42)', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 8px', borderRadius: '6px' }}
        >
          ← 返回
        </button>
        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.08)' }} />
        <a href="/assets" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.34)', textDecoration: 'none' }}>Gallery</a>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>/</span>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', fontFamily: 'ui-monospace,monospace' }}>{assetId.slice(0, 12)}…</span>
      </header>

      {/* Loading / error */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>加载中…</div>
      ) : error ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '12px' }}>
          <div style={{ color: 'rgba(255,100,100,0.75)', fontSize: '13px' }}>{error}</div>
          <a href="/assets" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'underline' }}>返回资产库</a>
        </div>
      ) : asset ? (
        <main style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 24px 80px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '32px', alignItems: 'start' }}>
            {/* Left: media preview */}
            <div>
              <div style={{ borderRadius: '14px', overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {mediaUrl && asset.type === 'IMAGE' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl} alt={asset.title ?? asset.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : mediaUrl && asset.type === 'VIDEO' ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={mediaUrl} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '36px', opacity: 0.25 }}>{asset.type === 'AUDIO' ? '🎵' : '📄'}</span>
                )}
              </div>

              {/* Visibility toggle */}
              {asset.isOwner ? (
                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: asset.isPublic ? '#6ee7b7' : 'rgba(255,255,255,0.55)' }}>
                      {asset.isPublic ? '🌐 公开' : '🔒 私有'}
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>
                      {asset.isPublic ? '其他登录用户可通过直链查看' : '仅你可见'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { void togglePublic() }}
                    disabled={togglingPublic}
                    style={{ padding: '5px 14px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: '11px', cursor: togglingPublic ? 'not-allowed' : 'pointer', opacity: togglingPublic ? 0.5 : 1, whiteSpace: 'nowrap' }}
                  >
                    {togglingPublic ? '更新中…' : asset.isPublic ? '设为私有' : '设为公开'}
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                  {asset.isPublic ? '🌐 公开资产' : '🔒 私有资产'}
                </div>
              )}
              {toggleError ? (
                <div style={{ marginTop: '6px', fontSize: '11px', color: 'rgba(255,100,100,0.75)' }}>{toggleError}</div>
              ) : null}

              {/* Download */}
              {mediaUrl ? (
                <a
                  href={mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  style={{ display: 'block', marginTop: '10px', textAlign: 'center', padding: '8px', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.03)', fontSize: '12px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
                >
                  ↓ 下载原文件
                </a>
              ) : null}
            </div>

            {/* Right: metadata */}
            <div>
              {/* Title + type */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
                <TypeBadge type={asset.type} />
                {asset.status ? (
                  <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '5px', background: asset.status === 'READY' ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)', color: asset.status === 'READY' ? '#6ee7b7' : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{asset.status}</span>
                ) : null}
              </div>
              {asset.title ?? asset.name ? (
                <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#f0f0f8', margin: '0 0 20px', lineHeight: 1.3 }}>{asset.title ?? asset.name}</h1>
              ) : null}

              {/* Ownership */}
              <MetaSection title="Ownership / 归属">
                <Row label="Asset ID"><code style={{ fontSize: '11px', fontFamily: 'ui-monospace,monospace', color: 'rgba(255,255,255,0.5)' }}>{asset.id}</code></Row>
                <Row label="Owner">{asset.owner?.displayName ?? asset.isOwner ? '你（当前登录用户）' : '其他用户'}</Row>
                <Row label="可见性">
                  <span style={{ color: asset.isPublic ? '#6ee7b7' : 'rgba(255,255,255,0.55)' }}>
                    {asset.isPublic ? '🌐 公开' : '🔒 私有'}
                  </span>
                </Row>
                <Row label="来源标记">{asset.source ?? '—'}</Row>
                {asset.tags && asset.tags.length > 0 ? (
                  <Row label="标签">{asset.tags.join(', ')}</Row>
                ) : null}
              </MetaSection>

              {/* Origin / Provenance */}
              <MetaSection title="Origin / 来源">
                {asset.project ? (
                  <Row label="所属项目">
                    <a href={`/projects/${asset.project.id}`} style={{ color: '#93c5fd', textDecoration: 'none' }}>{asset.project.title}</a>
                  </Row>
                ) : null}
                {asset.nodeId ? <Row label="画布节点 ID"><code style={{ fontSize: '10px', fontFamily: 'ui-monospace,monospace' }}>{asset.nodeId}</code></Row> : null}
                {asset.workflowId ? <Row label="Workflow ID"><code style={{ fontSize: '10px', fontFamily: 'ui-monospace,monospace' }}>{asset.workflowId.slice(0, 16)}…</code></Row> : null}
              </MetaSection>

              {/* Provenance */}
              <ProvenanceSection sourceAssets={asset.sourceAssets} />

              {/* Provider / Generation */}
              {(asset.provider ?? asset.providerId ?? asset.providerJobId ?? asset.generationJobId) ? (
                <MetaSection title="Generation / 生成信息">
                  {asset.provider ?? asset.providerId ? <Row label="Provider">{asset.provider ?? asset.providerId}</Row> : null}
                  {asset.providerJobId ? <Row label="Provider Job ID"><code style={{ fontSize: '10px', fontFamily: 'ui-monospace,monospace' }}>{asset.providerJobId}</code></Row> : null}
                  {asset.generationJobId ? <Row label="Generation Job"><code style={{ fontSize: '10px', fontFamily: 'ui-monospace,monospace' }}>{asset.generationJobId.slice(0, 20)}…</code></Row> : null}
                  {asset.storageProvider ? <Row label="Storage">{asset.storageProvider}</Row> : null}
                </MetaSection>
              ) : null}

              {/* Prompt */}
              {asset.prompt ? (
                <MetaSection title="Prompt">
                  <div style={{ padding: '10px 0', fontSize: '12px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{asset.prompt}</div>
                  {asset.negativePrompt ? (
                    <div style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginBottom: '4px' }}>Negative</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{asset.negativePrompt}</div>
                    </div>
                  ) : null}
                </MetaSection>
              ) : null}

              {/* File info */}
              <MetaSection title="File / 文件信息">
                <Row label="MIME">{asset.mimeType}</Row>
                {asset.width && asset.height ? <Row label="尺寸">{asset.width} × {asset.height} px</Row> : null}
                {asset.duration ? <Row label="时长">{asset.duration.toFixed(1)} s</Row> : null}
                {asset.sizeBytes ? <Row label="大小">{formatBytes(asset.sizeBytes)}</Row> : null}
                <Row label="创建时间">{formatDate(asset.createdAt)}</Row>
                <Row label="更新时间">{formatDate(asset.updatedAt)}</Row>
              </MetaSection>

              {/* License Intent — replaces placeholder */}
              <MetaSection title="License / 授权意图">
                {asset.isOwner ? (
                  <LicenseIntentEditor
                    assetId={asset.id}
                    currentMode={licenseIntent?.mode ?? null}
                    onSaved={handleLicenseSaved}
                  />
                ) : (
                  <LicenseIntentReadOnly
                    mode={licenseIntent?.mode ?? null}
                    isPublic={asset.isPublic}
                  />
                )}
              </MetaSection>
            </div>
          </div>
        </main>
      ) : null}
    </div>
  )
}
