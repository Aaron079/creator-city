'use client'

import { useEffect, useRef, useState, type RefCallback } from 'react'

export interface CanvasPromptFooterOption {
  value: string
  label: string
  hint?: string
  icon?: string
  badge?: string
  duration?: string
}

export interface CanvasPromptFooterItem {
  id: string
  label: string
  value: string
  icon?: string
  options: CanvasPromptFooterOption[]
  onSelect: (value: string) => void
}

interface CanvasPromptBoxProps {
  prompt: string
  onPromptChange: (value: string) => void
  model: string
  modelLabel?: string
  modelOptionLabels?: Record<string, string>
  providerStatus?: string | null
  providerNotice?: string
  resultSummary?: string
  models: string[]
  onModelChange: (value: string) => void
  ratio?: string
  ratios?: string[]
  onRatioChange?: (value: string) => void
  placeholder: string
  onGenerate?: () => void
  generateLabel?: string
  layout?: 'workspace' | 'node'
  multiline?: boolean
  detailsOpen?: boolean
  onToggleDetails?: () => void
  extraPills?: string[]
  showAllModelsInline?: boolean
  footerItems?: CanvasPromptFooterItem[]
  inputRef?: RefCallback<HTMLTextAreaElement | HTMLInputElement>
  onClose?: () => void
}

const MODEL_DURATIONS = ['5 ~ 10s', '10 ~ 20s', '20s', '1min', '2min']

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
  modelLabel = model,
  modelOptionLabels: _modelOptionLabels = {},
  providerStatus,
  providerNotice,
  resultSummary,
  layout = 'node',
  multiline = layout === 'node',
  detailsOpen: _detailsOpen = false,
  onToggleDetails: _onToggleDetails,
  extraPills: _extraPills = [],
  footerItems = [],
  inputRef,
  onClose,
}: CanvasPromptBoxProps) {
  const [openFooterId, setOpenFooterId] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
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

  if (layout === 'workspace') {
    return (
      <div ref={boxRef} className="canvas-prompt-box is-workspace">
        {openItem ? (
          <div className={`canvas-prompt-footer-panel panel-${openItem.id}`}>
            <div className="canvas-prompt-footer-options">
              {openItem.options.map((option, index) => {
                const active = openItem.id === providerItem?.id
                  ? option.value === model
                  : option.value === ratio
                const modelMeta = openItem.id === providerItem?.id
                  ? splitModelHint(option.hint)
                  : { status: '', copy: option.hint ?? '' }
                const badge = option.badge ?? modelMeta.status
                const duration = option.duration ?? (openItem.id === providerItem?.id ? MODEL_DURATIONS[index % MODEL_DURATIONS.length] : '')

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      openItem.onSelect(option.value)
                      setOpenFooterId(null)
                    }}
                    className={`canvas-choice-button ${openItem.id === providerItem?.id ? 'is-model-row' : ''} ${active ? 'is-active' : ''}`}
                  >
                    <span className="canvas-choice-icon">{option.icon ?? openItem.icon ?? '✦'}</span>
                    <span className="canvas-choice-copy">
                      <span className="canvas-choice-title">{option.label}</span>
                      {modelMeta.copy ? <span className="canvas-choice-hint">{modelMeta.copy}</span> : null}
                    </span>
                    <span className="canvas-choice-meta">
                      {badge ? <span className={`canvas-provider-status status-${badge}`}>{badge}</span> : null}
                      {duration ? <span className="canvas-choice-duration">{duration}</span> : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="canvas-prompt-input-wrap">
          {promptInput}
          {resultSummary ? (
            <div className="canvas-prompt-result">
              {resultSummary}
            </div>
          ) : null}
        </div>

        {providerNotice && providerStatus === 'not-configured' ? (
          <div className="canvas-provider-notice">
            当前为未配置，仅可模拟
          </div>
        ) : null}

        <div className="canvas-prompt-footer-nav">
          <div className="canvas-prompt-footer-left">
            {providerItem ? (
              <button
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
            <span className="canvas-footer-button is-credit-pill">
              <span className="canvas-footer-button-value">120 credits</span>
            </span>
            {onGenerate ? (
              <button
                type="button"
                onClick={onGenerate}
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
      {openItem ? (
        <div className={`canvas-prompt-footer-panel panel-${openItem.id}`}>
          <div className="canvas-prompt-footer-options">
            {openItem.options.map((option, index) => {
              const active = openItem.id === providerItem?.id
                ? option.value === model
                : option.value === ratio
              const modelMeta = openItem.id === providerItem?.id
                ? splitModelHint(option.hint)
                : { status: '', copy: option.hint ?? '' }
              const badge = option.badge ?? modelMeta.status
              const duration = option.duration ?? (openItem.id === providerItem?.id ? MODEL_DURATIONS[index % MODEL_DURATIONS.length] : '')

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    openItem.onSelect(option.value)
                    setOpenFooterId(null)
                  }}
                  className={`canvas-choice-button ${openItem.id === providerItem?.id ? 'is-model-row' : ''} ${active ? 'is-active' : ''}`}
                >
                  <span className="canvas-choice-icon">{option.icon ?? openItem.icon ?? '✦'}</span>
                  <span className="canvas-choice-copy">
                    <span className="canvas-choice-title">{option.label}</span>
                    {modelMeta.copy ? <span className="canvas-choice-hint">{modelMeta.copy}</span> : null}
                  </span>
                  <span className="canvas-choice-meta">
                    {badge ? <span className={`canvas-provider-status status-${badge}`}>{badge}</span> : null}
                    {duration ? <span className="canvas-choice-duration">{duration}</span> : null}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="canvas-node-dialog-head">
        <div className="canvas-node-dialog-title">节点对话框</div>
        {onClose ? (
          <button type="button" onClick={onClose} className="canvas-composer-close" aria-label="关闭">
            ×
          </button>
        ) : null}
      </div>

      <div className="canvas-prompt-input-wrap">
        {promptInput}
      </div>

      {providerNotice && providerStatus === 'not-configured' ? (
        <div className="canvas-provider-notice">
          当前为未配置，仅可模拟
        </div>
      ) : null}

      <div className="canvas-prompt-footer-nav">
        <div className="canvas-prompt-footer-left">
          {providerItem ? (
            <button
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
          {footerItems.filter((item) => item.id === 'tool' || item.id === 'params').map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setOpenFooterId((current) => (current === item.id ? null : item.id))}
              className={`canvas-footer-button is-compact-tool ${openFooterId === item.id ? 'is-active' : ''}`}
            >
              {item.label}
            </button>
          ))}
          <button type="button" className="canvas-icon-button" aria-label="语音输入">
            ◌
          </button>
          {onGenerate ? (
            <button
              type="button"
              onClick={onGenerate}
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
