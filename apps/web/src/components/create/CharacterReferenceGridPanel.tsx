'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import {
  buildAssetSlotPrompts,
  STYLE_LABELS,
  LAYOUT_LABELS,
  type CharacterReferenceMode,
  type CharacterReferenceStyle,
  type CharacterReferenceLayout,
  type CharacterReferenceOptions,
} from '@/lib/canvas/character-reference-grid'
import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'

interface CharacterSourceNode {
  id: string
  kind: string
  title?: string | null
  prompt?: string | null
  resultText?: string | null
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  assetId?: string | null
  status?: string | null
}

export interface CharacterReferenceSlotRequest {
  key: string
  label: string
  slotDescription: string
  prompt: string
}

export interface CreateCharacterReferenceRequest {
  sourceNodeId: string
  mode: CharacterReferenceMode
  referenceMode: 'asset-reference' | 'text-only'
  sourceAssetId: string | null
  sourceImageUrl: string | null
  sourceVideoUrl: string | null
  slots: CharacterReferenceSlotRequest[]
  consistencyOptions: {
    keepFace: boolean
    keepHair: boolean
    keepOutfit: boolean
    keepBody: boolean
    keepColorScheme: boolean
  }
  style: CharacterReferenceStyle
  layout: CharacterReferenceLayout
}

interface CharacterReferenceGridPanelProps {
  nodes: CharacterSourceNode[]
  onCreateReferenceNode: (req: CreateCharacterReferenceRequest) => void
  onClose: () => void
  defaultSelectedNodeId?: string
}

// ─── Slot wireframe definitions ──────────────────────────────────────────────

const TURNAROUND_SLOTS = [
  { key: 'front',    label: '正面',      sub: 'Front',     icon: '◈' },
  { key: '3quarter', label: '四分之三',  sub: 'Three-qtr', icon: '◇' },
  { key: 'side',     label: '侧面',      sub: 'Side',      icon: '▷' },
  { key: 'back',     label: '背面',      sub: 'Back',      icon: '◁' },
]

const GRID5_SLOTS = [
  { key: 'full-front', label: '全身正面',    sub: 'Full Front',    icon: '⊞' },
  { key: 'full-3q',    label: '全身四分之三', sub: 'Full 3/4',      icon: '⊟' },
  { key: 'expression', label: '表情组',      sub: 'Expressions',   icon: '◎' },
  { key: 'outfit',     label: '服装细节',    sub: 'Outfit Detail', icon: '◉' },
  { key: 'action',     label: '动作姿态',    sub: 'Action Pose',   icon: '◐' },
]

const MODES: Array<{
  id: CharacterReferenceMode
  label: string
  sub: string
  nodeCount: number
  gridLabel: string
  slots: typeof TURNAROUND_SLOTS
}> = [
  {
    id: 'turnaround4',
    label: '四视图参考',
    sub: '正面 / 四分之三 / 侧面 / 背面',
    nodeCount: 4,
    gridLabel: '4 个独立参考节点（2×2 布局）',
    slots: TURNAROUND_SLOTS,
  },
  {
    id: 'grid5',
    label: '九宫格参考',
    sub: '全身 / 表情 / 服装 / 动作',
    nodeCount: 5,
    gridLabel: '5 个独立参考节点（3+2 布局）',
    slots: GRID5_SLOTS,
  },
]

const STYLES: Array<{ id: CharacterReferenceStyle; label: string }> = Object.entries(STYLE_LABELS).map(
  ([id, label]) => ({ id: id as CharacterReferenceStyle, label }),
)
const LAYOUTS: Array<{ id: CharacterReferenceLayout; label: string }> = Object.entries(LAYOUT_LABELS).map(
  ([id, label]) => ({ id: id as CharacterReferenceLayout, label }),
)

