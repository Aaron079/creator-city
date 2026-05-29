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
  CameraBody,
  LensType,
  FocalLength,
  Aperture,
} from '@/lib/director-controls/types'

type DirectorControlPanelProps = {
  controls: DirectorControlParams
  onChange: (controls: DirectorControlParams) => void
  basePrompt: string
  target?: 'image' | 'video'
}

type ChipGroupProps<T extends string> = {
  value: T | undefined
  options: { value: T; label: string }[]
  onChange: (v: T | undefined) => void
}

function ChipGroup<T extends string>({ value, options, onChange }: ChipGroupProps<T>) {
  return (
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
  )
}

// Camera body card icons as CSS-drawn SVG paths
const CAMERA_BODY_ICONS: Record<CameraBody, string> = {
  cinema: '🎬',
  handheld: '📷',
  drone: '🚁',
  studio: '🎥',
}

const CAMERA_BODY_OPTIONS: { value: CameraBody; label: string; desc: string }[] = [
  { value: 'cinema', label: '电影机', desc: 'ARRI / RED 级' },
  { value: 'handheld', label: '手持', desc: '纪录片质感' },
  { value: 'drone', label: '无人机', desc: '航拍俯瞰' },
  { value: 'studio', label: '摄影棚', desc: '受控精准打光' },
]

const SHOT_OPTIONS: { value: ShotType; label: string }[] = [
  { value: 'wide', label: '远景' },
  { value: 'medium', label: '中景' },
  { value: 'close', label: '近景' },
  { value: 'extreme-close', label: '特写' },
]

const LENS_TYPE_OPTIONS: { value: LensType; label: string }[] = [
  { value: 'wide-angle', label: '广角' },
  { value: 'standard', label: '标准' },
  { value: 'telephoto', label: '长焦' },
  { value: 'macro', label: '微距' },
]

const FOCAL_LENGTH_OPTIONS: { value: FocalLength; label: string }[] = [
  { value: '14mm', label: '14' },
  { value: '24mm', label: '24' },
  { value: '35mm', label: '35' },
  { value: '50mm', label: '50' },
  { value: '85mm', label: '85' },
  { value: '135mm', label: '135' },
]

