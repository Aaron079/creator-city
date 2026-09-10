'use client'

import * as React from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { DirectorToolPanelFrame } from '@/components/canvas/tools/DirectorToolPanelFrame'
import { resolveSeedanceCapability, type SeedanceCapability } from '@/lib/seedance-previs/capabilities'
import { buildSeedanceTakePackage } from '@/lib/seedance-previs/package'
import type { SeedanceDeliveryReceipt } from '@/lib/seedance-previs/receipts'
import { assessAuthoringRisks } from '@/lib/spatial-previs/coverage'
import { applyBeatPatch } from '@/lib/spatial-previs/normalize'
import type { BeatPatch, SpatialPrevisMode, SpatialPrevisState, SpatialSceneReference, Vec3 } from '@/lib/spatial-previs/types'
import { replaceWhiteboxDraft } from '@/lib/spatial-previs/whitebox'
import { SpatialPrevisSceneAssets } from './SpatialPrevisSceneAssets'
import { SpatialPrevisTimeline, clampSpatialPrevisTime } from './SpatialPrevisTimeline'
import { SpatialPrevisViewport } from './SpatialPrevisViewport'
import {
  SeedanceDeliveryPanel,
  type SeedanceDeliveryPayload,
} from './SeedanceDeliveryPanel'
import {
  SeedanceChainReviewPanel,
  type SeedanceChainRetryRequest,
} from './SeedanceChainReviewPanel'

export type SeedancePrevisDeliveryRequest = SeedanceDeliveryPayload & {
  model: string
  previs: SpatialPrevisState
}

export type SeedancePrevisDeliveryResult = {
  success: boolean
  message: string
}

export type SpatialPrevisDirectorPanelProps = {
  initialState: SpatialPrevisState
  onSave: (state: SpatialPrevisState) => void | 'success' | 'failed' | 'conflict' | Promise<void | 'success' | 'failed' | 'conflict'>
  onReload?: () => void | 'success' | 'failed' | Promise<void | 'success' | 'failed'>
  onDeliverToSeedance?: (input: SeedancePrevisDeliveryRequest) => Promise<SeedancePrevisDeliveryResult>
  seedanceReceipts?: readonly SeedanceDeliveryReceipt[]
  onRetrySeedanceSegment?: (input: SeedanceChainRetryRequest) => Promise<SeedancePrevisDeliveryResult>
  onUploadSceneAsset?: (file: File) => Promise<SpatialSceneReference>
  onClose: () => void
}

type SpatialPrevisSaveResult = 'success' | 'failed' | 'conflict' | 'pending'

type SpatialPrevisSaveCallback = SpatialPrevisDirectorPanelProps['onSave']

export function createSpatialPrevisSaveGuard() {
  let pending = false

  return {
    isPending: () => pending,
    async save(state: SpatialPrevisState, onSave: SpatialPrevisSaveCallback): Promise<SpatialPrevisSaveResult> {
      if (pending) return 'pending'
      pending = true
      try {
        const result = await onSave(state)
        return result === 'failed' || result === 'conflict' ? result : 'success'
      } catch {
        return 'failed'
      } finally {
        pending = false
      }
    },
  }
}

export function canMutateSpatialPrevisEditor(isBusy: boolean) {
  return !isBusy
}

export function isSpatialPrevisBusy(isSaving: boolean, isReloading: boolean, isSceneAssetsUploading: boolean) {
  return isSaving || isReloading || isSceneAssetsUploading
}

export function canReplaceSpatialPrevisSceneReferences(isSaving: boolean, isReloading: boolean) {
  return !isSaving && !isReloading
}

export function selectSpatialPrevisEditorMode(state: SpatialPrevisState, editorMode: SpatialPrevisMode): SpatialPrevisState {
  return state.editorMode === editorMode ? state : { ...state, editorMode }
}

export function nextSpatialPrevisEditorMode(editorMode: SpatialPrevisMode, key: string): SpatialPrevisMode | null {
  if (key === 'ArrowLeft' || key === 'ArrowRight') return editorMode === 'continuous' ? 'beats' : 'continuous'
  if (key === 'Home') return 'continuous'
  if (key === 'End') return 'beats'
  return null
}

export function applySpatialPrevisBeatPatch(state: SpatialPrevisState, beatId: string, patch: BeatPatch) {
  try {
    return { state: applyBeatPatch(state, beatId, patch), error: null }
  } catch {
    return { state, error: '无法更新节拍。' }
  }
}

