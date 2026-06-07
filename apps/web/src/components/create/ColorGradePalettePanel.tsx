'use client'

import { useState, useMemo } from 'react'
import { Check, Copy, X } from 'lucide-react'
import {
  COLOR_GRADE_PRESETS,
  createDefaultColorGradeSetting,
  applyColorGradePreset,
  buildColorGradePrompt,
  previewColorGradeApply,
  summarizeColorGradeSetting,
  hasColorGradePrompt,
  type ColorGradePresetId,
  type ColorGradeSetting,
  type ContrastLevel,
  type BlacksIntent,
  type WhitesIntent,
  type SaturationIntent,
  type ColorBoostIntent,
  type MidtoneDetailIntent,
  type SCurveIntent,
  type SkyIntent,
  type FoliageIntent,
  type AccentIntent,
} from '@/lib/canvas/color-grade-palette'

interface GradeNode {
  id: string
  kind: string
  title?: string | null
  prompt?: string | null
  status?: string | null
}

interface ColorGradePalettePanelProps {
  nodes: GradeNode[]
  onApplyGrade: (updates: Array<{ nodeId: string; prompt: string }>) => void
  onClose: () => void
  defaultSelectedNodeId?: string
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function SegmentControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">{label}</p>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
              value === opt.value
                ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300'
                : 'border-white/8 bg-white/3 text-white/50 hover:border-white/16 hover:bg-white/6 hover:text-white/75'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
  note,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  note?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[11px] text-white/70">{label}</p>
        {note && <p className="text-[9px] text-white/35">{note}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 flex-shrink-0 rounded-full border transition ${
          checked
            ? 'border-indigo-500/60 bg-indigo-500/30'
            : 'border-white/15 bg-white/5'
        }`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
            checked ? 'left-4 bg-indigo-400' : 'left-0.5 bg-white/30'
          }`}
        />
      </button>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ColorGradePalettePanel({
  nodes,
  onApplyGrade,
  onClose,
  defaultSelectedNodeId,
}: ColorGradePalettePanelProps) {
  const eligibleNodes = useMemo(
    () => nodes.filter((n) => n.kind === 'image' || n.kind === 'video'),
    [nodes],
  )

  const defaultSelected = useMemo(() => {
    if (defaultSelectedNodeId) {
      const found = eligibleNodes.find((n) => n.id === defaultSelectedNodeId)
      if (found) return [found.id]
    }
    const first = eligibleNodes[0]
    if (first) return [first.id]
    return []
  }, [eligibleNodes, defaultSelectedNodeId])

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(defaultSelected)
  const [setting, setSetting] = useState<ColorGradeSetting>(createDefaultColorGradeSetting())
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [previewResults, setPreviewResults] = useState<ReturnType<typeof previewColorGradeApply> | null>(null)
  const [copied, setCopied] = useState(false)
  const [applySuccess, setApplySuccess] = useState(false)
  const [sectionOpen, setSectionOpen] = useState({
    tone: true,
    saturation: true,
    sCurve: true,
    hsl: true,
    output: true,
  })

  const toggleNode = (id: string) => {
    setSelectedNodeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
    setPreviewText(null)
    setPreviewResults(null)
    setApplySuccess(false)
  }

  const selectAll = () => {
    setSelectedNodeIds(eligibleNodes.map((n) => n.id))
    setPreviewText(null)
    setPreviewResults(null)
  }

  const patchSetting = (patch: Partial<ColorGradeSetting>) => {
    setSetting((prev) => ({ ...prev, ...patch, presetId: 'none' }))
    setPreviewText(null)
    setPreviewResults(null)
    setApplySuccess(false)
  }

  const applyPreset = (presetId: ColorGradePresetId) => {
    if (presetId === 'none') {
      setSetting(createDefaultColorGradeSetting())
    } else {
      setSetting(applyColorGradePreset(presetId))
    }
    setPreviewText(null)
    setPreviewResults(null)
    setApplySuccess(false)
  }

  const handlePreview = () => {
    const results = previewColorGradeApply(eligibleNodes, selectedNodeIds, setting)
    setPreviewResults(results)
    const firstActive = results.find((r) => !r.skipped)
    if (firstActive) {
      setPreviewText(buildColorGradePrompt(setting, 'image'))
    } else {
      // All skipped
      setPreviewText(null)
    }
  }

  const handleApply = () => {
    if (!previewResults) return
    const updates = previewResults
      .filter((r) => !r.skipped)
      .map((r) => ({ nodeId: r.nodeId, prompt: r.newPrompt }))
    if (updates.length > 0) {
      onApplyGrade(updates)
      setApplySuccess(true)
    }
  }

  const handleCopyReport = async () => {
    const nodesSummary = selectedNodeIds
      .map((id) => eligibleNodes.find((n) => n.id === id)?.title ?? id)
      .join(', ')
    const reportText = [
      '=== Color Grade Palette / 调色盘 ===',
      `目标节点：${nodesSummary}`,
      '',
      '--- 调色参数 ---',
      summarizeColorGradeSetting(setting),
      '',
      '--- 追加调色指令 ---',
      buildColorGradePrompt(setting, 'image'),
    ].join('\n')
    try {
      await navigator.clipboard.writeText(reportText)
    } catch {
      // fallback: skip
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setSetting(createDefaultColorGradeSetting())
    setPreviewText(null)
    setPreviewResults(null)
    setApplySuccess(false)
  }

  const skippedNodes = previewResults?.filter((r) => r.skipped && r.skipReason === 'already-has-grade') ?? []
  const activeResults = previewResults?.filter((r) => !r.skipped) ?? []
  const canApply = previewResults !== null && activeResults.length > 0 && !applySuccess
  const canPreview = selectedNodeIds.length > 0

  const toggleSection = (key: keyof typeof sectionOpen) => {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] flex max-h-[88vh] w-[320px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f14]/97 shadow-2xl backdrop-blur-xl"
      data-no-node-drag="true"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between border-b border-white/8 px-4 pb-3 pt-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Editing · 剪辑</p>
          <h2 className="mt-0.5 text-[13px] font-bold text-white/90">Color Grade Palette</h2>
          <p className="text-[10px] text-white/40">调色盘 · 专业影调与色彩控制</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-0.5 rounded-lg p-1.5 text-white/30 transition hover:bg-white/8 hover:text-white/70"
          aria-label="关闭"
        >
          <X size={15} strokeWidth={2.2} />
        </button>
      </div>

      {/* ── Amber safety notice ── */}
      <div className="mx-3 mt-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2.5">
        <p className="text-[10px] font-semibold text-amber-400/90">Prompt 级调色控制 — 非像素级调色</p>
        <p className="mt-0.5 text-[9.5px] leading-relaxed text-amber-300/60">
          当前已生成图片/视频不会立即变化。应用后需要重新生成才会看到效果。
          会加入主体保护约束，尽量保持人物、产品和构图不变。
        </p>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 pt-3 space-y-4">

        {/* ── Node selection ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">选择节点</p>
            {eligibleNodes.length > 1 && (
              <button
                type="button"
                onClick={selectAll}
                className="text-[9px] text-indigo-400/70 hover:text-indigo-300 transition"
              >
                全选
              </button>
            )}
          </div>
          {eligibleNodes.length === 0 && (
            <p className="rounded-xl border border-white/8 bg-white/3 px-3 py-3 text-[11px] text-white/35">
              当前画布暂无图片/视频节点。请先添加节点再使用调色盘。
            </p>
          )}
          <div className="space-y-1.5">
            {eligibleNodes.map((node) => {
              const isSelected = selectedNodeIds.includes(node.id)
              const hasGrade = hasColorGradePrompt(node.prompt ?? '')
              const prompt = node.prompt ?? ''
              const promptPreview = prompt.replace(/\[Color Grade Palette\][\s\S]*/g, '').trim()
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => toggleNode(node.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                    isSelected
                      ? 'border-indigo-500/50 bg-indigo-500/10'
                      : 'border-white/8 bg-white/3 hover:border-white/16 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${isSelected ? 'border-indigo-400 bg-indigo-500/30' : 'border-white/20 bg-transparent'}`}>
                      {isSelected && <Check size={9} strokeWidth={3} className="text-indigo-300" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-white/80 truncate">
                          {node.title ?? (node.kind === 'image' ? '图片节点' : '视频节点')}
                        </span>
                        <span className={`rounded px-1 text-[8px] font-medium ${node.kind === 'image' ? 'bg-sky-500/15 text-sky-400' : 'bg-violet-500/15 text-violet-400'}`}>
                          {node.kind === 'image' ? 'IMG' : 'VID'}
                        </span>
                        {hasGrade && (
                          <span className="rounded px-1 text-[8px] font-medium bg-amber-500/15 text-amber-400">已调色</span>
                        )}
                      </div>
                      {promptPreview && (
                        <p className="mt-0.5 truncate text-[9px] text-white/30">{promptPreview.slice(0, 55)}{promptPreview.length > 55 ? '…' : ''}</p>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Preset strip ── */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">调色预设</p>
          <div className="grid grid-cols-2 gap-1.5">
            {/* None card */}
            <button
              type="button"
              onClick={() => applyPreset('none')}
              className={`rounded-xl border px-3 py-2 text-left transition ${
                setting.presetId === 'none'
                  ? 'border-white/25 bg-white/8'
                  : 'border-white/8 bg-white/3 hover:border-white/16 hover:bg-white/5'
              }`}
            >
              <p className="text-[10px] font-semibold text-white/70">手动</p>
              <p className="text-[8.5px] text-white/30">自定义参数</p>
            </button>
            {COLOR_GRADE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={`rounded-xl border px-3 py-2 text-left transition overflow-hidden ${
                  setting.presetId === preset.id
                    ? 'border-indigo-500/60 bg-indigo-500/10'
                    : 'border-white/8 bg-white/3 hover:border-white/16 hover:bg-white/5'
                }`}
              >
                {/* Accent strip */}
                <div
                  className="mb-1.5 h-1 w-full rounded-full"
                  style={{ background: preset.accentColor }}
                />
                <p className="text-[10px] font-semibold text-white/80 leading-tight">{preset.nameZh}</p>
                <p className="text-[8px] text-white/35 leading-tight">{preset.nameEn}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Tone Controls ── */}
        <div className="rounded-xl border border-white/8 bg-white/2 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('tone')}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-white/3 transition"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Tone Controls · 影调控制</p>
            <span className="text-[9px] text-white/25">{sectionOpen.tone ? '▾' : '▸'}</span>
          </button>
          {sectionOpen.tone && (
            <div className="space-y-3 border-t border-white/6 px-3 py-3">
              <SegmentControl<ContrastLevel>
                label="Contrast 对比度"
                value={setting.contrast}
                options={[
                  { value: 'low', label: '低' },
                  { value: 'medium', label: '中' },
                  { value: 'high', label: '高' },
                ]}
                onChange={(v) => patchSetting({ contrast: v })}
              />
              <SegmentControl<BlacksIntent>
                label="Blacks 黑位"
                value={setting.blacks}
                options={[
                  { value: 'preserve-detail', label: '保留细节' },
                  { value: 'neutral', label: '中性' },
                  { value: 'deepen', label: '压暗' },
                ]}
                onChange={(v) => patchSetting({ blacks: v })}
              />
              <SegmentControl<WhitesIntent>
                label="Whites 白位"
                value={setting.whites}
                options={[
                  { value: 'protect-highlights', label: '保护高光' },
                  { value: 'neutral', label: '中性' },
                  { value: 'brighten', label: '提亮' },
                ]}
                onChange={(v) => patchSetting({ whites: v })}
              />
            </div>
          )}
        </div>

        {/* ── Saturation Controls ── */}
        <div className="rounded-xl border border-white/8 bg-white/2 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('saturation')}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-white/3 transition"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Saturation · 饱和度控制</p>
            <span className="text-[9px] text-white/25">{sectionOpen.saturation ? '▾' : '▸'}</span>
          </button>
          {sectionOpen.saturation && (
            <div className="space-y-3 border-t border-white/6 px-3 py-3">
              <SegmentControl<SaturationIntent>
                label="Master Saturation 饱和度"
                value={setting.saturation}
                options={[
                  { value: 'low', label: '低' },
                  { value: 'slightly-muted', label: '轻降' },
                  { value: 'neutral', label: '中性' },
                  { value: 'slightly-boosted', label: '轻升' },
                  { value: 'high', label: '高' },
                ]}
                onChange={(v) => patchSetting({ saturation: v })}
              />
              <SegmentControl<ColorBoostIntent>
                label="Color Boost 色彩自然增强"
                value={setting.colorBoost}
                options={[
                  { value: 'off', label: '关' },
                  { value: 'subtle', label: '轻微' },
                  { value: 'medium', label: '中等' },
                  { value: 'strong', label: '强' },
                ]}
                onChange={(v) => patchSetting({ colorBoost: v })}
              />
              <SegmentControl<MidtoneDetailIntent>
                label="Midtone Detail 纹理细节"
                value={setting.midtoneDetail}
                options={[
                  { value: 'soften', label: '柔化' },
                  { value: 'off', label: '关' },
                  { value: 'subtle', label: '轻度' },
                  { value: 'medium', label: '中度' },
                ]}
                onChange={(v) => patchSetting({ midtoneDetail: v })}
              />
            </div>
          )}
        </div>

        {/* ── S-Curve Intent ── */}
        <div className="rounded-xl border border-white/8 bg-white/2 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('sCurve')}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-white/3 transition"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">S-Curve Intent · 曲线意图</p>
            <span className="text-[9px] text-white/25">{sectionOpen.sCurve ? '▾' : '▸'}</span>
          </button>
          {sectionOpen.sCurve && (
            <div className="space-y-1.5 border-t border-white/6 px-3 py-3">
              {(
                [
                  { value: 'none', label: '无', desc: '线性，不添加曲线' },
                  { value: 'gentle-s-curve', label: '轻柔 S-Curve', desc: '自然对比，保留所有细节' },
                  { value: 'standard-s-curve', label: '标准 S-Curve', desc: '电影感对比，胶片调性' },
                  { value: 'steep-s-curve', label: '陡峭 S-Curve', desc: '戏剧高对比，Noir 感' },
                  { value: 'lifted-blacks-s-curve', label: 'Lifted Blacks S', desc: '黑位提升+胶片 S 曲线' },
                ] as Array<{ value: SCurveIntent; label: string; desc: string }>
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => patchSetting({ sCurve: opt.value })}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
                    setting.sCurve === opt.value
                      ? 'border-indigo-500/50 bg-indigo-500/10'
                      : 'border-white/6 bg-white/2 hover:border-white/14 hover:bg-white/5'
                  }`}
                >
                  <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${setting.sCurve === opt.value ? 'border-indigo-400 bg-indigo-500/30' : 'border-white/20'}`}>
                    {setting.sCurve === opt.value && <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />}
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-white/80">{opt.label}</p>
                    <p className="text-[9px] text-white/35">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── HSL Intent ── */}
        <div className="rounded-xl border border-white/8 bg-white/2 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('hsl')}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-white/3 transition"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">HSL Intent · 色相保护意图</p>
            <span className="text-[9px] text-white/25">{sectionOpen.hsl ? '▾' : '▸'}</span>
          </button>
          {sectionOpen.hsl && (
            <div className="space-y-3 border-t border-white/6 px-3 py-3">
              <p className="text-[9px] text-white/30 italic">prompt-level only — 非真实像素选区</p>

              <ToggleRow
                label="皮肤保护"
                checked={setting.protectSkin}
                onChange={(v) => patchSetting({ protectSkin: v })}
                note="protect skin tones unchanged"
              />

              <SegmentControl<SkyIntent>
                label="Sky 天空"
                value={setting.sky}
                options={[
                  { value: 'none', label: '不处理' },
                  { value: 'deepen-blue', label: '加深蓝色' },
                  { value: 'dramatic-dark', label: '压暗戏剧' },
                  { value: 'airy-bright', label: '提亮空灵' },
                ]}
                onChange={(v) => patchSetting({ sky: v })}
              />

              <SegmentControl<FoliageIntent>
                label="Foliage 植被"
                value={setting.foliage}
                options={[
                  { value: 'none', label: '不处理' },
                  { value: 'reduce-green-saturation', label: '降绿饱和' },
                  { value: 'vibrant-foliage', label: '提升活力' },
                ]}
                onChange={(v) => patchSetting({ foliage: v })}
              />

              <SegmentControl<AccentIntent>
                label="Accent 色彩强调"
                value={setting.accent}
                options={[
                  { value: 'none', label: '不处理' },
                  { value: 'warm-emphasis', label: '暖色调' },
                  { value: 'cool-emphasis', label: '冷色调' },
                  { value: 'neon-emphasis', label: '霓虹' },
                ]}
                onChange={(v) => patchSetting({ accent: v })}
              />
            </div>
          )}
        </div>

        {/* ── Output Protection ── */}
        <div className="rounded-xl border border-white/8 bg-white/2 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('output')}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-white/3 transition"
          >
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Output Protection · 输出保护</p>
              <span className="rounded px-1 py-0.5 text-[8px] bg-emerald-500/15 text-emerald-400 font-medium">始终开启</span>
            </div>
            <span className="text-[9px] text-white/25">{sectionOpen.output ? '▾' : '▸'}</span>
          </button>
          {sectionOpen.output && (
            <div className="space-y-3 border-t border-white/6 px-3 py-3">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2 space-y-0.5">
                <p className="text-[9.5px] text-emerald-400/80 font-medium">强制保护（不可关闭）</p>
                <p className="text-[9px] text-white/35">preserve original subject, composition, and characters</p>
              </div>
              <ToggleRow
                label="无高光截断"
                checked={setting.protectHighlights}
                onChange={(v) => patchSetting({ protectHighlights: v })}
                note="no blown highlights"
              />
              <ToggleRow
                label="无阴影截断"
                checked={setting.protectShadows}
                onChange={(v) => patchSetting({ protectShadows: v })}
                note="no crushed blacks"
              />
              <ToggleRow
                label="皮肤色调准确"
                checked={setting.accurateSkin}
                onChange={(v) => patchSetting({ accurateSkin: v })}
                note="accurate skin tone reproduction"
              />
            </div>
          )}
        </div>

        {/* ── Future note ── */}
        <p className="text-center text-[8.5px] text-white/20">
          Primary Wheels · HDR Zones · Scopes · Qualifier · Power Windows — 将在后续高级版加入
        </p>

        {/* ── Prompt preview ── */}
        {(previewText !== null || (previewResults && skippedNodes.length > 0)) && (
          <div className="space-y-2">
            {skippedNodes.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2.5">
                <p className="text-[10px] font-semibold text-amber-400/90">部分节点已有调色盘段落</p>
                <p className="mt-0.5 text-[9px] text-amber-300/60">
                  MVP 将跳过这些节点。若要重新调色，请手动删除旧 [Color Grade Palette] 段落后再应用。
                </p>
                <div className="mt-1.5 space-y-0.5">
                  {skippedNodes.map((r) => {
                    const node = eligibleNodes.find((n) => n.id === r.nodeId)
                    return (
                      <p key={r.nodeId} className="text-[9px] text-amber-300/50">
                        · {node?.title ?? r.nodeId}（已跳过）
                      </p>
                    )
                  })}
                </div>
              </div>
            )}
            {previewText && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">调色指令预览</p>
                </div>
                <textarea
                  readOnly
                  value={previewText}
                  className="w-full resize-none rounded-xl border border-white/8 bg-white/3 p-3 font-mono text-[9px] leading-relaxed text-white/55 focus:outline-none"
                  rows={10}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Apply success ── */}
        {applySuccess && (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-3">
            <p className="text-[11px] font-semibold text-emerald-400">✅ 已追加调色描述</p>
            <p className="mt-0.5 text-[9px] text-emerald-300/60">请重新生成查看效果。</p>
          </div>
        )}

      </div>

      {/* ── Footer Apply Bar ── */}
      <div className="border-t border-white/8 px-3 py-3 space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={!canPreview}
            className="flex-1 rounded-xl border border-indigo-500/40 bg-indigo-500/15 py-2 text-[11px] font-semibold text-indigo-300 transition hover:bg-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            生成调色预览
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className="flex-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-2 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            追加到 Prompt
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 rounded-xl border border-white/8 bg-white/3 py-1.5 text-[10px] text-white/40 transition hover:bg-white/6 hover:text-white/60"
          >
            重置调色
          </button>
          <button
            type="button"
            onClick={handleCopyReport}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/3 py-1.5 text-[10px] text-white/40 transition hover:bg-white/6 hover:text-white/60"
          >
            {copied ? <Check size={10} strokeWidth={2.5} className="text-emerald-400" /> : <Copy size={10} strokeWidth={2} />}
            {copied ? '已复制' : '复制报告'}
          </button>
        </div>
      </div>
    </div>
  )
}
