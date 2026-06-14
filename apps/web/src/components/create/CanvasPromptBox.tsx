'use client'

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefCallback } from 'react'
import { createPortal } from 'react-dom'

export interface CanvasPromptFooterOption {
  value: string
  label: string
  hint?: string
  icon?: string
  badge?: string
  duration?: string
  disabled?: boolean
}

export interface CanvasPromptFooterItem {
  id: string
  label: string
  value: string
  icon?: string
  options: CanvasPromptFooterOption[]
  onSelect: (value: string) => void
}

export type VideoModeInfo =
  | { mode: 'image-to-video'; thumbnailUrl?: string; sourceNodeTitle?: string }
  | { mode: 'text-to-video' }
  | { mode: 'image-missing'; sourceNodeTitle?: string }

interface CanvasPromptBoxProps {
  prompt: string
  onPromptChange: (value: string) => void
  model: string
  modelLabel?: string
  modelOptionLabels?: Record<string, string>
  providerStatus?: string | null
  providerNotice?: string
  resultSummary?: string
  errorMessage?: string
  models: string[]
  onModelChange: (value: string) => void
  ratio?: string
  ratios?: string[]
  onRatioChange?: (value: string) => void
  placeholder: string
  onGenerate?: () => void
  generateLabel?: string
  generateDisabled?: boolean
  estimatedCredits?: number
  layout?: 'workspace' | 'node'
  multiline?: boolean
  detailsOpen?: boolean
  onToggleDetails?: () => void
  extraPills?: string[]
  showAllModelsInline?: boolean
  footerItems?: CanvasPromptFooterItem[]
  videoModeInfo?: VideoModeInfo
  onRequestReferenceImage?: () => void
  inputRef?: RefCallback<HTMLTextAreaElement | HTMLInputElement>
  onClose?: () => void
  panelPortalTarget?: Element | null
  nodeKind?: string
  onOpenLook?: () => void
}

const MODEL_DURATIONS = ['1~3 min', '1.5 min', '2 min', '30~90s', '2 min', '5~10 min', '2~5 min', '1 min']

const PROVIDER_STATUS_LABELS: Record<string, string> = {
  available: '可用',
  mock: '模拟',
  'not-configured': '未配置',
  'bridge-only': '需桥接',
  'coming-soon': '即将接入',
  checking: '检查中',
  unknown: '状态未知',
  error: '异常',
}
const PARAMETER_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9']
const PARAMETER_QUALITIES = ['480p', '720p', '1080p']
const PARAMETER_DURATIONS = ['5s', '10s']

function splitModelHint(hint?: string) {
  if (!hint) return { status: '', copy: '' }
  const [status, ...rest] = hint.split(' · ')
  return {
    status: status?.trim() ?? '',
    copy: rest.join(' · ').trim(),
  }
}