function standardSeedanceCapability() {
  return resolveSeedanceCapability({
    model: 'seedance-2.5',
    entryPoint: 'ark',
    entitlement: 'standard',
  })
}

function receivedCapability(value: unknown): SeedanceCapability | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const capability = value as Partial<SeedanceCapability>
  return capability.providerId === 'volcengine-seedance-video'
    && typeof capability.model === 'string'
    && capability.entryPoint === 'ark'
    && (capability.entitlement === 'standard' || capability.entitlement === 'long-take-beta')
    && (capability.maxContinuousDurationSec === 30 || capability.maxContinuousDurationSec === 180)
    && capability.maxSingleDurationSec === 30
    && capability.supports !== undefined
    ? capability as SeedanceCapability
    : null
}

export function SpatialPrevisDirectorPanel({
  initialState,
  onSave,
  onReload,
  onDeliverToSeedance,
  seedanceReceipts = [],
  onRetrySeedanceSegment,
  onUploadSceneAsset,
  onClose,
}: SpatialPrevisDirectorPanelProps) {
  const [state, setState] = useState(initialState)
  const [currentTimeSec, setCurrentTimeSec] = useState(() => clampSpatialPrevisTime(0, initialState.masterTake.durationSec))
  const [beatError, setBeatError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveConflict, setSaveConflict] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isReloading, setIsReloading] = useState(false)
  const [isSceneAssetsUploading, setIsSceneAssetsUploading] = useState(false)
  const [isDeliveryOpen, setIsDeliveryOpen] = useState(false)
  const [isReviewOpen, setIsReviewOpen] = useState(false)
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(seedanceReceipts.at(-1)?.deliveryId ?? null)
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null)
  const [capability, setCapability] = useState<SeedanceCapability>(standardSeedanceCapability)
  const saveGuard = useRef(createSpatialPrevisSaveGuard())
  const tabId = useId()
  const timelinePanelId = `spatial-previs-${tabId}-timeline`
  const tabIds: Record<SpatialPrevisMode, string> = {
    continuous: `spatial-previs-${tabId}-continuous-tab`,
    beats: `spatial-previs-${tabId}-beats-tab`,
  }
  const tabRefs = useRef<Record<SpatialPrevisMode, HTMLButtonElement | null>>({ continuous: null, beats: null })
  const isBusy = isSaving || isReloading || isSceneAssetsUploading
  const risks = useMemo(() => assessAuthoringRisks(
    state.scene.coverage,
    state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.position),
  ), [state.masterTake.cameraTrack.keyframes, state.scene.coverage])
  const deliveryPackage = useMemo(() => buildSeedanceTakePackage({
    previs: state,
    capability,
    deliveryMode: 'direct',
  }), [capability, state])

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/generate/seedance-previs', { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<unknown> : null)
      .then((data) => {
        if (controller.signal.aborted || data === null || typeof data !== 'object') return
        const next = receivedCapability((data as { capability?: unknown }).capability)
        if (next) setCapability(next)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (selectedDeliveryId && seedanceReceipts.some((receipt) => receipt.deliveryId === selectedDeliveryId)) return
    setSelectedDeliveryId(seedanceReceipts.at(-1)?.deliveryId ?? null)
  }, [seedanceReceipts, selectedDeliveryId])

  const handleStateChange = (next: SpatialPrevisState) => {
    if (!canMutateSpatialPrevisEditor(isBusy)) return
    setState(next)
    setBeatError(null)
  }

  const handleCurrentTimeChange = (timeSec: number) => {
    if (!canMutateSpatialPrevisEditor(isBusy)) return
    setCurrentTimeSec(clampSpatialPrevisTime(timeSec, state.masterTake.durationSec))
  }

  const handleSceneReferencesChange = (references: SpatialSceneReference[]) => {
    if (!canReplaceSpatialPrevisSceneReferences(isSaving, isReloading)) return
    setState((current) => replaceWhiteboxDraft(current, references))
    setBeatError(null)
  }

  const handleBeatPatch = (beatId: string, patch: { position: Vec3; target: Vec3 }) => {
    if (!canMutateSpatialPrevisEditor(isBusy)) return
    const result = applySpatialPrevisBeatPatch(state, beatId, patch)
    if (result.state !== state) setState(result.state)
    setBeatError(result.error)
  }

  const selectEditorMode = (editorMode: SpatialPrevisMode, focus = false) => {
    if (!canMutateSpatialPrevisEditor(isBusy)) return
    setState((current) => selectSpatialPrevisEditorMode(current, editorMode))
    if (focus) tabRefs.current[editorMode]?.focus()
  }

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!canMutateSpatialPrevisEditor(isBusy)) return
    const nextMode = nextSpatialPrevisEditorMode(state.editorMode, event.key)
    if (!nextMode) return
    event.preventDefault()
    selectEditorMode(nextMode, true)
  }

  const handleSave = async () => {
    if (isBusy || saveGuard.current.isPending()) return
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(null)
    setSaveConflict(false)
    const result = await saveGuard.current.save(state, onSave)
    setIsSaving(false)
    if (result === 'success') setSaveSuccess('预演已保存')
    if (result === 'failed') setSaveError('保存预演失败。')
    if (result === 'conflict') setSaveConflict(true)
  }

  const handleReload = async () => {
    if (!onReload || isBusy) return
    setIsReloading(true)
    setSaveError(null)
    const result = await onReload()
    setIsReloading(false)
    if (result === 'success') {
      setSaveConflict(false)
      setSaveSuccess(null)
      return
    }
    setSaveError('重新加载预演失败。')
  }

  const handleSeedanceDelivery = async (payload: SeedanceDeliveryPayload) => {
    if (!onDeliverToSeedance || isBusy) return
    setDeliveryStatus('正在提交 Seedance…')
    try {
      const result = await onDeliverToSeedance({ ...payload, model: capability.model, previs: state })
      setDeliveryStatus(result.message)
    } catch {
      setDeliveryStatus('Seedance 提交失败。')
    }
  }
  const selectedReceipt = seedanceReceipts.find((receipt) => receipt.deliveryId === selectedDeliveryId) ?? null

  return (
    <DirectorToolPanelFrame
      title="三维预演"
      titleEn="SPATIAL PREVIS"
      icon="3D"
      accentColor="indigo"
      count={state.masterTake.beats.length}
      summary={`${state.masterTake.id} · ${state.masterTake.durationSec}s`}
      primaryLabel="保存预演"
      busy={isBusy}
      closeDisabled={isBusy}
      allowNestedWheel
      onPrimary={() => { void handleSave() }}
      onClose={onClose}
      ariaLabel="三维预演 / SPATIAL PREVIS"
      bodyClassName="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
    >
      <section data-master-take-id={state.masterTake.id} aria-busy={isBusy} className="space-y-3">
        <SpatialPrevisSceneAssets
          projectId={initialState.projectId}
          references={state.scene.references}
          disabled={isBusy}
          onReferencesChange={handleSceneReferencesChange}
          onUploadPending={setIsSceneAssetsUploading}
          onUpload={async (file) => {
            if (!onUploadSceneAsset) throw new Error('场景资产上传不可用。')
            return onUploadSceneAsset(file)
          }}
        />
        <div className="inline-flex overflow-hidden rounded-md border border-white/12" role="tablist" aria-label="预演编辑模式">
          <button
            type="button"
            role="tab"
            id={tabIds.continuous}
            aria-controls={timelinePanelId}
            aria-selected={state.editorMode === 'continuous'}
            tabIndex={state.editorMode === 'continuous' ? 0 : -1}
            disabled={isBusy}
            ref={(element) => { tabRefs.current.continuous = element }}
            onClick={() => selectEditorMode('continuous')}
            onKeyDown={handleTabKeyDown}
            className={`px-3 py-1.5 text-[11px] font-medium transition ${state.editorMode === 'continuous' ? 'bg-indigo-300/15 text-indigo-100' : 'bg-white/[0.025] text-white/48 hover:bg-white/[0.07] hover:text-white/75'}`}
          >
            连续走位
          </button>
          <button
            type="button"
            role="tab"
            id={tabIds.beats}
            aria-controls={timelinePanelId}
            aria-selected={state.editorMode === 'beats'}
            tabIndex={state.editorMode === 'beats' ? 0 : -1}
            disabled={isBusy}
            ref={(element) => { tabRefs.current.beats = element }}
            onClick={() => selectEditorMode('beats')}
            onKeyDown={handleTabKeyDown}
            className={`border-l border-white/10 px-3 py-1.5 text-[11px] font-medium transition ${state.editorMode === 'beats' ? 'bg-indigo-300/15 text-indigo-100' : 'bg-white/[0.025] text-white/48 hover:bg-white/[0.07] hover:text-white/75'}`}
          >
            剧情节拍
          </button>
        </div>

        <SpatialPrevisViewport state={state} currentTimeSec={currentTimeSec} disabled={isBusy} onChange={handleStateChange} />
        <div role="tabpanel" id={timelinePanelId} aria-labelledby={tabIds[state.editorMode]}>
          <SpatialPrevisTimeline
            state={state}
            currentTimeSec={currentTimeSec}
            disabled={isBusy}
            onCurrentTimeChange={handleCurrentTimeChange}
            onBeatPatch={handleBeatPatch}
          />
        </div>

        {beatError ? <p role="alert" className="text-[11px] text-amber-200/80">{beatError}</p> : null}
        {saveError ? <p role="alert" className="text-[11px] text-amber-200/80">{saveError}</p> : null}
        {saveSuccess ? <p role="status" className="text-[11px] text-emerald-200/80">{saveSuccess}</p> : null}
        {isBusy ? <p role="status" className="text-[11px] text-indigo-100/75">正在保存预演，编辑已锁定。</p> : null}
        {saveConflict ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border border-amber-300/20 bg-amber-300/[0.08] px-2.5 py-2 text-[11px] text-amber-100/85">
            <span>保存冲突：服务器预演已更新，未覆盖服务器数据。</span>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => { void handleReload() }}
              className="rounded-md border border-amber-200/30 px-2 py-1 font-medium text-amber-50 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {isReloading ? '重新加载中…' : '重新加载预演'}
            </button>
          </div>
        ) : null}

        <section aria-label="覆盖风险" className="border-t border-white/[0.08] pt-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">覆盖风险</p>
          {risks.length > 0 ? (
            <ul className="mt-1.5 space-y-1.5">
              {risks.map((risk) => (
                <li key={risk.code} className="text-[11px] leading-relaxed text-amber-100/70">
                  {risk.message} {risk.remedy}
                </li>
              ))}
            </ul>
          ) : <p className="mt-1.5 text-[11px] text-white/38">暂无覆盖风险。</p>}
        </section>

        {onDeliverToSeedance ? (
          <section aria-label="Seedance 交付" className="border-t border-white/[0.08] pt-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">Seedance 交付</p>
              </div>
              <div className="flex items-center gap-1.5">
                {onRetrySeedanceSegment && seedanceReceipts.length > 0 ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setIsReviewOpen((current) => !current)}
                    className="rounded-md border border-white/15 px-2.5 py-1.5 text-[11px] font-medium text-white/72 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    生成复核
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setIsDeliveryOpen((current) => !current)}
                  className="rounded-md border border-indigo-200/30 bg-indigo-300/[0.1] px-2.5 py-1.5 text-[11px] font-medium text-indigo-50 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  生成到 Seedance
                </button>
              </div>
            </div>
            {isDeliveryOpen ? (
              <div className="mt-2">
                <SeedanceDeliveryPanel
                  capability={capability}
                  package={deliveryPackage}
                  onSubmit={(payload) => { void handleSeedanceDelivery(payload) }}
                />
              </div>
            ) : null}
            {isReviewOpen && selectedReceipt && onRetrySeedanceSegment ? (
              <div className="mt-2 space-y-2">
                {seedanceReceipts.length > 1 ? (
                  <select
                    aria-label="选择 Seedance 交付记录"
                    value={selectedReceipt.deliveryId}
                    onChange={(event) => setSelectedDeliveryId(event.currentTarget.value)}
                    className="w-full border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] text-white/72"
                  >
                    {seedanceReceipts.map((receipt) => (
                      <option key={receipt.deliveryId} value={receipt.deliveryId}>
                        {receipt.masterTakeId} · {receipt.deliveryId}
                      </option>
                    ))}
                  </select>
                ) : null}
                <SeedanceChainReviewPanel receipt={selectedReceipt} onRetry={onRetrySeedanceSegment} />
              </div>
            ) : null}
            {deliveryStatus ? <p role="status" className="mt-2 text-[11px] text-indigo-100/75">{deliveryStatus}</p> : null}
          </section>
        ) : null}
      </section>
    </DirectorToolPanelFrame>
  )
}
