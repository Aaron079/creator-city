'use client'

import { useState } from 'react'
import { Copy, Check, X } from 'lucide-react'
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

const MODES: Array<{
  id: CharacterReferenceMode
  label: string
  sublabel: string
  nodeCount: number
  description: string
}> = [
  {
    id: 'turnaround4',
    label: '人物四视图',
    sublabel: '创建 4 个独立 Image 节点',
    nodeCount: 4,
    description: '更适合角色建模、视频一致性和正/侧/背面参考。',
  },
  {
    id: 'grid5',
    label: '人物九宫格',
    sublabel: '创建 5 个核心参考节点',
    nodeCount: 5,
    description: '更适合角色资产库、表情、服装、动作和分镜参考。',
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
  const [sourceText, setSourceText] = useState<string>(
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
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const opts: CharacterReferenceOptions = {
    mode,
    sourcePrompt: sourceText,
    style,
    layout,
    keepFace,
    keepHair,
    keepOutfit,
    keepBody,
    keepColorScheme,
  }

  const builtItems = buildCharacterReferencePrompts(opts)
  // MODES is a non-empty const array; the find will always succeed for valid mode values
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const activeMode = (MODES.find((m) => m.id === mode) ?? MODES[0])!
  const canCreate = !!primaryNode && sourceText.trim().length > 0

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
          source: 'CharacterReferenceGrid',
          consistencyOptions: { keepFace, keepHair, keepOutfit, keepBody, keepColorScheme },
          style,
          layout,
          nodeCount: builtItems.length,
        },
      },
    })
    setCreated(true)
  }

  function handleCopyAll() {
    const all = builtItems.map((item, i) => `[${i + 1}] ${item.label}\n${item.prompt}`).join('\n\n')
    navigator.clipboard.writeText(all).then(() => {
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2200)
    })
  }

  function handleCopyItem(key: string, prompt: string) {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2200)
    })
  }

  function handleReset() {
    setCreated(false)
    setSourceText((primaryNode?.prompt ?? primaryNode?.resultText ?? '').trim())
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
            <p className="text-[13px] font-semibold text-white/90">人物参考 / Character Reference</p>
            <p className="text-[10px] text-white/35">创建多个独立角色参考草案节点，不自动生成，不消耗 credits</p>
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
          {/* Node context */}
          {primaryNode ? (
            <div className="shrink-0 border-b border-white/6 px-4 py-2.5">
              <div className="flex items-start gap-3">
                {proxiedImage && (
                  <img
                    src={proxiedImage}
                    alt="节点预览"
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
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      style={{
                        background: 'linear-gradient(135deg, #f59e0b, #ec4899, #06b6d4)',
                        borderRadius: '50%',
                        width: 6,
                        height: 6,
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    />
                    <p className="truncate text-[11px] font-medium text-white/80">
                      {primaryNode.title ?? primaryNode.id}
                    </p>
                    <span className="rounded px-1 py-0.5 text-[9px] bg-white/8 text-white/40">
                      {primaryNode.kind.toUpperCase()}
                    </span>
                  </div>
                  {(primaryNode.prompt ?? primaryNode.resultText) && (
                    <p className="mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-white/35">
                      {(primaryNode.prompt ?? primaryNode.resultText ?? '').trim().slice(0, 120)}
                    </p>
                  )}
                  <p className="mt-0.5 text-[9px] text-white/25">
                    不会自动生成 · 只创建草案节点 · 请在新节点中逐个手动生成
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="shrink-0 border-b border-white/6 px-4 py-3">
              <p className="text-[10px] text-amber-400/70">请从画布节点顶部资产菜单打开人物参考</p>
            </div>
          )}

          {/* Mode selector */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold text-white/40">输出类型</p>
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
                  <p className="mt-0.5 text-[9px] text-white/40">{m.sublabel}</p>
                </button>
              ))}
            </div>
            {/* Mode description + user expectation */}
            <div className="mt-2 rounded-lg bg-white/3 px-3 py-2 space-y-1">
              <p className="text-[9px] text-white/50">{activeMode.description}</p>
              <p className="text-[9px] text-white/30">
                AI 角色一致性由 prompt 约束控制，可能需要多次生成选择最佳版本。
              </p>
            </div>
          </div>

          {/* Character source textarea */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <p className="mb-1.5 text-[10px] font-semibold text-white/40">角色来源摘要</p>
            <p className="mb-2 text-[9px] text-white/30">
              补充年龄、性别、发型、脸型、服装、身材、关键道具等细节，生成参考越精确效果越好。
            </p>
            <textarea
              value={sourceText}
              onChange={(e) => { setSourceText(e.target.value); setCreated(false) }}
              placeholder="例：20岁亚裔女性，短黑发，穿红色旗袍，身材纤细，手持折扇"
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] leading-relaxed text-white/85 placeholder-white/25 outline-none resize-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20"
              style={{ fontFamily: 'inherit' }}
            />
            {sourceText.trim().length === 0 && (
              <p className="mt-1 text-[9px] text-amber-400/60">请填写角色描述，风格词单独无法生成参考稿</p>
            )}
          </div>

          {/* Consistency options */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold text-white/40">风格一致性</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'keepFace' as const, label: '保持同一脸型', value: keepFace, set: setKeepFace },
                { key: 'keepHair' as const, label: '保持同一发型', value: keepHair, set: setKeepHair },
                { key: 'keepOutfit' as const, label: '保持同一服装', value: keepOutfit, set: setKeepOutfit },
                { key: 'keepBody' as const, label: '保持同一体型', value: keepBody, set: setKeepBody },
                { key: 'keepColorScheme' as const, label: '保持同一色彩', value: keepColorScheme, set: setKeepColorScheme },
              ].map(({ key, label, value, set }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { set(!value); setCreated(false) }}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                    value
                      ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/35'
                      : 'bg-white/5 text-white/35 hover:bg-white/10 hover:text-white/55'
                  }`}
                >
                  {value && <Check size={9} strokeWidth={2.5} />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Style + Layout selectors */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3 space-y-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold text-white/40">参考稿风格</label>
              <select
                value={style}
                onChange={(e) => { setStyle(e.target.value as CharacterReferenceStyle); setCreated(false) }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/80 outline-none focus:border-indigo-500/40"
              >
                {STYLES.map((s) => (
                  <option key={s.id} value={s.id} style={{ background: '#0f1117' }}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold text-white/40">构图要求</label>
              <select
                value={layout}
                onChange={(e) => { setLayout(e.target.value as CharacterReferenceLayout); setCreated(false) }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/80 outline-none focus:border-indigo-500/40"
              >
                {LAYOUTS.map((l) => (
                  <option key={l.id} value={l.id} style={{ background: '#0f1117' }}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Per-view prompt preview */}
          <div className="shrink-0 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-semibold text-white/30">
                各节点 Prompt 预览（{builtItems.length} 个）
              </p>
              <button
                type="button"
                onClick={handleCopyAll}
                className="flex items-center gap-1 text-[9px] text-white/35 hover:text-white/60 transition"
              >
                {copiedAll ? <Check size={9} strokeWidth={2.5} /> : <Copy size={9} strokeWidth={2} />}
                <span>{copiedAll ? '已复制全部' : '复制全部'}</span>
              </button>
            </div>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-0.5">
              {builtItems.map((item) => (
                <div
                  key={item.key}
                  className="group rounded-lg border border-white/6 bg-white/2 px-2.5 py-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[9px] font-medium text-white/55">{item.label}</p>
                    <button
                      type="button"
                      onClick={() => handleCopyItem(item.key, item.prompt)}
                      className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 text-[9px] text-white/35 hover:text-white/60 transition"
                      title="复制此节点 Prompt"
                    >
                      {copiedKey === item.key
                        ? <Check size={9} strokeWidth={2.5} className="text-emerald-400" />
                        : <Copy size={9} strokeWidth={2} />
                      }
                    </button>
                  </div>
                  <p className="text-[8.5px] leading-relaxed text-white/30 line-clamp-2 break-words">
                    {item.prompt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/8 px-4 py-3">
          {created ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-emerald-400 mb-1">
                  已创建 {activeMode.nodeCount} 个人物参考草案节点 ✓
                </p>
                <p className="text-[10px] leading-relaxed text-white/55">
                  新节点已出现在画布中，状态均为 idle。请在各节点中选择 Provider 并逐个手动生成。
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyAll}
                className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-medium transition ${
                  copiedAll
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-white/6 text-white/60 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                {copiedAll ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2} />}
                {copiedAll ? '已复制全部 Prompt' : `复制全部 ${activeMode.nodeCount} 个 Prompt`}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="w-full rounded-xl py-2 text-[11px] text-white/40 hover:text-white/60 transition"
              >
                继续创建其他参考类型
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyAll}
                className={`flex items-center justify-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-[11px] text-white/50 transition hover:bg-white/5 hover:text-white/70 ${
                  copiedAll ? 'text-emerald-400' : ''
                }`}
                title="复制全部 Prompt"
              >
                {copiedAll ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2} />}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canCreate}
                className={`flex-1 rounded-xl py-2.5 text-[11px] font-semibold transition ${
                  canCreate
                    ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                    : 'bg-white/6 text-white/25 cursor-not-allowed'
                }`}
              >
                {!primaryNode
                  ? '请从节点顶部资产菜单打开'
                  : sourceText.trim().length === 0
                    ? '请先填写角色描述'
                    : `创建 ${activeMode.nodeCount} 个人物参考草案节点`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
