'use client'

import { useState, useCallback } from 'react'
import { compileDirectorPrompt } from '@/lib/director-controls/compileDirectorPrompt'
import { CONTROL_GROUP_TOOLTIPS } from '@/lib/director-controls/presets'
import type {
  DirectorControlParams,
  ShotType,
  CameraMovement,
  DirectorStyle,
  Lighting,
  Color,
  Rhythm,
} from '@/lib/director-controls/types'

type DirectorControlPanelProps = {
  controls: DirectorControlParams
  onChange: (controls: DirectorControlParams) => void
  basePrompt: string
  target?: 'image' | 'video'
}

type ChipGroupProps<T extends string> = {
  label: string
  value: T | undefined
  options: { value: T; label: string }[]
  onChange: (v: T | undefined) => void
}

function ChipGroup<T extends string>({ label, value, options, onChange }: ChipGroupProps<T>) {
  return (
    <div className="director-control-group">
      <div className="director-control-group-label">{label}</div>
      <div className="director-control-chips">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            title={CONTROL_GROUP_TOOLTIPS[opt.value] ?? opt.label}
            className={`director-chip ${value === opt.value ? 'is-active' : ''}`}
            onClick={() => onChange(value === opt.value ? undefined : opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const SHOT_OPTIONS: { value: ShotType; label: string }[] = [
  { value: 'wide', label: '远景' },
  { value: 'medium', label: '中景' },
  { value: 'close', label: '近景' },
  { value: 'extreme-close', label: '特写' },
]

const CAMERA_OPTIONS: { value: CameraMovement; label: string }[] = [
  { value: 'push-in', label: '推' },
  { value: 'pull-out', label: '拉' },
  { value: 'pan', label: '摇' },
  { value: 'dolly', label: '移' },
  { value: 'tracking', label: '跟拍' },
  { value: 'overhead', label: '俯拍' },
]

const STYLE_OPTIONS: { value: DirectorStyle; label: string }[] = [
  { value: 'cinematic', label: '电影感' },
  { value: 'commercial', label: '广告感' },
  { value: 'short-drama', label: '短剧' },
  { value: 'manhua', label: '漫剧' },
  { value: 'realistic', label: '写实' },
  { value: 'fantasy', label: '幻想' },
]

const LIGHTING_OPTIONS: { value: Lighting; label: string }[] = [
  { value: 'backlight', label: '逆光' },
  { value: 'rembrandt', label: '伦勃朗' },
  { value: 'neon', label: '霓虹' },
  { value: 'natural', label: '自然光' },
]

const COLOR_OPTIONS: { value: Color; label: string }[] = [
  { value: 'cool', label: '冷色' },
  { value: 'warm', label: '暖色' },
  { value: 'high-contrast', label: '高对比' },
  { value: 'low-saturation', label: '低饱和' },
]

const RHYTHM_OPTIONS: { value: Rhythm; label: string }[] = [
  { value: 'slow-motion', label: '慢动作' },
  { value: 'fast-paced', label: '快节奏' },
  { value: 'stable-shot', label: '稳定镜头' },
]

export function DirectorControlPanel({ controls, onChange, basePrompt, target = 'image' }: DirectorControlPanelProps) {
  const [open, setOpen] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)

  const hasAny = Boolean(controls.shotType || controls.cameraMovement || controls.style || controls.lighting || controls.color || controls.rhythm)

  const result = hasAny
    ? compileDirectorPrompt({ basePrompt, ...controls, target })
    : null

  const handleCopy = useCallback(() => {
    if (!result?.finalPrompt) return
    void navigator.clipboard.writeText(result.finalPrompt).then(() => {
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 1800)
    })
  }, [result])

  const handleReset = useCallback(() => {
    onChange({})
  }, [onChange])

  return (
    <div className="director-control-panel" data-no-node-drag="true">
      <button
        type="button"
        className={`director-control-toggle ${open ? 'is-open' : ''} ${hasAny ? 'has-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        data-no-node-drag="true"
      >
        <span className="director-control-toggle-icon">{open ? '▾' : '▸'}</span>
        <span>导演控制</span>
        {hasAny && !open && (
          <span className="director-active-summary">{result?.metadata.summarySentence}</span>
        )}
        {hasAny && (
          <span className="director-active-dot" />
        )}
      </button>

      {open && (
        <div className="director-control-body">
          <ChipGroup
            label="镜头类型"
            value={controls.shotType}
            options={SHOT_OPTIONS}
            onChange={(v) => onChange({ ...controls, shotType: v })}
          />
          <ChipGroup
            label="镜头运动"
            value={controls.cameraMovement}
            options={CAMERA_OPTIONS}
            onChange={(v) => onChange({ ...controls, cameraMovement: v })}
          />
          <ChipGroup
            label="风格"
            value={controls.style}
            options={STYLE_OPTIONS}
            onChange={(v) => onChange({ ...controls, style: v })}
          />
          <ChipGroup
            label="光线"
            value={controls.lighting}
            options={LIGHTING_OPTIONS}
            onChange={(v) => onChange({ ...controls, lighting: v })}
          />
          <ChipGroup
            label="色彩"
            value={controls.color}
            options={COLOR_OPTIONS}
            onChange={(v) => onChange({ ...controls, color: v })}
          />
          <ChipGroup
            label="节奏"
            value={controls.rhythm}
            options={RHYTHM_OPTIONS}
            onChange={(v) => onChange({ ...controls, rhythm: v })}
          />

          {result && (
            <div className="director-prompt-preview">
              <div className="director-prompt-preview-label">增强后 Prompt</div>
              <div className="director-prompt-preview-text">{result.finalPrompt}</div>
              <div className="director-prompt-preview-actions">
                <button
                  type="button"
                  className="director-prompt-copy-btn"
                  onClick={handleCopy}
                  data-no-node-drag="true"
                >
                  {promptCopied ? '已复制 ✓' : '复制最终 Prompt'}
                </button>
                <button
                  type="button"
                  className="director-prompt-reset-btn"
                  onClick={handleReset}
                  data-no-node-drag="true"
                >
                  清除
                </button>
              </div>
            </div>
          )}

          {!hasAny && (
            <div className="director-empty-hint">选择参数后，Prompt 将自动融入对应镜头语言</div>
          )}
        </div>
      )}
    </div>
  )
}