export function CharacterReferenceGridPanel({
  nodes,
  onCreateReferenceNode,
  onClose,
  defaultSelectedNodeId,
}: CharacterReferenceGridPanelProps) {
  const primaryNode =
    nodes.find((n) => n.id === defaultSelectedNodeId) ??
    nodes.find((n) => n.kind === 'image' || n.kind === 'video' || n.kind === 'text') ??
    null

  const [mode, setMode] = useState<CharacterReferenceMode>('turnaround4')
  const [characterBrief, setCharacterBrief] = useState<string>(
    (primaryNode?.prompt ?? primaryNode?.resultText ?? '').trim(),
  )
  const [style, setStyle] = useState<CharacterReferenceStyle>('film-character-design')
  const [layout, setLayout] = useState<CharacterReferenceLayout>('clean-white')
  const [keepFace, setKeepFace] = useState(true)
  const [keepHair, setKeepHair] = useState(true)
  const [keepOutfit, setKeepOutfit] = useState(true)
  const [keepBody, setKeepBody] = useState(true)
  const [keepColorScheme, setKeepColorScheme] = useState(true)
  const [created, setCreated] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const activeMode = (MODES.find((m) => m.id === mode) ?? MODES[0])!

  // ─── Asset detection ────────────────────────────────────────────────────────
  const sourceImageUrl = primaryNode?.resultImageUrl ?? null
  const sourceVideoUrl = primaryNode?.resultVideoUrl ?? null
  const sourceAssetId = primaryNode?.assetId ?? null
  const hasAsset = !!(sourceImageUrl || sourceVideoUrl || sourceAssetId)
  const referenceMode: 'asset-reference' | 'text-only' = hasAsset ? 'asset-reference' : 'text-only'

  const proxiedImage = sourceImageUrl ? getProxiedMediaUrl(sourceImageUrl) : null
  const proxiedVideo = sourceVideoUrl ? getProxiedMediaUrl(sourceVideoUrl) : null

  const opts: CharacterReferenceOptions = {
    mode,
    sourcePrompt: characterBrief,
    style,
    layout,
    keepFace,
    keepHair,
    keepOutfit,
    keepBody,
    keepColorScheme,
  }

  const canCreate = !!primaryNode && characterBrief.trim().length > 0

  function handleCreate() {
    if (!primaryNode || !canCreate) return

    const slotPrompts = buildAssetSlotPrompts(opts, {
      assetId: sourceAssetId,
      imageUrl: sourceImageUrl,
      videoUrl: sourceVideoUrl,
    })

    onCreateReferenceNode({
      sourceNodeId: primaryNode.id,
      mode,
      referenceMode,
      sourceAssetId,
      sourceImageUrl,
      sourceVideoUrl,
      slots: slotPrompts.map((item) => ({
        key: item.key,
        label: item.label,
        slotDescription: item.slotDescription ?? item.titleSuffix,
        prompt: item.prompt,
      })),
      consistencyOptions: { keepFace, keepHair, keepOutfit, keepBody, keepColorScheme },
      style,
      layout,
    })
    setCreated(true)
  }

  function handleReset() {
    setCreated(false)
    setCharacterBrief((primaryNode?.prompt ?? primaryNode?.resultText ?? '').trim())
  }

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] -translate-y-1/2 flex"
      style={{ maxHeight: 'calc(100vh - 48px)' }}
      data-no-node-drag="true"
    >
      <div
        className="flex w-[460px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/97 shadow-2xl backdrop-blur-xl"
        style={{ maxHeight: 'calc(100vh - 48px)' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-white/90">人物参考 Skill / Character Reference</p>
            <p className="text-[10px] text-white/35">基于已有资产创建角色参考槽位节点</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/8 hover:text-white/70"
            aria-label="关闭"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">

          {/* Source asset display */}
          {primaryNode ? (
            <div className="shrink-0 border-b border-white/6 px-4 py-3">
              {/* Asset available: image */}
              {proxiedImage && (
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-400 ring-1 ring-emerald-500/25">
                      来源资产参考
                    </span>
                    <span className="text-[9px] text-white/30">{primaryNode.title ?? '未命名节点'}</span>
                  </div>
                  <img
                    src={proxiedImage}
                    alt="来源人物资产"
                    className="w-full max-h-[120px] rounded-xl object-contain border border-white/10 bg-white/3"
                  />
                  <p className="mt-1 text-[9px] text-emerald-400/60">
                    已检测到角色图片资产，将作为各槽位的来源参考保存。
                  </p>
                </div>
              )}
              {/* Asset available: video */}
              {!proxiedImage && proxiedVideo && (
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[9px] font-bold text-sky-400 ring-1 ring-sky-500/25">
                      来源视频参考
                    </span>
                    <span className="text-[9px] text-white/30">{primaryNode.title ?? '未命名节点'}</span>
                  </div>
                  <video
                    src={proxiedVideo}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full max-h-[100px] rounded-xl border border-white/10 bg-black"
                  />
                  <p className="mt-1 text-[9px] text-sky-400/60">
                    视频参考已保存为来源资产引用。当前版本按角色描述与资产链接创建槽位，后续可扩展关键帧参考。
                  </p>
                </div>
              )}
              {/* No asset */}
              {!proxiedImage && !proxiedVideo && (
                <div className="flex items-start gap-2.5 mb-1 rounded-xl border border-amber-500/20 bg-amber-500/6 px-3 py-2">
                  <span className="mt-0.5 text-[14px]">⚠</span>
                  <div>
                    <p className="text-[10px] font-semibold text-amber-400/80">当前节点暂无可用资产</p>
                    <p className="text-[9px] text-white/35 mt-0.5 leading-relaxed">
                      将只使用角色描述创建参考槽位（文字一致性模式）。若需要资产参考，请先在源节点生成图片。
                    </p>
                  </div>
                </div>
              )}
              {/* Node info row */}
              <div className="flex items-center gap-2 mt-1">
                <span className="rounded px-1.5 py-0.5 text-[9px] bg-white/8 text-white/40">
                  {primaryNode.kind.toUpperCase()}
                </span>
                <span className="text-[10px] text-white/55 truncate">{primaryNode.title ?? '未命名节点'}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[8px] font-semibold ${
                  referenceMode === 'asset-reference'
                    ? 'bg-emerald-500/12 text-emerald-400'
                    : 'bg-amber-500/12 text-amber-400/70'
                }`}>
                  {referenceMode === 'asset-reference' ? '资产参考模式' : '仅文字模式'}
                </span>
              </div>
            </div>
          ) : (
            <div className="shrink-0 border-b border-white/6 px-4 py-3">
              <p className="text-[10px] text-amber-400/70">请从画布节点顶部资产菜单打开人物参考 Skill</p>
            </div>
          )}

          {/* Board type selector */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold text-white/40">参考类型</p>
            <div className="flex gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setMode(m.id); setCreated(false) }}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition ${
                    mode === m.id
                      ? 'border-indigo-500/60 bg-indigo-500/10 shadow-[0_0_0_1px_rgba(99,102,241,0.3)]'
                      : 'border-white/8 bg-white/3 hover:border-white/16 hover:bg-white/6'
                  }`}
                >
                  <p className="text-[11px] font-semibold text-white/85">{m.label}</p>
                  <p className="mt-0.5 text-[9px] text-white/35">{m.sub}</p>
                  <p className="mt-1 text-[8px] text-white/20">{m.gridLabel}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Slot preview — expected layout */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-white/40">槽位预览</p>
              <span className="rounded-full border border-white/8 px-2 py-0.5 text-[9px] text-white/25">
                创建 {activeMode.nodeCount} 个独立参考节点
              </span>
            </div>
            <div className={`grid gap-1.5 ${activeMode.id === 'turnaround4' ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {activeMode.slots.map((slot) => (
                <div
                  key={slot.key}
                  className="relative overflow-hidden rounded-lg border border-white/8"
                  style={{ aspectRatio: '1/1' }}
                >
                  {proxiedImage && (
                    <img
                      src={proxiedImage}
                      alt={slot.label}
                      className="absolute inset-0 h-full w-full object-cover opacity-25"
                    />
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/[0.02]">
                    {!proxiedImage && (
                      <span className="text-[16px] text-white/15">{slot.icon}</span>
                    )}
                    <span className="text-[10px] font-semibold text-white/70 mt-1">{slot.label}</span>
                    <span className="text-[8px] text-white/30">{slot.sub}</span>
                    {referenceMode === 'asset-reference' && (
                      <span className="mt-1 text-[7px] text-emerald-400/50">资产已绑定</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[9px] text-white/20 leading-relaxed">
              每个槽位将创建独立的 image 节点，状态为 idle。请在各节点中手动选择 Provider 并生成参考图。
            </p>
          </div>

          {/* Character brief */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold text-white/40">角色描述 / Character Brief</p>
            <p className="mb-2 text-[9px] text-white/25">
              {referenceMode === 'asset-reference'
                ? '角色描述将与来源资产引用共同嵌入各槽位生成指令中，确保角色一致性。'
                : '仅文字模式：角色描述是唯一的一致性约束，建议详细描述外貌、服装、发型等。'}
            </p>
            <textarea
              value={characterBrief}
              onChange={(e) => { setCharacterBrief(e.target.value); setCreated(false) }}
              placeholder="例：20岁亚裔女性，短黑发，穿红色旗袍，身材纤细，手持折扇"
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] leading-relaxed text-white/85 placeholder-white/25 outline-none resize-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20"
              style={{ fontFamily: 'inherit' }}
            />
            {characterBrief.trim().length === 0 && (
              <p className="mt-1 text-[9px] text-amber-400/60">请填写角色描述</p>
            )}
          </div>

          {/* Consistency locks */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold text-white/40">一致性锁定</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'keepFace' as const, label: '🔒 脸型', value: keepFace, set: setKeepFace },
                { key: 'keepHair' as const, label: '🔒 发型', value: keepHair, set: setKeepHair },
                { key: 'keepOutfit' as const, label: '🔒 服装', value: keepOutfit, set: setKeepOutfit },
                { key: 'keepBody' as const, label: '🔒 体型', value: keepBody, set: setKeepBody },
                { key: 'keepColorScheme' as const, label: '🔒 色彩', value: keepColorScheme, set: setKeepColorScheme },
              ].map(({ key, label, value, set }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { set(!value); setCreated(false) }}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                    value
                      ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/35'
                      : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced options */}
          <div className="shrink-0 px-4 py-2">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between py-1 text-[10px] text-white/30 hover:text-white/50 transition"
            >
              <span>高级选项（风格 / 构图）</span>
              <span>{showAdvanced ? '▲' : '▼'}</span>
            </button>
            {showAdvanced && (
              <div className="mt-2 space-y-2.5 pb-2">
                <div>
                  <label className="mb-1 block text-[9px] font-semibold text-white/30">参考稿风格</label>
                  <select
                    value={style}
                    onChange={(e) => { setStyle(e.target.value as CharacterReferenceStyle); setCreated(false) }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40"
                  >
                    {STYLES.map((s) => (
                      <option key={s.id} value={s.id} style={{ background: '#0f1117' }}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold text-white/30">构图要求</label>
                  <select
                    value={layout}
                    onChange={(e) => { setLayout(e.target.value as CharacterReferenceLayout); setCreated(false) }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40"
                  >
                    {LAYOUTS.map((l) => (
                      <option key={l.id} value={l.id} style={{ background: '#0f1117' }}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-white/6 bg-white/2 px-3 py-2">
                  <p className="text-[8px] font-semibold text-white/25 mb-1">槽位生成说明</p>
                  <p className="text-[8px] leading-relaxed text-white/20">
                    该槽位已绑定来源资产。当前版本会保存来源资产引用与角色一致性指令；正式参考图仍需用户在槽位节点中手动生成。
                    若当前模型暂不支持参考图，则会使用文字一致性约束。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/8 px-4 py-3">
          {created ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-emerald-400 mb-1">
                  {activeMode.nodeCount} 个参考槽位节点已创建 ✓
                </p>
                <p className="text-[10px] leading-relaxed text-white/50">
                  节点已出现在画布中，状态为 idle。
                  {referenceMode === 'asset-reference' ? '来源资产已绑定到各槽位 metadata。' : '已使用文字描述模式。'}
                  请在各节点中选择 Provider 并手动生成参考图。
                </p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="w-full rounded-xl py-2 text-[11px] text-white/40 hover:text-white/60 transition"
              >
                创建另一组参考节点
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate}
              className={`w-full rounded-xl py-2.5 text-[11px] font-semibold transition ${
                canCreate
                  ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                  : 'bg-white/6 text-white/25 cursor-not-allowed'
              }`}
            >
              {!primaryNode
                ? '请从节点顶部资产菜单打开'
                : characterBrief.trim().length === 0
                  ? '请先填写角色描述'
                  : `创建 ${activeMode.nodeCount} 个${activeMode.label}槽位节点`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
