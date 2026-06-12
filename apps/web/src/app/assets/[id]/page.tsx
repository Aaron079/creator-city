'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  LICENSE_MODES,
  LICENSE_MODE_CONFIG,
  getLicenseIntent,
  type LicenseMode,
} from '@/lib/assets/license-intent'
import {
  getMarketplaceIntent,
  MARKETPLACE_INTENT_LICENSES,
  type MarketplaceIntent,
  type MarketplaceIntentLicense,
} from '@/lib/assets/marketplace-intent'

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetListingStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'

interface LicenseGrant {
  id: string
  listingId: string
  assetId: string
  licenseMode: string
  paidCredits: number
  status: string
  grantedAt: string
  expiresAt: string | null
  termsJson: unknown
}

interface MarketplaceOrder {
  id: string
  listingId: string
  assetId: string
  priceCredits: number
  status: string
  createdAt: string
}

interface PendingOrderItem {
  id: string
  priceCredits: number
  message: string | null
  createdAt: string
  buyer: {
    id: string
    displayName: string
    username: string | null
    avatarUrl: string | null
  }
}

interface AssetListing {
  id: string
  assetId: string
  sellerId: string
  status: AssetListingStatus
  licenseMode: string
  priceCredits: number | null
  title: string | null
  description: string | null
  commercialUse: boolean
  derivativeAllowed: boolean
  attributionRequired: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

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

// ─── Marketplace Intent Editor ────────────────────────────────────────────────

const REUSABLE_MODES_SET = new Set(['reusable_noncommercial', 'reusable_commercial'])

const MARKETPLACE_DISCLAIMER =
  '当前仅记录发布意向，不代表正式上架、交易、付款或收益分成。正式 Marketplace 交易功能规划中。'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MarketplaceIntentEditor({
  assetId,
  isPublic,
  licenseMode,
  currentIntent,
  onSaved,
}: {
  assetId: string
  isPublic: boolean
  licenseMode: LicenseMode | null
  currentIntent: MarketplaceIntent | null
  onSaved: (intent: MarketplaceIntent | null) => void
}) {
  const canList = isPublic && licenseMode !== null && REUSABLE_MODES_SET.has(licenseMode)

  const [wantsToList, setWantsToList] = useState(currentIntent?.wantsToList ?? false)
  const [suggestedLicense, setSuggestedLicense] = useState<MarketplaceIntentLicense | null>(
    currentIntent?.suggestedLicense ?? null,
  )
  const [priceCredits, setPriceCredits] = useState<string>(
    currentIntent?.suggestedPriceCredits != null ? String(currentIntent.suggestedPriceCredits) : '',
  )
  const [description, setDescription] = useState(currentIntent?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null)

  if (!canList) {
    return (
      <div style={{ padding: '12px 0' }}>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(251,191,36,0.05)',
            border: '1px solid rgba(251,191,36,0.12)',
            fontSize: '12px',
            color: 'rgba(251,191,36,0.65)',
            lineHeight: 1.65,
          }}
        >
          发布到市场前，请先将资产设为公开，并选择可复用授权意图（非商用复用 / 商用复用）。
        </div>
      </div>
    )
  }

  async function save() {
    setSaving(true)
    setSaveResult(null)
    try {
      const intentBody: Record<string, unknown> = { wantsToList }
      if (wantsToList) {
        if (suggestedLicense) intentBody.suggestedLicense = suggestedLicense
        const price = parseInt(priceCredits, 10)
        if (!isNaN(price) && price >= 0) intentBody.suggestedPriceCredits = price
        if (description.trim()) intentBody.description = description.trim()
      }
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceIntent: intentBody }),
      })
      const data = (await res.json()) as { message?: string; errorCode?: string }
      if (!res.ok) {
        setSaveResult({ ok: false, msg: data.message ?? data.errorCode ?? '保存失败' })
        return
      }
      setSaveResult({ ok: true, msg: '发布意向已保存' })
      const saved: MarketplaceIntent = {
        wantsToList,
        status: 'draft',
        updatedAt: new Date().toISOString(),
        updatedBy: '',
      }
      if (wantsToList && suggestedLicense) saved.suggestedLicense = suggestedLicense
      if (wantsToList && priceCredits) {
        const p = parseInt(priceCredits, 10)
        if (!isNaN(p)) saved.suggestedPriceCredits = p
      }
      if (wantsToList && description.trim()) saved.description = description.trim()
      onSaved(saved)
      setTimeout(() => setSaveResult(null), 3000)
    } catch {
      setSaveResult({ ok: false, msg: '网络错误，请稍后重试' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '14px 0 6px' }}>
      {/* wantsToList toggle */}
      <button
        type="button"
        onClick={() => setWantsToList((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          padding: '10px 12px',
          borderRadius: '9px',
          border: wantsToList ? '1px solid rgba(110,231,183,0.35)' : '1px solid rgba(255,255,255,0.07)',
          background: wantsToList ? 'rgba(110,231,183,0.06)' : 'rgba(255,255,255,0.02)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            border: wantsToList ? '4px solid #6ee7b7' : '2px solid rgba(255,255,255,0.25)',
            flexShrink: 0,
            background: 'transparent',
          }}
        />
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: wantsToList ? '#6ee7b7' : 'rgba(255,255,255,0.65)' }}>
            {wantsToList ? '✓ 已登记发布意向' : '登记发布意向'}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
            在市场中展示此资产，表明有授权意向（不代表立即可购买）
          </div>
        </div>
      </button>

      {/* Fields shown only when wantsToList */}
      {wantsToList ? (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* suggestedLicense */}
          <div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginBottom: '5px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>建议授权类型</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {MARKETPLACE_INTENT_LICENSES.map((lic) => (
                <button
                  key={lic}
                  type="button"
                  onClick={() => setSuggestedLicense(lic)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '7px',
                    border: suggestedLicense === lic ? '1px solid rgba(147,197,253,0.4)' : '1px solid rgba(255,255,255,0.07)',
                    background: suggestedLicense === lic ? 'rgba(147,197,253,0.08)' : 'rgba(255,255,255,0.02)',
                    fontSize: '11px',
                    color: suggestedLicense === lic ? '#93c5fd' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    fontWeight: suggestedLicense === lic ? 600 : 400,
                  }}
                >
                  {lic === 'reusable_noncommercial' ? '非商用复用' : '商用复用'}
                </button>
              ))}
            </div>
          </div>

          {/* suggestedPriceCredits */}
          <div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginBottom: '5px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>建议价格（积分，规划中）</div>
            <input
              type="number"
              min={0}
              max={999999}
              value={priceCredits}
              onChange={(e) => setPriceCredits(e.target.value)}
              placeholder="留空表示待定"
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '7px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.65)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* description */}
          <div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginBottom: '5px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>发布说明（可选，最多 500 字）</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="描述资产的适用场景、授权范围说明等…"
              rows={3}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '7px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.65)',
                outline: 'none',
                resize: 'vertical',
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          onClick={() => { void save() }}
          disabled={saving}
          style={{
            padding: '7px 18px',
            borderRadius: '8px',
            border: '1px solid rgba(110,231,183,0.3)',
            background: saving ? 'rgba(110,231,183,0.04)' : 'rgba(110,231,183,0.09)',
            color: '#6ee7b7',
            fontSize: '12px',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? '保存中…' : '保存发布意向'}
        </button>
        {saveResult ? (
          <span style={{ fontSize: '12px', color: saveResult.ok ? '#6ee7b7' : 'rgba(248,113,113,0.85)' }}>
            {saveResult.msg}
          </span>
        ) : null}
      </div>

      <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}>
        ⚠️ {MARKETPLACE_DISCLAIMER}
      </div>
    </div>
  )
}

