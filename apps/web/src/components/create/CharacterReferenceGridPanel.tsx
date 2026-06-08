'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import {
  buildCharacterReferencePrompts,
  STYLE_LABELS,
  LAYOUT_LABELS,
  type CharacterReferenceMode,
  type CharacterReferenceStyle,
  type CharacterReferenceLayout,
  type CharacterReferenceOptions,
  type CharacterReferencePromptItem,
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
  status?: string | null
}

export interface CreateCharacterReferenceRequest {
  sourceNodeId: string
  mode: CharacterReferenceMode
  items: CharacterReferencePromptItem[]
  metadataJson: Record<string, unknown>
}

interface CharacterReferenceGridPanelProps {
  nodes: CharacterSourceNode[]
  onCreateReferenceNode: (req: CreateCharacterReferenceRequest) => void
  onClose: () => void
  defaultSelectedNodeId?: string
}

// ─── Slot definitions ────────────────────────────────────────────────────────

const TURNAROUND_SLOTS = [
  { key: 'front', label: '正面', sub: 'Front View', icon: '◈', desc: '角色正面全身立绘' },
  { key: '3quarter', label: '四分之三', sub: 'Three-quarter', icon: '◇', desc: '斜侧面角度参考' },
  { key: 'side', label: '侧面', sub: 'Side Profile', icon: '▷', desc: '侧面轮廓与剪影' },
  { key: 'back', label: '背面', sub: 'Back View', icon: '◁', desc: '背面服装与细节' },
]

const GRID5_SLOTS = [
  { key: 'full-front', label: '全身正面', sub: 'Full Body Front', icon: '⊞', desc: '头顶到脚底完整正面' },
  { key: 'full-3q', label: '全身四分之三', sub: 'Full Body 3/4', icon: '⊟', desc: '斜侧全身参考角度' },
  { key: 'expression', label: '表情组', sub: 'Expression Sheet', icon: '◎', desc: '喜 / 中性 / 怒 / 惊四表情' },
  { key: 'outfit', label: '服装细节', sub: 'Outfit Detail', icon: '◉', desc: '服装纹理与道具特写' },
  { key: 'action', label: '动作姿态', sub: 'Action Pose', icon: '◐', desc: '动态姿势与身体轮廓' },
]

