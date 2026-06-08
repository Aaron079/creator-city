'use client'

import { useState } from 'react'
import { Copy, Check, X } from 'lucide-react'
import {
  buildCharacterReferencePrompt,
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

const MODES: Array<{ id: CharacterReferenceMode; label: string; sublabel: string }> = [
  { id: 'turnaround4', label: '人物四视图', sublabel: '正面 · 侧面 · 背面 · 四分之三侧' },
  { id: 'grid9', label: '人物九宫格', sublabel: '面部 · 全身 · 表情 · 服装 · 动作' },
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
  const [copied, setCopied] = useState(false)

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

  const builtPrompt = buildCharacterReferencePrompt(opts)

  const canCreate = !!primaryNode && sourceText.trim().length > 0

  const proxiedImage = primaryNode?.resultImageUrl
    ? getProxiedMediaUrl(primaryNode.resultImageUrl)
    : null
  const proxiedVideo = primaryNode?.resultVideoUrl
    ? getProxiedMediaUrl(primaryNode.resultVideoUrl)
    : null

  function handleCreate() {
    if (!primaryNode || !canCreate) return
    const modeLabel = mode === 'turnaround4' ? '人物四视图' : '人物九宫格'
    const sourceTitle = primaryNode.title?.trim()
    const title = sourceTitle ? `${modeLabel} · ${sourceTitle}` : modeLabel
    onCreateReferenceNode({
      sourceNodeId: primaryNode.id,
      mode,
      prompt: builtPrompt,
      metadataJson: {
        sourceNodeId: primaryNode.id,
        characterReference: {
          type: mode,
          source: 'CharacterReferenceGrid',
          title,
          consistencyOptions: { keepFace, keepHair, keepOutfit, keepBody, keepColorScheme },
          style,
          layout,
          previewOnly: false,
        },
      },
    })
    setCreated(true)
  }

  function handleCopyPrompt() {
    navigator.clipboard.writeText(builtPrompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
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
        className="flex w-[440px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/97 shadow-2xl backdrop-blur-xl"
        style={{ maxHeight: 'calc(100vh - 48px)' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-white/90">人物参考 / Character Reference</p>
            <p className="text-[10px] text-white/35">创建角色四视图或九宫格草案节点，用于角色一致性和后续生成参考</p>
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
                {/* Media preview */}
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
                    不会自动生成 · 只创建草案节点 · 用户在新节点中手动生成
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="shrink-0 border-b border-white/6 px-4 py-3">
              <p className="text-[10px] text-amber-400/70">请从画布节点顶部&ldquo;资产&rdquo;菜单打开人物参考</p>
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
                  <p className="mt-0.5 text-[9px] text-white/35">{m.sublabel}</p>
                </button>
              ))}
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

          {/* Prompt preview */}
          <div className="shrink-0 px-4 py-3">
            <p className="mb-1.5 text-[9px] font-semibold text-white/30">生成 Prompt 预览（只读）</p>
            <div className="rounded-xl border border-white/6 bg-white/2 px-3 py-2.5 max-h-[80px] overflow-y-auto">
              <p className="text-[9px] leading-relaxed text-white/40 whitespace-pre-wrap break-words">{builtPrompt}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/8 px-4 py-3">
          {created ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-emerald-400 mb-1">已创建人物参考草案节点 ✓</p>
                <p className="text-[10px] leading-relaxed text-white/55">
                  新节点已出现在画布中，状态为 idle。请在新节点中选择 Provider 并手动点击生成。
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-medium transition ${
                  copied
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-white/6 text-white/60 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2} />}
                {copied ? '已复制参考 Prompt' : '复制参考 Prompt'}
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
                onClick={handleCopyPrompt}
                className={`flex items-center justify-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-[11px] text-white/50 transition hover:bg-white/5 hover:text-white/70 ${
                  copied ? 'text-emerald-400' : ''
                }`}
                title="复制参考 Prompt"
              >
                {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2} />}
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
                    : '创建人物参考节点'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
