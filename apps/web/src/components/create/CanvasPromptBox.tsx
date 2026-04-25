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
  models,
  onModelChange,
  ratio,
  ratios,
  onRatioChange,
  placeholder,
  onGenerate,
  generateLabel = '生成',
  modelLabel = model,
  modelOptionLabels = {},
  providerStatus,
  providerNotice,
  resultSummary,
  layout = 'node',
  multiline = layout === 'node',
  detailsOpen = false,
  onToggleDetails,
  extraPills = [],
  footerItems = [],
  inputRef,
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
  const workspaceOpenItem = openFooterId === 'ratio' ? ratioItem : providerItem && openFooterId === providerItem.id ? providerItem : null

  useEffect(() => {
    if (layout !== 'workspace' || !openFooterId) return

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
  }, [layout, openFooterId])

  useEffect(() => {
    if (layout !== 'workspace' || !openFooterId) return
    const allowedIds = [providerItem?.id, ratioItem?.id].filter(Boolean)
    if (!allowedIds.includes(openFooterId)) {
      setOpenFooterId(null)
    }
  }, [layout, openFooterId, providerItem?.id, ratioItem?.id])

  const promptInput = multiline || layout === 'workspace' ? (
    <textarea
      ref={(element) => inputRef?.(element)}
      value={prompt}
      onChange={(event) => onPromptChange(event.target.value)}
      placeholder={placeholder}
      rows={layout === 'workspace' ? 2 : 3}
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
        {workspaceOpenItem ? (
          <div className={`canvas-prompt-footer-panel panel-${workspaceOpenItem.id}`}>
            <div className="canvas-prompt-footer-options">
              {workspaceOpenItem.options.map((option, index) => {
                const active = workspaceOpenItem.id === providerItem?.id
                  ? option.value === model
                  : option.value === ratio
                const modelMeta = workspaceOpenItem.id === providerItem?.id
                  ? splitModelHint(option.hint)
                  : { status: '', copy: option.hint ?? '' }
                const badge = option.badge ?? modelMeta.status
                const duration = option.duration ?? (workspaceOpenItem.id === providerItem?.id ? MODEL_DURATIONS[index % MODEL_DURATIONS.length] : '')

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      workspaceOpenItem.onSelect(option.value)
                      setOpenFooterId(null)
                    }}
                    className={`canvas-choice-button ${workspaceOpenItem.id === providerItem?.id ? 'is-model-row' : ''} ${active ? 'is-active' : ''}`}
                  >
                    <span className="canvas-choice-icon">{option.icon ?? workspaceOpenItem.icon ?? '✦'}</span>
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
      <div className="canvas-prompt-main">
        <div className="canvas-prompt-select">
          <span className="canvas-pill-button is-model-active">
            {modelLabel}
          </span>
          {providerStatus ? (
            <span className={`canvas-provider-status status-${providerStatus}`}>
              {providerStatus}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          {promptInput}
        </div>

        {onGenerate ? (
          <button
            type="button"
            onClick={onGenerate}
            className="create-iridescent-button canvas-generate-button"
          >
            {generateLabel}
          </button>
        ) : null}
      </div>

      <div className="canvas-prompt-toolbar">
        <div className="canvas-pill-row">
          {ratio ? (
            <button
              type="button"
              onClick={() => {
                if (!ratios || !onRatioChange) return
                const currentIndex = ratios.indexOf(ratio)
                const nextRatio = ratios[(currentIndex + 1) % ratios.length] ?? ratio
                onRatioChange(nextRatio)
              }}
              className="canvas-pill-button is-ratio-active"
            >
              {ratio}
            </button>
          ) : null}
          {extraPills.map((item) => (
            <span key={item} className="canvas-pill-button is-passive-pill">
              {item}
            </span>
          ))}
        </div>

        {onToggleDetails ? (
          <button
            type="button"
            onClick={onToggleDetails}
            className="canvas-detail-button"
          >
            {detailsOpen ? '收起' : '详情'}
          </button>
        ) : null}
      </div>

      {detailsOpen ? (
        <div className="canvas-prompt-advanced">
          <div className="canvas-pill-row">
            {models.map((item) => {
              const active = item === model
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => onModelChange(item)}
                  className={`canvas-pill-button ${active ? 'is-model-active' : ''}`}
                >
                  {active ? modelLabel : (modelOptionLabels[item] ?? item)}
                </button>
              )
            })}
          </div>

          {providerNotice ? (
            <div className="canvas-provider-notice">
              {providerNotice}
            </div>
          ) : null}

          {ratios && ratios.length > 0 && ratio && onRatioChange ? (
            <div className="canvas-pill-row">
              {ratios.map((item) => {
                const active = item === ratio
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onRatioChange(item)}
                    className={`canvas-pill-button ${active ? 'is-ratio-active' : ''}`}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
