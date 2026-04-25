'use client'

import { useEffect, useRef, useState, type RefCallback } from 'react'

export interface CanvasPromptFooterOption {
  value: string
  label: string
  hint?: string
}

export interface CanvasPromptFooterItem {
  id: string
  label: string
  value: string
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
  showAllModelsInline = false,
  footerItems = [],
  inputRef,
}: CanvasPromptBoxProps) {
  const [openFooterId, setOpenFooterId] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const inlineModels = layout === 'workspace' && !showAllModelsInline
    ? [model]
    : models
  const openFooter = footerItems.find((item) => item.id === openFooterId) ?? null

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

  const promptInput = multiline ? (
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
      className={`canvas-prompt-input ${layout === 'workspace' ? 'is-workspace is-single-line' : ''}`}
    />
  )

  return (
    <div ref={boxRef} className={`canvas-prompt-box ${layout === 'workspace' ? 'is-workspace' : 'is-node'}`}>
      <div className="canvas-prompt-main">
        <div className="canvas-prompt-select">
          {layout === 'workspace' ? (
            inlineModels.map((item) => {
              const active = item === model
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => onModelChange(item)}
                  className={`canvas-pill-button ${active ? 'is-model-active' : ''}`}
                >
                  {item === model ? modelLabel : (modelOptionLabels[item] ?? item)}
                </button>
              )
            })
          ) : (
            <span className="canvas-pill-button is-model-active">
              {modelLabel}
            </span>
          )}
          {providerStatus ? (
            <span className={`canvas-provider-status status-${providerStatus}`}>
              {providerStatus}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          {promptInput}
          {layout === 'workspace' && resultSummary ? (
            <div className="canvas-prompt-result">
              {resultSummary}
            </div>
          ) : null}
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

      {layout === 'workspace' && footerItems.length > 0 ? (
        <>
          {extraPills.length > 0 ? (
            <div className="canvas-pill-row">
              {extraPills.map((item) => (
                <span key={item} className="canvas-pill-button is-passive-pill">
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          {openFooter ? (
            <div className="canvas-prompt-footer-panel">
              <div className="canvas-prompt-footer-header">
                <div>
                  <div className="canvas-prompt-footer-label">{openFooter.label}</div>
                  <div className="canvas-prompt-footer-value">{openFooter.value}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenFooterId(null)}
                  className="canvas-detail-button"
                >
                  收起
                </button>
              </div>

              <div className="canvas-prompt-footer-options">
                {openFooter.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      openFooter.onSelect(option.value)
                      setOpenFooterId(null)
                    }}
                    className={`canvas-choice-button ${openFooter.value === option.value ? 'is-active' : ''}`}
                  >
                    <span>{option.label}</span>
                    {option.hint ? <span className="canvas-choice-hint">{option.hint}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {providerNotice ? (
            <div className="canvas-provider-notice">
              {providerNotice}
            </div>
          ) : null}

          <div className="canvas-prompt-footer-nav">
            {footerItems.map((item) => {
              const active = item.id === openFooterId
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOpenFooterId((current) => (current === item.id ? null : item.id))}
                  className={`canvas-footer-button ${active ? 'is-active' : ''}`}
                >
                  <span className="canvas-footer-button-label">{item.label}</span>
                  <span className="canvas-footer-button-value">{item.value}</span>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
