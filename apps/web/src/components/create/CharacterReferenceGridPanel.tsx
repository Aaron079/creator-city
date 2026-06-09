'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import {
  buildBoardPrompt,
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
  status?: string | null
}

export interface CreateCharacterReferenceRequest {
  sourceNodeId: string
  mode: CharacterReferenceMode
  prompt: string
  metadataJson: Record<string, unknown>
}

interface CharacterReferenceGridPanelProps {
  nodes: CharacterSourceNode[]
  onCreateReferenceNode: (req: CreateCharacterReferenceRequest) => void
  onClose: () => void
  defaultSelectedNodeId?: string
}

// ─── Slot definitions (used as expected-output wireframe preview) ─────────────

const TURNAROUND_SLOTS = [
  { key: 'front',    label: '正面',      sub: 'Front',     icon: '◈' },
  { key: '3quarter', label: '四分之三',  sub: 'Three-qtr', icon: '◇' },
  { key: 'side',     label: '侧面',      sub: 'Side',      icon: '▷' },
  { key: 'back',     label: '背面',      sub: 'Back',      icon: '◁' },
]

const GRID5_SLOTS = [
  { key: 'full-front', label: '全身正面',   sub: 'Full Front',    icon: '⊞' },
  { key: 'full-3q',    label: '全身四分之三', sub: 'Full 3/4',      icon: '⊟' },
  { key: 'expression', label: '表情组',     sub: 'Expressions',   icon: '◎' },
  { key: 'outfit',     label: '服装细节',   sub: 'Outfit Detail', icon: '◉' },
  { key: 'action',     label: '动作姿态',   sub: 'Action Pose',   icon: '◐' },
]

const MODES: Array<{
  id: CharacterReferenceMode
  label: string
  sub: string
  description: string
  gridLabel: string
  slots: typeof TURNAROUND_SLOTS
}> = [
  {
    id: 'turnaround4',
    label: '四视图参考板',
    sub: '正面 / 四分之三 / 侧面 / 背面',
    description: '生成一张包含四个角度的角色转面参考图。适合角色建模、视频一致性参考。',
    gridLabel: '2×2 视图布局（单张合成图）',
    slots: TURNAROUND_SLOTS,
  },
  {
    id: 'grid5',
    label: '九宫格参考板',
    sub: '全身 / 表情 / 服装 / 动作',
    description: '生成一张包含五个参考面板的角色资产图。适合表情包、服装与分镜参考。',
    gridLabel: '5 格参考布局（单张合成图）',
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

  const boardPrompt = buildBoardPrompt(opts)
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
      prompt: boardPrompt,
      metadataJson: {
        sourceNodeId: primaryNode.id,
        characterReference: {
          boardType: mode,
          source: 'CharacterReferenceBoard',
          consistencyOptions: { keepFace, keepHair, keepOutfit, keepBody, keepColorScheme },
          style,
          layout,
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
            <p className="text-[10px] text-white/35">创建合成参考板节点，生成一张包含多角度的角色参考图</p>
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

          {/* Source node */}
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
                    muted playsInline preload="metadata"
                  />
                )}
                {!proxiedImage && !proxiedVideo && (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/4 text-xl">
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
                  <p className="mt-0.5 text-[9px] text-white/25">
                    创建 1 个合成参考板节点 · 手动生成后得到完整参考图
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="shrink-0 border-b border-white/6 px-4 py-3">
              <p className="text-[10px] text-amber-400/70">请从画布节点顶部资产菜单打开人物参考板</p>
            </div>
          )}

          {/* Board type selector */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold text-white/40">参考板类型</p>
            <div className="flex gap-2 mb-2">
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
            <p className="text-[9px] text-white/35 leading-relaxed">{activeMode.description}</p>
          </div>

          {/* Slot preview — wireframe of expected output layout */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-white/40">期望输出布局</p>
              <span className="rounded-full border border-white/8 px-2 py-0.5 text-[9px] text-white/25">
                {activeMode.gridLabel}
              </span>
            </div>
            {/* Source image composite mockup (if available) */}
            {proxiedImage ? (
              <div className={`grid gap-1 mb-2 ${activeMode.id === 'turnaround4' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {activeMode.slots.map((slot) => (
                  <div
                    key={slot.key}
                    className="relative overflow-hidden rounded-lg border border-white/10"
                    style={{ aspectRatio: '1/1' }}
                  >
                    <img
                      src={proxiedImage}
                      alt={slot.label}
                      className="absolute inset-0 h-full w-full object-cover opacity-35"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-semibold text-white/80">{slot.label}</span>
                      <span className="text-[8px] text-white/40">{slot.sub}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`grid gap-1 mb-2 ${activeMode.id === 'turnaround4' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {activeMode.slots.map((slot) => (
                  <div
                    key={slot.key}
                    className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/2 py-3"
                    style={{ aspectRatio: '1/1' }}
                  >
                    <span className="text-[16px] text-white/20">{slot.icon}</span>
                    <span className="mt-1 text-[10px] font-medium text-white/45">{slot.label}</span>
                    <span className="text-[8px] text-white/20">{slot.sub}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[9px] text-white/25 leading-relaxed">
              以上为生成后的期望布局。生成完成后，一张图中将包含上述所有角度。
            </p>
          </div>

          {/* Character brief */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold text-white/40">角色描述 / Character Brief</p>
            <p className="mb-2 text-[9px] text-white/25">
              填写年龄、性别、发型、脸型、服装、身材等细节，描述越精确参考图越准确。
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
              <p className="mt-1 text-[9px] text-amber-400/60">请填写角色描述，风格词单独无法确保各视图一致</p>
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
              <span>高级选项（风格 / 构图 / 内部描述）</span>
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
                <div>
                  <p className="mb-1 text-[9px] font-semibold text-white/30">内部合成描述（只读）</p>
                  <div className="rounded-xl border border-white/6 bg-white/2 px-3 py-2 max-h-[80px] overflow-y-auto">
                    <p className="text-[8px] leading-relaxed text-white/25 break-words">{boardPrompt}</p>
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
                <p className="text-[11px] font-semibold text-emerald-400 mb-1">人物参考板节点已创建 ✓</p>
                <p className="text-[10px] leading-relaxed text-white/50">
                  参考板节点已出现在画布中，状态为 idle。在节点中选择 Provider 后点击生成，即可得到包含{activeMode.slots.length}个视角的合成参考图。
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
                  : `创建${activeMode.label}节点`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