const MODES: Array<{
  id: CharacterReferenceMode
  label: string
  sub: string
  nodeCount: number
  description: string
  slots: typeof TURNAROUND_SLOTS
}> = [
  {
    id: 'turnaround4',
    label: '四视图参考板',
    sub: '正面 / 四分之三 / 侧面 / 背面',
    nodeCount: 4,
    description: '适合角色建模、视频一致性、正/侧/背面参考生成。',
    slots: TURNAROUND_SLOTS,
  },
  {
    id: 'grid5',
    label: '九宫格参考板',
    sub: '全身 / 表情 / 服装 / 动作',
    nodeCount: 5,
    description: '适合角色资产库、表情包、服装与动作分镜参考。',
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

  const builtItems = buildCharacterReferencePrompts(opts)
  const canCreate = !!primaryNode && characterBrief.trim().length > 0

  const proxiedImage = primaryNode?.resultImageUrl
    ? getProxiedMediaUrl(primaryNode.resultImageUrl)
    : null
  const proxiedVideo = primaryNode?.resultVideoUrl
    ? getProxiedMediaUrl(primaryNode.resultVideoUrl)
    : null

  function handleCreate() {
    if (!primaryNode || !canCreate) return
    onCreateReferenceNode({
      sourceNodeId: primaryNode.id,
      mode,
      items: builtItems,
      metadataJson: {
        sourceNodeId: primaryNode.id,
        characterReference: {
          type: mode,
          source: 'CharacterReferenceBoard',
          consistencyOptions: { keepFace, keepHair, keepOutfit, keepBody, keepColorScheme },
          style,
          layout,
          nodeCount: builtItems.length,
        },
      },
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
            <p className="text-[13px] font-semibold text-white/90">人物参考板 / Character Reference Board</p>
            <p className="text-[10px] text-white/35">创建四视图或角色参考槽位，供后续逐个生成和保持角色一致性</p>
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

          {/* Source node context */}
          {primaryNode ? (
            <div className="shrink-0 border-b border-white/6 px-4 py-2.5">
              <div className="flex items-start gap-3">
                {proxiedImage && (
                  <img
                    src={proxiedImage}
                    alt="角色来源"
                    className="h-12 w-12 shrink-0 rounded-lg object-cover border border-white/10"
                  />
                )}
                {!proxiedImage && proxiedVideo && (
                  <video
                    src={proxiedVideo}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover border border-white/10"
                    muted
                    playsInline
                    preload="metadata"
                  />
                )}
                {!proxiedImage && !proxiedVideo && (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/4 text-[20px]">
                    👤
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[11px] font-medium text-white/80">
                      {primaryNode.title ?? '未命名节点'}
                    </p>
                    <span className="rounded px-1 py-0.5 text-[9px] bg-white/8 text-white/40">
                      {primaryNode.kind.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[9px] text-white/30">当前角色来源节点</p>
                  <p className="mt-0.5 text-[9px] text-white/20">
                    不会自动生成 · 创建草案槽位后手动逐个生成
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="shrink-0 border-b border-white/6 px-4 py-3">
              <p className="text-[10px] text-amber-400/70">请从画布节点顶部资产菜单打开人物参考板</p>
            </div>
          )}

          {/* Reference board type selector */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold text-white/40">参考板类型</p>
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
                </button>
              ))}
            </div>
            <p className="mt-2 text-[9px] text-white/35 leading-relaxed">{activeMode.description}</p>
          </div>

          {/* Slot preview — primary visual element */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-white/40">参考槽位</p>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-white/30">
                创建 {activeMode.nodeCount} 个独立节点
              </span>
            </div>
            <div className={`grid gap-1.5 ${activeMode.id === 'turnaround4' ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {activeMode.slots.map((slot) => (
                <div
                  key={slot.key}
                  className="flex flex-col rounded-xl border border-white/8 bg-white/3 px-3 py-2.5"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[14px] text-white/40">{slot.icon}</span>
                    <p className="text-[11px] font-semibold text-white/70">{slot.label}</p>
                  </div>
                  <p className="text-[9px] text-white/30 leading-tight">{slot.sub}</p>
                  <p className="mt-1 text-[8.5px] text-white/20 leading-tight">{slot.desc}</p>
                  <div className="mt-2 rounded-md border border-dashed border-white/10 py-1 text-center">
                    <span className="text-[8px] text-white/20">待生成</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[9px] text-white/25 leading-relaxed">
              AI 角色一致性由描述约束控制，可能需要多次生成选择最佳版本。
            </p>
          </div>

          {/* Character brief */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold text-white/40">角色描述 / Character Brief</p>
            <p className="mb-2 text-[9px] text-white/25">
              年龄、性别、发型、脸型、服装、身材、关键道具 — 描述越精确，各槽位生成效果越好。
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
              <p className="mt-1 text-[9px] text-amber-400/60">请填写角色描述，单独风格词无法确保各槽位一致</p>
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

          {/* Advanced options — collapsed by default */}
          <div className="shrink-0 px-4 py-2">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between py-1 text-[10px] text-white/30 hover:text-white/50 transition"
            >
              <span>高级选项（风格 / 构图）</span>
              <span>{showAdvanced ? '▲' : '▼'}</span>
            </button>
            {showAdvanced ? (
              <div className="mt-2 space-y-2.5 pb-2">
                <div>
                  <label className="mb-1 block text-[9px] font-semibold text-white/30">参考稿风格</label>
                  <select
                    value={style}
                    onChange={(e) => { setStyle(e.target.value as CharacterReferenceStyle); setCreated(false) }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40"
                  >
                    {STYLES.map((s) => (
                      <option key={s.id} value={s.id} style={{ background: '#0f1117' }}>
                        {s.label}
                      </option>
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
                      <option key={l.id} value={l.id} style={{ background: '#0f1117' }}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Internal prompts — hidden by default, shown only in advanced */}
                <div>
                  <p className="mb-1 text-[9px] font-semibold text-white/30">内部描述（各槽位生成用，不作为主功能）</p>
                  <div className="space-y-1 max-h-[140px] overflow-y-auto rounded-xl border border-white/6 bg-white/2 p-2">
                    {builtItems.map((item) => (
                      <div key={item.key} className="border-b border-white/5 pb-1 last:border-0 last:pb-0">
                        <p className="text-[9px] font-medium text-white/40 mb-0.5">{item.label}</p>
                        <p className="text-[8px] leading-relaxed text-white/20 break-words">{item.prompt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/8 px-4 py-3">
          {created ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-emerald-400 mb-1">
                  人物参考板已创建 — {activeMode.nodeCount} 个槽位节点 ✓
                </p>
                <p className="text-[10px] leading-relaxed text-white/50">
                  画布中已出现 {activeMode.nodeCount} 个参考槽位节点，状态均为 idle。请进入各槽位节点选择 Provider 后手动生成。
                </p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="w-full rounded-xl py-2 text-[11px] text-white/40 hover:text-white/60 transition"
              >
                创建另一个参考板
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
                  : `创建人物参考板 — ${activeMode.nodeCount} 个槽位节点`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