function MarketplaceIntentReadOnly({ intent }: { intent: MarketplaceIntent | null }) {
  const disabledBtn = (
    <span
      style={{
        display: 'inline-block',
        marginTop: '10px',
        padding: '6px 16px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.06)',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.2)',
        cursor: 'not-allowed',
        userSelect: 'none',
      }}
    >
      申请授权 · 即将开放
    </span>
  )

  if (!intent?.wantsToList) {
    return (
      <div style={{ padding: '12px 0' }}>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.32)', lineHeight: 1.6, marginBottom: '4px' }}>
          创作者尚未登记市场发布意向。
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', lineHeight: 1.6, marginBottom: '8px' }}>
          {MARKETPLACE_DISCLAIMER}
        </div>
        {disabledBtn}
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '5px', background: 'rgba(110,231,183,0.08)', color: '#6ee7b7', fontWeight: 600 }}>
          📋 发布意向已登记
        </span>
        {intent.suggestedLicense ? (
          <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '5px', background: intent.suggestedLicense === 'reusable_commercial' ? 'rgba(251,146,60,0.1)' : 'rgba(96,165,250,0.1)', color: intent.suggestedLicense === 'reusable_commercial' ? '#fdba74' : '#93c5fd', fontWeight: 600 }}>
            {intent.suggestedLicense === 'reusable_commercial' ? '💼 商用复用' : '🔄 非商用复用'}
          </span>
        ) : null}
      </div>
      {intent.suggestedPriceCredits != null ? (
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)', marginBottom: '4px' }}>
          建议价：{intent.suggestedPriceCredits} 积分（规划中）
        </div>
      ) : null}
      {intent.description ? (
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {intent.description}
        </div>
      ) : null}
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', lineHeight: 1.6, marginBottom: '4px' }}>
        {MARKETPLACE_DISCLAIMER}
      </div>
      {disabledBtn}
    </div>
  )
}