export function CanvasPromptBox({
  prompt,
  onPromptChange,
  model,
  models: _models,
  onModelChange: _onModelChange,
  ratio,
  ratios,
  onRatioChange,
  placeholder,
  onGenerate,
  generateLabel = '生成',
  generateDisabled = false,
  estimatedCredits,
  modelLabel = model,
  modelOptionLabels: _modelOptionLabels = {},
  providerStatus,
  providerNotice,
  resultSummary,
  errorMessage,
  layout = 'node',
  multiline = layout === 'node',
  detailsOpen: _detailsOpen = false,
  onToggleDetails: _onToggleDetails,
  extraPills: _extraPills = [],
  footerItems = [],
  videoModeInfo,
  onRequestReferenceImage,
  inputRef,
  onClose,
  panelPortalTarget,
  nodeKind,
  onOpenLook,
}: CanvasPromptBoxProps) {
  const [openFooterId, setOpenFooterId] = useState<string | null>(null)
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | undefined>(undefined)
  const [paramQuality, setParamQuality] = useState('1080p')
  const [paramDuration, setParamDuration] = useState('5s')
  const [paramAudio, setParamAudio] = useState(true)
  const [activeToolId, setActiveToolId] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const footerButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const toolLabelTimerRef = useRef<number | null>(null)
  const isSeedreamImageModel = model === 'volcengine-seedream-image'
  const qualityOptions = isSeedreamImageModel ? ['2K'] : PARAMETER_QUALITIES
  const providerItem = footerItems.find((item) => item.id === 'api' || item.id === 'provider') ?? null
  const ratioItem: CanvasPromptFooterItem | null = ratio && ratios && onRatioChange
    ? {
      id: 'ratio',
      label: '比例',
      value: `${ratio} · 2K`,
      options: ratios.map((item) => ({
        value: item,
        label: `${item} · 2K`,
        hint: item === '9:16' ? '竖屏短视频' : item === '1:1' ? '方形画面' : '横版画面',
        icon: '□',
      })),
      onSelect: onRatioChange,
    }
    : null
  const openItem = openFooterId === 'ratio'
    ? ratioItem
    : footerItems.find((item) => item.id === openFooterId) ?? null

  const updatePopoverPosition = useCallback(() => {
    if (!openItem || typeof window === 'undefined') {
      setPopoverStyle(undefined)
      return
    }

    const boxRect = boxRef.current?.getBoundingClientRect()
    if (!boxRect) return

    const margin = 16
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const isProviderPanel = openItem.id === 'api' || openItem.id === 'provider'
    const isParamsPanel = openItem.id === 'params'
    const anchorRect = footerButtonRefs.current[openItem.id]?.getBoundingClientRect() ?? boxRect
    const width = Math.min(isProviderPanel ? 600 : isParamsPanel ? 320 : 300, viewportWidth - margin * 2)
    const measuredHeight = panelRef.current?.scrollHeight ?? 0
    const estimatedHeight = isParamsPanel
      ? 390
      : 18 + openItem.options.length * (isProviderPanel ? 58 : 52)
    // Provider panel: at least 360px so 5 options (header ~30px + 5 × 56px = 310px) are always visible
    const maxHeight = Math.max(isProviderPanel ? 360 : 160, Math.min(isProviderPanel ? viewportHeight * 0.80 : viewportHeight * 0.64, viewportHeight - margin * 2))
    const panelHeight = Math.min(measuredHeight || estimatedHeight, maxHeight)
    const preferredLeft = isProviderPanel || isParamsPanel
      ? anchorRect.left
      : anchorRect.left + anchorRect.width / 2 - width / 2
    const absoluteLeft = Math.max(margin, Math.min(preferredLeft, viewportWidth - width - margin))
    const aboveTop = anchorRect.top - panelHeight - 8
    const belowTop = anchorRect.bottom + 8
    const hasRoomAbove = aboveTop >= margin
    const absoluteTop = hasRoomAbove
      ? aboveTop
      : Math.max(margin, Math.min(belowTop, viewportHeight - panelHeight - margin))

    const localTop = absoluteTop - boxRect.top
    const safeTop = (isProviderPanel || layout !== 'node') ? localTop : Math.max(44, localTop)
    const safeMaxHeight = isProviderPanel
      ? maxHeight
      : layout === 'node'
      ? Math.max(118, Math.min(maxHeight, boxRect.height - safeTop - 8))
      : maxHeight

    // For node layout, use position:fixed with viewport coords so the panel escapes
    // the overflowY:auto + transform:scale() stacking context of canvas-node-dialog.
    const useFixed = layout === 'node' && panelPortalTarget != null
    setPopoverStyle({
      position: useFixed ? 'fixed' : undefined,
      bottom: 'auto',
      left: useFixed ? absoluteLeft : absoluteLeft - boxRect.left,
      maxHeight: safeMaxHeight,
      top: useFixed ? absoluteTop : safeTop,
      transform: 'none',
      width,
    })
  }, [layout, openItem, panelPortalTarget])

  useEffect(() => {
    if (!openFooterId) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenFooterId(null)
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && boxRef.current?.contains(target)) return
      setOpenFooterId(null)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [openFooterId])

  useEffect(() => {
    if (!openFooterId) return
    const allowedIds = [...footerItems.map((item) => item.id), ratioItem?.id].filter(Boolean)
    if (!allowedIds.includes(openFooterId)) {
      setOpenFooterId(null)
    }
  }, [footerItems, openFooterId, ratioItem?.id])

  useEffect(() => {
    if (isSeedreamImageModel) {
      setParamQuality('2K')
    } else if (paramQuality === '2K') {
      setParamQuality('1080p')
    }
  }, [isSeedreamImageModel, paramQuality])

  useLayoutEffect(() => {
    if (!openItem) {
      setPopoverStyle(undefined)
      return
    }

    updatePopoverPosition()
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)
    return () => {
      window.removeEventListener('resize', updatePopoverPosition)
      window.removeEventListener('scroll', updatePopoverPosition, true)
    }
  }, [openItem, updatePopoverPosition])

  useEffect(() => {
    return () => {
      if (toolLabelTimerRef.current) {
        window.clearTimeout(toolLabelTimerRef.current)
      }
    }
  }, [])

  const focusPromptInput = useCallback(() => {
    const input = boxRef.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>('.canvas-prompt-input')
    input?.focus()
  }, [])

  const showToolLabel = useCallback((toolId: string, persist = false) => {
    if (toolLabelTimerRef.current) {
      window.clearTimeout(toolLabelTimerRef.current)
      toolLabelTimerRef.current = null
    }
    setActiveToolId(toolId)
    if (persist) {
      toolLabelTimerRef.current = window.setTimeout(() => {
        setActiveToolId(null)
        toolLabelTimerRef.current = null
      }, 1400)
    }
  }, [])

  const hideToolLabel = useCallback((toolId: string) => {
    if (toolLabelTimerRef.current) return
    setActiveToolId((current) => (current === toolId ? null : current))
  }, [])

  const activateNodeTool = useCallback((toolId: string) => {
    showToolLabel(toolId, true)

    if (toolId === 'select') {
      focusPromptInput()
      return
    }

    if (toolId === 'video') {
      if (providerItem) {
        setOpenFooterId((current) => (current === providerItem.id ? null : providerItem.id))
      }
      focusPromptInput()
      return
    }

    if (toolId === 'generate') {
      onGenerate?.()
      return
    }

    if (toolId === 'reference') {
      setOpenFooterId((current) => (current === 'params' ? null : 'params'))
      return
    }
  }, [focusPromptInput, onGenerate, providerItem, showToolLabel])

  const nodeDialogTools = [
    { id: 'select', label: '编辑内容', icon: '▱', active: true },
    { id: 'video', label: '视频模型', icon: '▻' },
    { id: 'generate', label: generateLabel === '生成中…' ? '生成中' : '生成节点', icon: '＋', solid: true },
    { id: 'reference', label: '参数参考', icon: '♙＋', solid: true },
  ] as const

  const promptInput = multiline || layout === 'workspace' ? (
    <textarea
      ref={(element) => inputRef?.(element)}
      value={prompt}
      onChange={(event) => onPromptChange(event.target.value)}
      placeholder={placeholder}
      rows={layout === 'workspace' ? 1 : 3}
      className={`canvas-prompt-input ${layout === 'workspace' ? 'is-workspace' : ''}`}
    />
  ) : (
    <input
      ref={(element) => inputRef?.(element)}
      value={prompt}
      onChange={(event) => onPromptChange(event.target.value)}
      placeholder={placeholder}
      className="canvas-prompt-input"
    />
  )

  const renderFooterPanel = () => {
    if (!openItem) return null
    const isProviderPanel = openItem.id === providerItem?.id
    const isParamsPanel = openItem.id === 'params'
    const usePortal = layout === 'node' && panelPortalTarget != null

    if (isParamsPanel) {
      return (
        <div
          ref={panelRef}
          className="canvas-prompt-footer-panel panel-params is-parameter-panel"
          style={popoverStyle}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="canvas-param-section">
            <div className="canvas-param-label">生成方式</div>
            <button
              type="button"
              className="canvas-param-wide-button is-active"
              onClick={(event) => {
                event.stopPropagation()
                openItem.onSelect('16:9-balanced')
              }}
            >
              首尾帧
            </button>
          </div>

          <div className="canvas-param-section">
            <div className="canvas-param-label">比例</div>
            <div className="canvas-param-segment is-ratio-grid">
              {PARAMETER_RATIOS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`canvas-param-segment-button ${item === (ratio ?? '16:9') ? 'is-active' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onRatioChange?.(item)
                  }}
                >
                  <span className="canvas-ratio-icon" aria-hidden="true" />
                  <span>{item}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="canvas-param-section">
            <div className="canvas-param-label">清晰度</div>
            <div className="canvas-param-segment">
              {qualityOptions.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`canvas-param-segment-button ${item === paramQuality ? 'is-active' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setParamQuality(item)
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
            {isSeedreamImageModel ? <div className="canvas-choice-hint">Seedream 最低 2K</div> : null}
          </div>

          <div className="canvas-param-section">
            <div className="canvas-param-label">生成时长</div>
            <div className="canvas-param-segment">
              {PARAMETER_DURATIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`canvas-param-segment-button ${item === paramDuration ? 'is-active' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setParamDuration(item)
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="canvas-param-section">
            <div className="canvas-param-label">生成音频 <span aria-hidden="true">ⓘ</span></div>
            <div className="canvas-param-segment">
              <button
                type="button"
                className={`canvas-param-segment-button ${paramAudio ? 'is-active' : ''}`}
                onClick={(event) => { event.stopPropagation(); setParamAudio(true) }}
              >
                开启
              </button>
              <button
                type="button"
                className={`canvas-param-segment-button ${!paramAudio ? 'is-active' : ''}`}
                onClick={(event) => { event.stopPropagation(); setParamAudio(false) }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )
    }

    const panel = (
      <div
        ref={panelRef}
        className={`canvas-prompt-footer-panel panel-${openItem.id} ${isProviderPanel ? 'is-model-panel' : ''} ${usePortal ? 'is-portal-panel' : ''}`}
        style={popoverStyle}
      >
        {isProviderPanel ? (
          <div className="canvas-model-panel-header">
            <span className="canvas-model-panel-title">{openItem.label}</span>
            <span className="canvas-model-panel-count">{openItem.options.length} 个模型</span>
          </div>
        ) : null}
        <div className={`canvas-prompt-footer-options ${isProviderPanel ? 'is-scrollable' : ''}`}>
          {openItem.options.map((option, index) => {
            const active = isProviderPanel
              ? option.value === model
              : option.value === ratio
            const modelMeta = isProviderPanel
              ? splitModelHint(option.hint)
              : { status: '', copy: option.hint ?? '' }
            const badge = option.badge ?? modelMeta.status
            const duration = option.duration ?? (isProviderPanel ? MODEL_DURATIONS[index % MODEL_DURATIONS.length] : '')

            return (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                onClick={() => {
                  if (option.disabled) return
                  openItem.onSelect(option.value)
                  setOpenFooterId(null)
                }}
                className={`canvas-choice-button ${isProviderPanel ? 'is-model-row' : ''} ${active ? 'is-active' : ''} ${option.disabled ? 'is-disabled' : ''}`}
              >
                <span className="canvas-choice-icon">{option.icon ?? openItem.icon ?? (isProviderPanel ? '▥' : '✦')}</span>
                <span className="canvas-choice-copy">
                  <span className="canvas-choice-title">{option.label}</span>
                  {modelMeta.copy ? <span className="canvas-choice-hint">{modelMeta.copy}</span> : null}
                </span>
                <span className="canvas-choice-meta">
                  {badge ? <span className={`canvas-provider-status status-${badge}`}>{PROVIDER_STATUS_LABELS[badge] ?? badge}</span> : null}
                  {duration ? <span className="canvas-choice-duration">{duration}</span> : null}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
    return usePortal && panelPortalTarget
      ? createPortal(panel, panelPortalTarget)
      : panel
  }

  if (layout === 'workspace') {
    return (
      <div ref={boxRef} className="canvas-prompt-box is-workspace">
        {renderFooterPanel()}

        <div className="canvas-prompt-input-wrap">
          {promptInput}
          {resultSummary ? (
            <div className="canvas-prompt-result">
              {resultSummary}
            </div>
          ) : null}
        </div>

        {providerNotice && providerStatus !== 'available' ? (
          <div className="canvas-provider-notice">
            {providerNotice}
          </div>
        ) : null}

        <div className="canvas-prompt-footer-nav">
          <div className="canvas-prompt-footer-left">
            {providerItem ? (
              <button
                ref={(element) => { footerButtonRefs.current[providerItem.id] = element }}
                type="button"
                onClick={() => setOpenFooterId((current) => (current === providerItem.id ? null : providerItem.id))}
                className={`canvas-footer-button is-primary-pill ${openFooterId === providerItem.id ? 'is-active' : ''}`}
              >
                <span className="canvas-footer-button-icon">{providerItem.icon ?? '✦'}</span>
                <span className="canvas-footer-button-value">{modelLabel}</span>
              </button>
            ) : null}
            {ratioItem ? (
              <button
                ref={(element) => { footerButtonRefs.current.ratio = element }}
                type="button"
                onClick={() => setOpenFooterId((current) => (current === 'ratio' ? null : 'ratio'))}
                className={`canvas-footer-button ${openFooterId === 'ratio' ? 'is-active' : ''}`}
              >
                <span className="canvas-footer-button-value">{ratioItem.value}</span>
              </button>
            ) : null}
            <span className="canvas-footer-button is-count-pill">
              <span className="canvas-footer-button-value">1x</span>
            </span>
          </div>

          <div className="canvas-prompt-footer-right">
            <button type="button" className="canvas-icon-button" aria-label="语音输入">
              ◌
            </button>
            {estimatedCredits != null && (
              <span className="canvas-footer-button is-credit-pill">
                <span className="canvas-footer-button-value">{estimatedCredits} credits</span>
              </span>
            )}
            {onGenerate ? (
              <button
                type="button"
                onClick={onGenerate}
                disabled={generateDisabled}
                className="create-iridescent-button canvas-generate-button"
                aria-label={generateLabel}
              >
                ↑
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={boxRef} className="canvas-prompt-box is-node">
      {renderFooterPanel()}

      <div className="canvas-node-dialog-topbar">
        <div className="canvas-node-dialog-tools">
          {nodeDialogTools.map((tool, index) => (
            <Fragment key={tool.id}>
              {index === 1 ? <span className="canvas-node-dialog-separator" aria-hidden="true" /> : null}
              <button
                type="button"
                className={`canvas-node-dialog-tool ${'active' in tool && tool.active ? 'is-active' : ''} ${'solid' in tool && tool.solid ? 'is-solid' : ''} ${activeToolId === tool.id ? 'is-showing-label' : ''}`}
                aria-label={tool.label}
                title={tool.label}
                onClick={() => activateNodeTool(tool.id)}
                onMouseEnter={() => showToolLabel(tool.id)}
                onMouseLeave={() => hideToolLabel(tool.id)}
                onFocus={() => showToolLabel(tool.id)}
                onBlur={() => hideToolLabel(tool.id)}
              >
                <span className="canvas-node-dialog-tool-icon" aria-hidden="true">{tool.icon}</span>
                <span className="canvas-node-tool-label" aria-hidden="true">{tool.label}</span>
              </button>
            </Fragment>
          ))}
          {(nodeKind === 'image' || nodeKind === 'video') && onOpenLook ? (
            <>
              <span className="canvas-node-dialog-separator" aria-hidden="true" />
              <button
                type="button"
                className={`canvas-node-dialog-tool canvas-look-tool ${activeToolId === 'look' ? 'is-showing-label' : ''}`}
                aria-label="视觉风格"
                title="视觉风格"
                onClick={onOpenLook}
                onMouseEnter={() => showToolLabel('look')}
                onMouseLeave={() => hideToolLabel('look')}
                onFocus={() => showToolLabel('look')}
                onBlur={() => hideToolLabel('look')}
              >
                <span
                  className="canvas-node-dialog-tool-icon canvas-look-dot"
                  aria-hidden="true"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #ec4899, #06b6d4)',
                    borderRadius: '50%',
                    width: 10,
                    height: 10,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span className="canvas-node-tool-label" aria-hidden="true">视觉风格</span>
              </button>
            </>
          ) : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className={`canvas-node-dialog-expand ${activeToolId === 'close' ? 'is-showing-label' : ''}`}
            aria-label="关闭节点面板"
            title="关闭节点面板"
            onMouseEnter={() => showToolLabel('close')}
            onMouseLeave={() => hideToolLabel('close')}
            onFocus={() => showToolLabel('close')}
            onBlur={() => hideToolLabel('close')}
          >
            <span className="canvas-node-dialog-close-icon" aria-hidden="true" />
            <span className="canvas-node-tool-label" aria-hidden="true">关闭面板</span>
          </button>
        ) : null}
      </div>

      {videoModeInfo ? (
        <div className={`canvas-video-mode-bar${videoModeInfo.mode === 'image-to-video' ? ' is-image-to-video' : videoModeInfo.mode === 'image-missing' ? ' is-warning' : ''}`}>
          {videoModeInfo.mode === 'image-to-video' ? (
            <>
              {videoModeInfo.thumbnailUrl ? (
                <img
                  src={videoModeInfo.thumbnailUrl}
                  alt="参考图"
                  className="canvas-video-mode-thumb"
                />
              ) : <span className="canvas-video-mode-icon">▦</span>}
              <div className="canvas-video-mode-text">
                <span className="canvas-video-mode-label">图生视频</span>
                <span className="canvas-video-mode-desc">参考图：{videoModeInfo.sourceNodeTitle ?? 'Image'}</span>
              </div>
            </>
          ) : videoModeInfo.mode === 'image-missing' ? (
            <>
              <span className="canvas-video-mode-icon">⚠</span>
              <div className="canvas-video-mode-text">
                <span className="canvas-video-mode-label">参考图缺失</span>
                <span className="canvas-video-mode-desc">上游图片尚无可用 URL，请先生成图片</span>
              </div>
            </>
          ) : (
            <>
              <span className="canvas-video-mode-icon">⊡</span>
              <div className="canvas-video-mode-text">
                <span className="canvas-video-mode-label">文生视频</span>
                <span className="canvas-video-mode-desc">
                  {onRequestReferenceImage
                    ? '未连接参考图 · 点击添加图生视频参考'
                    : '未连接参考图，将根据 Prompt 直接生成'}
                </span>
              </div>
              {onRequestReferenceImage ? (
                <button
                  type="button"
                  className="ml-auto shrink-0 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/55 transition hover:border-white/30 hover:bg-white/10 hover:text-white/85"
                  onClick={onRequestReferenceImage}
                >
                  + 选择参考图
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div className="canvas-prompt-input-wrap">
        {promptInput}
        {resultSummary ? (
          <div className="canvas-prompt-result">{resultSummary}</div>
        ) : null}
        {errorMessage ? (
          <div className="canvas-prompt-error">{errorMessage}</div>
        ) : null}
      </div>

      {providerNotice && providerStatus !== 'available' ? (
        <div className="canvas-provider-notice">
          {providerNotice}
        </div>
      ) : null}

      <div className="canvas-prompt-footer-nav">
        <div className="canvas-prompt-footer-row1">
          {providerItem ? (
            <button
              ref={(element) => { footerButtonRefs.current[providerItem.id] = element }}
              type="button"
              onClick={() => setOpenFooterId((current) => (current === providerItem.id ? null : providerItem.id))}
              className={`canvas-footer-button is-primary-pill ${openFooterId === providerItem.id ? 'is-active' : ''}`}
            >
              <span className="canvas-footer-button-icon">◌</span>
              <span className="canvas-footer-button-value">{modelLabel}</span>
            </button>
          ) : null}
          {onGenerate ? (
            <button
              type="button"
              onClick={onGenerate}
              disabled={generateDisabled}
              className="create-iridescent-button canvas-generate-button"
              aria-label={generateLabel}
            >
              <span className="canvas-credit-pill">{generateLabel === '生成' && estimatedCredits != null ? `◉ ${estimatedCredits}` : generateLabel}</span>
              <span className="canvas-send-icon">↑</span>
            </button>
          ) : null}
        </div>

        <div className="canvas-prompt-footer-row2">
          <button
            ref={(element) => { footerButtonRefs.current.params = element }}
            type="button"
            onClick={() => setOpenFooterId((current) => (current === 'params' ? null : 'params'))}
            className={`canvas-footer-button is-reference-pill ${openFooterId === 'params' ? 'is-active' : ''}`}
            aria-label="参数"
            title="参数"
          >
            <span className="canvas-footer-param-chip">{ratio ?? '16:9'}</span>
            <span className="canvas-footer-param-chip">{paramQuality}</span>
            <span className="canvas-footer-param-chip">{paramDuration}</span>
            {paramAudio ? <span className="canvas-footer-param-chip">♫</span> : null}
          </button>
          {estimatedCredits != null && (
            <span className="canvas-footer-chip-pill">{estimatedCredits} credits</span>
          )}
        </div>
      </div>
    </div>
  )
}