const APERTURE_OPTIONS: { value: Aperture; label: string }[] = [
  { value: 'f1.4', label: 'f/1.4' },
  { value: 'f2.8', label: 'f/2.8' },
  { value: 'f4', label: 'f/4' },
  { value: 'f8', label: 'f/8' },
  { value: 'f11', label: 'f/11' },
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

type TabId = '摄影机' | '镜头' | '运镜' | '灯光' | '色彩' | '节奏'
const TABS: TabId[] = ['摄影机', '镜头', '运镜', '灯光', '色彩', '节奏']

function tabHasActive(tab: TabId, controls: DirectorControlParams): boolean {
  switch (tab) {
    case '摄影机': return Boolean(controls.cameraBody)
    case '镜头': return Boolean(controls.shotType || controls.lensType || controls.focalLength || controls.aperture)
    case '运镜': return Boolean(controls.cameraMovement)
    case '灯光': return Boolean(controls.lighting)
    case '色彩': return Boolean(controls.color || controls.style)
    case '节奏': return Boolean(controls.rhythm)
  }
}

export function DirectorControlPanel({ controls, onChange, basePrompt, target = 'image' }: DirectorControlPanelProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('摄影机')
  const [promptCopied, setPromptCopied] = useState(false)

  const hasAny = Boolean(
    controls.shotType || controls.cameraMovement || controls.style || controls.lighting ||
    controls.color || controls.rhythm || controls.cameraBody || controls.lensType ||
    controls.focalLength || controls.aperture,
  )

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
        <span>摄影机控制</span>
        {hasAny && !open && (
          <span className="director-active-summary">{result?.metadata.summarySentence}</span>
        )}
        {hasAny && (
          <span className="director-active-dot" />
        )}
      </button>

      {open && (
        <div className="director-control-body">
          {/* Tab navigation */}
          <div className="director-tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`director-tab ${activeTab === tab ? 'is-active' : ''} ${tabHasActive(tab, controls) ? 'has-dot' : ''}`}
                onClick={() => setActiveTab(tab)}
                data-no-node-drag="true"
              >
                {tab}
                {tabHasActive(tab, controls) && <span className="director-tab-dot" />}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="director-tab-content">
            {activeTab === '摄影机' && (
              <div>
                <div className="director-section-label">生成控制</div>
                <div className="director-camera-cards">
                  {CAMERA_BODY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      title={CONTROL_GROUP_TOOLTIPS[opt.value] ?? opt.label}
                      className={`director-camera-card ${controls.cameraBody === opt.value ? 'is-active' : ''}`}
                      onClick={() => onChange({ ...controls, cameraBody: controls.cameraBody === opt.value ? undefined : opt.value })}
                      data-no-node-drag="true"
                    >
                      <span className="director-camera-icon">{CAMERA_BODY_ICONS[opt.value]}</span>
                      <span className="director-camera-label">{opt.label}</span>
                      <span className="director-camera-desc">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === '镜头' && (
              <div className="director-tab-section-stack">
                <div>
                  <div className="director-section-label">生成控制</div>
                  <div className="director-control-group-label">取景范围</div>
                  <ChipGroup
                    value={controls.shotType}
                    options={SHOT_OPTIONS}
                    onChange={(v) => onChange({ ...controls, shotType: v })}
                  />
                </div>
                <div>
                  <div className="director-control-group-label">镜头类型</div>
                  <ChipGroup
                    value={controls.lensType}
                    options={LENS_TYPE_OPTIONS}
                    onChange={(v) => onChange({ ...controls, lensType: v })}
                  />
                </div>
                <div>
                  <div className="director-control-group-label">焦距 (mm)</div>
                  <ChipGroup
                    value={controls.focalLength}
                    options={FOCAL_LENGTH_OPTIONS}
                    onChange={(v) => onChange({ ...controls, focalLength: v })}
                  />
                </div>
                <div>
                  <div className="director-control-group-label">光圈</div>
                  <ChipGroup
                    value={controls.aperture}
                    options={APERTURE_OPTIONS}
                    onChange={(v) => onChange({ ...controls, aperture: v })}
                  />
                </div>
              </div>
            )}

            {activeTab === '运镜' && (
              <div>
                <div className="director-section-label">生成控制</div>
                <ChipGroup
                  value={controls.cameraMovement}
                  options={CAMERA_OPTIONS}
                  onChange={(v) => onChange({ ...controls, cameraMovement: v })}
                />
                {controls.cameraMovement && (
                  <div className="director-asset-section">
                    <div className="director-section-label director-section-label--asset">已有资产预览</div>
                    <div className="director-asset-hint">选择运镜后，画布上的媒体节点将实时演示该运镜动画。</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === '灯光' && (
              <div>
                <div className="director-section-label">生成控制</div>
                <ChipGroup
                  value={controls.lighting}
                  options={LIGHTING_OPTIONS}
                  onChange={(v) => onChange({ ...controls, lighting: v })}
                />
                {controls.lighting && (
                  <div className="director-asset-section">
                    <div className="director-section-label director-section-label--asset">已有资产预览</div>
                    <div className="director-asset-hint">选择灯光后，画布上的媒体节点将叠加对应光线渐变。</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === '色彩' && (
              <div className="director-tab-section-stack">
                <div>
                  <div className="director-section-label">生成控制</div>
                  <div className="director-control-group-label">调色风格</div>
                  <ChipGroup
                    value={controls.color}
                    options={COLOR_OPTIONS}
                    onChange={(v) => onChange({ ...controls, color: v })}
                  />
                </div>
                <div>
                  <div className="director-control-group-label">画面风格</div>
                  <ChipGroup
                    value={controls.style}
                    options={STYLE_OPTIONS}
                    onChange={(v) => onChange({ ...controls, style: v })}
                  />
                </div>
                {controls.color && (
                  <div className="director-asset-section">
                    <div className="director-section-label director-section-label--asset">已有资产预览</div>
                    <div className="director-asset-hint">色彩调整将实时通过 CSS filter 预览在已生成媒体上。</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === '节奏' && (
              <div>
                <div className="director-section-label">生成控制</div>
                <ChipGroup
                  value={controls.rhythm}
                  options={RHYTHM_OPTIONS}
                  onChange={(v) => onChange({ ...controls, rhythm: v })}
                />
                {controls.rhythm && (
                  <div className="director-asset-section">
                    <div className="director-section-label director-section-label--asset">已有资产预览</div>
                    <div className="director-asset-hint">
                      {controls.rhythm === 'slow-motion' && '视频播放速度将调为 0.5x（慢动作预览）'}
                      {controls.rhythm === 'fast-paced' && '视频播放速度将调为 1.5x（快节奏预览）'}
                      {controls.rhythm === 'stable-shot' && '视频保持正常播放速度（1x）'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Compiled prompt preview */}
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
                  {promptCopied ? '已复制 ✓' : '复制'}
                </button>
                <button
                  type="button"
                  className="director-prompt-reset-btn"
                  onClick={handleReset}
                  data-no-node-drag="true"
                >
                  清除全部
                </button>
              </div>
            </div>
          )}

          {!hasAny && (
            <div className="director-empty-hint">选择参数后，Prompt 将自动融入对应镜头语言</div>
          )}

          <div className="director-disclaimer">当前为预览级摄影控制，CSS 效果仅用于本地预览，不影响生成 API 请求。</div>
        </div>
      )}
    </div>
  )
}