// ─── Asset Listing Section ────────────────────────────────────────────────────

const LISTING_DISCLAIMER = '购买/授权功能规划中，当前仅供上架展示，不代表正式交易、付款或收益分成。'

const LICENSE_LABEL: Record<string, string> = {
  reusable_noncommercial: '🔄 非商用复用',
  reusable_commercial: '💼 商用复用',
}

function ListingStatusBadge({ status }: { status: AssetListingStatus }) {
  const cfg: Record<AssetListingStatus, { bg: string; color: string; label: string }> = {
    DRAFT:    { bg: 'rgba(251,191,36,0.1)',  color: '#fde68a', label: '草稿' },
    ACTIVE:   { bg: 'rgba(110,231,183,0.1)', color: '#6ee7b7', label: '✅ 已上架' },
    PAUSED:   { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', label: '⏸ 已暂停' },
    ARCHIVED: { bg: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', label: '🗂 已归档' },
  }
  const c = cfg[status]
  return (
    <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 5, background: c.bg, color: c.color, fontWeight: 600 }}>
      {c.label}
    </span>
  )
}

function AssetListingSection({
  assetId,
  isPublic,
  assetStatus,
  licenseMode,
  marketplaceIntent,
  listing,
  grantCount,
  pendingOrders,
  onListingChange,
  onOrderRejected,
}: {
  assetId: string
  isPublic: boolean
  assetStatus: string | null
  licenseMode: string | null
  marketplaceIntent: MarketplaceIntent | null
  listing: AssetListing | null
  grantCount: number | null
  pendingOrders: PendingOrderItem[]
  onListingChange: (l: AssetListing | null) => void
  onOrderRejected: (orderId: string) => void
}) {
  const REUSABLE_MODES = new Set(['reusable_noncommercial', 'reusable_commercial'])
  const isReady = assetStatus === 'READY'
  const isReusable = licenseMode !== null && REUSABLE_MODES.has(licenseMode)
  const canCreateListing = isPublic && isReady && isReusable

  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [showOrders, setShowOrders] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  // Draft edit state
  const [editTitle, setEditTitle] = useState(listing?.title ?? '')
  const [editDesc, setEditDesc] = useState(listing?.description ?? '')
  const [editPrice, setEditPrice] = useState(listing?.priceCredits != null ? String(listing.priceCredits) : '')

  // Sync edit state when listing changes
  // Sync edit fields when listing id changes — intentionally not including title/desc/price
  // to avoid overwriting in-progress edits on re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setEditTitle(listing?.title ?? '')
    setEditDesc(listing?.description ?? '')
    setEditPrice(listing?.priceCredits != null ? String(listing.priceCredits) : '')
  }, [listing?.id])

  type ApiResult = { listing?: AssetListing; message?: string; errorCode?: string }

  async function apiPost(url: string, body: unknown): Promise<ApiResult> {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json() as Promise<ApiResult>
  }

  async function apiPatch(listingId: string, body: unknown): Promise<ApiResult> {
    const res = await fetch(`/api/marketplace/listings/${listingId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json() as Promise<ApiResult>
  }

  function errorToMessage(errorCode: string | undefined, fallback: string | undefined): string {
    switch (errorCode) {
      case 'ASSET_NOT_PUBLIC':
        return '请先在左侧将资产设为公开，再创建 Listing。'
      case 'ASSET_NOT_READY':
        return fallback ?? '资产尚未就绪（非 READY 状态），请等待处理完成后再创建 Listing。'
      case 'LICENSE_INTENT_REQUIRED':
        return '请先在上方「授权意图」区域选择授权类型并点击「保存授权意图」，再创建 Listing。'
      case 'LICENSE_INTENT_NOT_REUSABLE':
        return '当前授权意图不支持上架。请选择「可复用 · 非商用」或「可复用 · 可商用」并保存后，再创建 Listing。'
      case 'LISTING_ALREADY_EXISTS':
        return fallback ?? '该资产已有进行中的 Listing，请先归档后再创建。'
      case 'UNAUTHORIZED':
        return '请先登录后再操作。'
      case 'SERVICE_UNAVAILABLE':
        return '服务暂时不可用，请稍后重试。'
      default:
        return fallback ?? '操作失败，请稍后重试。'
    }
  }

  async function runAction(label: string, fn: () => Promise<ApiResult | null>) {
    setActionLoading(label)
    setActionError(null)
    setActionMsg(null)
    try {
      const result = await fn()
      if (result?.listing) {
        onListingChange(result.listing)
        setActionMsg(label === 'create' ? 'Listing 草稿已创建' : '已更新')
        setTimeout(() => setActionMsg(null), 3000)
      } else if (result?.errorCode ?? result?.message) {
        setActionError(errorToMessage(result?.errorCode, result?.message))
      }
    } catch {
      setActionError('网络错误，请稍后重试')
    } finally {
      setActionLoading(null)
    }
  }

  function btn(label: string, onClick: () => void, style?: React.CSSProperties, disabled?: boolean) {
    const loading = actionLoading === label
    return (
      <button
        key={label}
        type="button"
        onClick={onClick}
        disabled={disabled || loading || actionLoading !== null}
        style={{
          padding: '6px 14px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.04)',
          fontSize: 11,
          color: 'rgba(255,255,255,0.55)',
          cursor: (disabled || loading || actionLoading !== null) ? 'not-allowed' : 'pointer',
          opacity: (disabled || loading || actionLoading !== null) ? 0.6 : 1,
          whiteSpace: 'nowrap',
          ...style,
        }}
      >
        {loading ? '…' : label}
      </button>
    )
  }

  // ── Pre-condition checklist (always shown when no active listing) ──
  function PreConditionChecklist() {
    const checks = [
      {
        ok: isPublic,
        label: '资产已设为公开',
        hint: '请在左侧「可见性」切换为公开',
      },
      {
        ok: isReady,
        label: `资产已就绪（当前状态：${assetStatus ?? '—'}）`,
        hint: '请等待资产处理完成（状态变为 READY）',
      },
      {
        ok: isReusable,
        label: licenseMode
          ? `授权意图：${licenseMode === 'reusable_commercial' ? '可复用 · 可商用' : licenseMode === 'reusable_noncommercial' ? '可复用 · 非商用' : licenseMode}`
          : '授权意图：未保存',
        hint: '请在上方「授权意图」区域选择「可复用 · 非商用」或「可复用 · 可商用」并保存',
      },
    ]
    return (
      <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {checks.map((c) => (
          <div key={c.label} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 11 }}>
            <span style={{ flexShrink: 0, color: c.ok ? '#4ade80' : 'rgba(248,113,113,0.7)', marginTop: 1 }}>
              {c.ok ? '✓' : '✗'}
            </span>
            <div>
              <span style={{ color: c.ok ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.45)' }}>{c.label}</span>
              {!c.ok ? (
                <div style={{ fontSize: 10, color: 'rgba(251,191,36,0.6)', marginTop: 2 }}>{c.hint}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── No listing ──
  if (!listing) {
    return (
      <div style={{ padding: '12px 0' }}>
        <PreConditionChecklist />
        {marketplaceIntent?.wantsToList ? (
          <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 7, background: 'rgba(110,231,183,0.06)', border: '1px solid rgba(110,231,183,0.15)', fontSize: 12, color: '#6ee7b7' }}>
            📋 发布意向已登记，可升级为正式 Listing。
          </div>
        ) : null}
        {canCreateListing
          ? btn('create', () => { void runAction('create', () => apiPost('/api/marketplace/listings', { assetId })) }, { border: '1px solid rgba(110,231,183,0.3)', background: 'rgba(110,231,183,0.08)', color: '#6ee7b7' })
          : (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.10)', fontSize: 11, color: 'rgba(251,191,36,0.55)', lineHeight: 1.6 }}>
              请先满足上方所有条件后再创建 Listing。
            </div>
          )
        }
        {actionError ? (
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', fontSize: 11, color: 'rgba(248,113,113,0.85)', lineHeight: 1.6 }}>
            {actionError}
          </div>
        ) : null}
        {actionMsg ? <div style={{ marginTop: 6, fontSize: 11, color: '#6ee7b7' }}>{actionMsg}</div> : null}
        <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.25)', lineHeight: 1.6 }}>⚠️ {LISTING_DISCLAIMER}</div>
      </div>
    )
  }

  // ── Archived ──
  if (listing.status === 'ARCHIVED') {
    return (
      <div style={{ padding: '12px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <ListingStatusBadge status="ARCHIVED" />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>归档于 {listing.updatedAt ? new Date(listing.updatedAt).toLocaleDateString('zh-CN') : '—'}</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, marginBottom: 10 }}>已归档的 Listing 不可恢复。如需重新上架，请创建新 Listing。</div>
        <PreConditionChecklist />
        {canCreateListing
          ? btn('create', () => { void runAction('create', () => apiPost('/api/marketplace/listings', { assetId })) }, { border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.5)' })
          : null}
        {actionError ? (
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', fontSize: 11, color: 'rgba(248,113,113,0.85)', lineHeight: 1.6 }}>
            {actionError}
          </div>
        ) : null}
        {actionMsg ? <div style={{ marginTop: 6, fontSize: 11, color: '#6ee7b7' }}>{actionMsg}</div> : null}
      </div>
    )
  }

  // ── Editable fields (draft only) ──
  const showEdit = listing.status === 'DRAFT'

  async function saveEdit() {
    const price = editPrice ? parseInt(editPrice, 10) : null
    return apiPatch(listing!.id, {
      title: editTitle || null,
      description: editDesc || null,
      priceCredits: price,
    })
  }

  async function rejectOrder(orderId: string) {
    setRejectingId(orderId)
    try {
      const res = await fetch(`/api/me/marketplace-orders/${orderId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      })
      if (res.ok) onOrderRejected(orderId)
    } catch { /* ignore */ } finally {
      setRejectingId(null)
    }
  }

  return (
    <div style={{ padding: '14px 0 6px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <ListingStatusBadge status={listing.status} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{LICENSE_LABEL[listing.licenseMode] ?? listing.licenseMode}</span>
        {listing.publishedAt ? (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>上架于 {new Date(listing.publishedAt).toLocaleDateString('zh-CN')}</span>
        ) : null}
        {grantCount != null && grantCount > 0 ? (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: 'rgba(74,222,128,0.08)', color: 'rgba(74,222,128,0.7)', fontWeight: 600 }}>
            已授权 {grantCount} 人
          </span>
        ) : grantCount === 0 ? (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>暂无授权记录</span>
        ) : null}
        {pendingOrders.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowOrders((v) => !v)}
            style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: 'rgba(251,191,36,0.08)', color: 'rgba(251,191,36,0.7)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            待处理付费申请 {pendingOrders.length} 个 {showOrders ? '▲' : '▼'}
          </button>
        ) : null}
      </div>

      {/* Pending orders list (seller reject) */}
      {showOrders && pendingOrders.length > 0 ? (
        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pendingOrders.map((order) => (
            <div key={order.id} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.15)', background: 'rgba(251,191,36,0.04)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>
                  {order.buyer.displayName}
                  {order.buyer.username ? <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 5 }}>@{order.buyer.username}</span> : null}
                </div>
                {order.message ? (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, lineHeight: 1.5 }}>{order.message}</div>
                ) : null}
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 3 }}>
                  {new Date(order.createdAt).toLocaleDateString('zh-CN')} · {order.priceCredits} 积分
                </div>
              </div>
              <button
                type="button"
                onClick={() => { void rejectOrder(order.id) }}
                disabled={rejectingId === order.id}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.06)', color: 'rgba(248,113,113,0.65)', fontSize: 11, cursor: rejectingId === order.id ? 'not-allowed' : 'pointer', opacity: rejectingId === order.id ? 0.5 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {rejectingId === order.id ? '拒绝中…' : '拒绝'}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Edit fields (draft only) */}
      {showEdit ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>标题</div>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Listing 标题"
              style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', fontSize: 12, color: 'rgba(255,255,255,0.65)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>标价积分（规划中，最多 999999）</div>
            <input
              type="number"
              min={0}
              max={999999}
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              placeholder="留空表示待定"
              style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', fontSize: 12, color: 'rgba(255,255,255,0.65)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>说明（最多 500 字）</div>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              maxLength={500}
              rows={3}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', fontSize: 12, color: 'rgba(255,255,255,0.65)', outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
            />
          </div>
          {btn('保存编辑', () => { void runAction('保存编辑', saveEdit) })}
        </div>
      ) : (
        /* Read-only info for ACTIVE/PAUSED */
        <div style={{ marginBottom: 10 }}>
          {listing.title ? <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>{listing.title}</div> : null}
          {listing.priceCredits != null ? (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>标价：{listing.priceCredits} 积分（购买功能规划中）</div>
          ) : (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 4 }}>标价：待定</div>
          )}
          {listing.description ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{listing.description}</div>
          ) : null}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {listing.status === 'DRAFT' ? btn('激活上架', () => { void runAction('激活上架', () => apiPatch(listing.id, { status: 'ACTIVE' })) }, { border: '1px solid rgba(110,231,183,0.3)', background: 'rgba(110,231,183,0.08)', color: '#6ee7b7' }) : null}
        {listing.status === 'ACTIVE' ? btn('暂停', () => { void runAction('暂停', () => apiPatch(listing.id, { status: 'PAUSED' })) }) : null}
        {listing.status === 'PAUSED' ? btn('重新上架', () => { void runAction('重新上架', () => apiPatch(listing.id, { status: 'ACTIVE' })) }, { border: '1px solid rgba(110,231,183,0.3)', background: 'rgba(110,231,183,0.08)', color: '#6ee7b7' }) : null}
        {btn('归档', () => { void runAction('归档', () => apiPatch(listing.id, { status: 'ARCHIVED' })) }, { border: '1px solid rgba(248,113,113,0.2)', color: 'rgba(248,113,113,0.55)' })}
        {/* Purchase always disabled */}
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: 'rgba(255,255,255,0.15)', cursor: 'not-allowed', userSelect: 'none' }}>
          申请授权 · 即将开放
        </span>
      </div>

      {actionError ? (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', fontSize: 11, color: 'rgba(248,113,113,0.85)', lineHeight: 1.6, marginBottom: 6 }}>
          {actionError}
        </div>
      ) : null}
      {actionMsg ? <div style={{ fontSize: 11, color: '#6ee7b7', marginBottom: 6 }}>{actionMsg}</div> : null}

      <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', fontSize: 10, color: 'rgba(255,255,255,0.28)', lineHeight: 1.7 }}>
        ⚠️ {LISTING_DISCLAIMER}
        {listing.priceCredits != null && listing.priceCredits > 0 ? (
          <div style={{ marginTop: 4, color: 'rgba(251,191,36,0.4)' }}>付费申请仅为意向，不代表成交或授权。</div>
        ) : null}
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
  const [listing, setListing] = useState<AssetListing | null>(null)
  const [grantCount, setGrantCount] = useState<number | null>(null)
  const [myGrant, setMyGrant] = useState<LicenseGrant | null>(null)
  const [myOrder, setMyOrder] = useState<MarketplaceOrder | null>(null)
  const [pendingOrders, setPendingOrders] = useState<PendingOrderItem[]>([])
  const [cancelOrderState, setCancelOrderState] = useState<'idle' | 'loading'>('idle')

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
      const loadedAsset = data.asset ?? null
      setAsset(loadedAsset)
      if (loadedAsset?.isOwner) {
        try {
          const lr = await fetch(`/api/marketplace/listings?assetId=${assetId}&mine=true`, { credentials: 'include' })
          const ld = await lr.json() as { listing?: AssetListing | null; grantCount?: number }
          setListing(ld.listing ?? null)
          setGrantCount(ld.grantCount ?? null)
          // Fetch pending orders for seller
          if (ld.listing?.id) {
            fetch(`/api/marketplace/listings/${ld.listing.id}/orders`, { credentials: 'include' })
              .then((r) => r.json() as Promise<{ orders?: PendingOrderItem[] }>)
              .then((d) => setPendingOrders(d.orders ?? []))
              .catch(() => { /* ignore */ })
          }
        } catch {
          setListing(null)
          setGrantCount(null)
        }
      } else {
        setListing(null)
        setGrantCount(null)
        // Fetch buyer's own grant for this asset
        try {
          const gr = await fetch(`/api/me/licenses/${assetId}`, { credentials: 'include' })
          const gd = await gr.json() as { granted?: boolean; grant?: LicenseGrant }
          setMyGrant(gd.granted && gd.grant ? gd.grant : null)
        } catch {
          setMyGrant(null)
        }
        // Fetch buyer's most recent order for this asset (any status)
        fetch(`/api/me/marketplace-orders?role=buyer`, { credentials: 'include' })
          .then((r) => r.json() as Promise<{ items?: MarketplaceOrder[] }>)
          .then((d) => {
            // Items sorted desc by createdAt; first match per asset is most recent
            const order = d.items?.find((o) => o.assetId === assetId) ?? null
            setMyOrder(order)
          })
          .catch(() => { /* ignore */ })
      }
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

  async function cancelMyOrder() {
    if (!myOrder || myOrder.status !== 'PENDING' || cancelOrderState === 'loading') return
    setCancelOrderState('loading')
    try {
      const res = await fetch(`/api/me/marketplace-orders/${myOrder.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      if (res.ok) setMyOrder((prev) => prev ? { ...prev, status: 'CANCELLED' } : prev)
    } catch { /* ignore */ } finally {
      setCancelOrderState('idle')
    }
  }

  const mediaUrl = asset?.resolvedUrl ?? asset?.url ?? ''
  const licenseIntent = asset ? getLicenseIntent(asset.metadataJson) : null
  const marketplaceIntentData = asset ? getMarketplaceIntent(asset.metadataJson) : null

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

              {/* Marketplace / 发布意向 */}
              <MetaSection title="Marketplace / 发布意向">
                {asset.isOwner ? (
                  <AssetListingSection
                    assetId={asset.id}
                    isPublic={asset.isPublic}
                    assetStatus={asset.status ?? null}
                    licenseMode={licenseIntent?.mode ?? null}
                    marketplaceIntent={marketplaceIntentData}
                    listing={listing}
                    grantCount={grantCount}
                    pendingOrders={pendingOrders}
                    onListingChange={setListing}
                    onOrderRejected={(id) => setPendingOrders((prev) => prev.filter((o) => o.id !== id))}
                  />
                ) : (
                  <>
                    {myGrant ? (
                      <div style={{ padding: '12px 0' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontWeight: 600 }}>
                            ✓ 已获得授权
                          </span>
                          <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.38)' }}>
                            {myGrant.licenseMode === 'reusable_commercial' ? '💼 商用复用' : '🔄 非商用复用'}
                          </span>
                          {myGrant.paidCredits === 0 ? (
                            <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: 'rgba(74,222,128,0.06)', color: 'rgba(74,222,128,0.6)' }}>
                              免费
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
                          授权时间：{new Date(myGrant.grantedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {myGrant.expiresAt ? (
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                            到期：{new Date(myGrant.expiresAt).toLocaleDateString('zh-CN')}
                          </div>
                        ) : (
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>永久授权</div>
                        )}
                        <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.18)', lineHeight: 1.6 }}>
                          授权凭证仅做记录，不代表平台核查或正式法律合同。
                        </div>
                      </div>
                    ) : (
                      <>
                        {myOrder ? (
                          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10,
                            border: myOrder.status === 'PENDING' ? '1px solid rgba(251,191,36,0.2)'
                              : myOrder.status === 'CANCELLED' ? '1px solid rgba(255,255,255,0.08)'
                              : '1px solid rgba(248,113,113,0.2)',
                            background: myOrder.status === 'PENDING' ? 'rgba(251,191,36,0.05)'
                              : myOrder.status === 'CANCELLED' ? 'rgba(255,255,255,0.02)'
                              : 'rgba(248,113,113,0.04)' }}>
                            {myOrder.status === 'PENDING' ? (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                  <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 500 }}>付费授权申请已提交</div>
                                  <button
                                    type="button"
                                    onClick={() => { void cancelMyOrder() }}
                                    disabled={cancelOrderState === 'loading'}
                                    style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(248,113,113,0.2)', background: 'transparent', color: 'rgba(248,113,113,0.6)', fontSize: 10, cursor: cancelOrderState === 'loading' ? 'not-allowed' : 'pointer', opacity: cancelOrderState === 'loading' ? 0.5 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}
                                  >
                                    {cancelOrderState === 'loading' ? '取消中…' : '取消申请'}
                                  </button>
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                                  申请时间：{new Date(myOrder.createdAt).toLocaleDateString('zh-CN')}
                                </div>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 3 }}>
                                  尚未扣款，尚未获得授权。
                                </div>
                              </>
                            ) : myOrder.status === 'CANCELLED' ? (
                              <>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', fontWeight: 500 }}>申请已取消</div>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 3 }}>如需重新申请，请前往市场页面。</div>
                              </>
                            ) : (
                              <>
                                <div style={{ fontSize: 12, color: 'rgba(248,113,113,0.75)', fontWeight: 500 }}>申请已被拒绝</div>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 3 }}>如需再次申请，请前往市场页面重新提交。</div>
                              </>
                            )}
                          </div>
                        ) : null}
                        <MarketplaceIntentReadOnly intent={marketplaceIntentData} />
                      </>
                    )}
                  </>
                )}
              </MetaSection>
            </div>
          </div>
        </main>
      ) : null}
    </div>
  )
}
