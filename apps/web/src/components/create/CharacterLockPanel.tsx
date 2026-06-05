'use client'

import { useCallback, useMemo, useState } from 'react'
import { Copy, Play, Trash2, UserRound, X } from 'lucide-react'
import {
  addReferenceToCharacter,
  createCharacterProfile,
  createReferenceAsset,
  deleteCharacterProfile,
  getHeroReference,
  type CharacterBible,
  type CharacterProfile,
} from '@/lib/characters'
import {
  buildCharacterPromptAppend,
  generateCharacterDescription,
} from '@/lib/canvas/character-lock'
import { parseAssetIntelligence } from '@/lib/canvas/asset-variant-planner'
import type { VisualCanvasNode } from '@/components/create/CanvasNodeCard'

interface CharacterLockPanelProps {
  node: VisualCanvasNode | null
  characterBible: CharacterBible
  canInsert: boolean
  onInsert: (text: string) => void
  onSaveBible: (bible: CharacterBible) => void
  onClose: () => void
}

// ─── copy hook ────────────────────────────────────────────────────────────────

function useCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000)
    } catch {
      // clipboard unavailable — silent fail
    }
  }, [])
  return { copiedId, copy }
}

// ─── node summary ─────────────────────────────────────────────────────────────

function NodeSummary({ node }: { node: VisualCanvasNode }) {
  const hasImage = Boolean(node.resultImageUrl)
  const hasAsset = Boolean(
    node.assetId ||
    hasImage ||
    (node.metadataJson &&
      typeof node.metadataJson === 'object' &&
      !Array.isArray(node.metadataJson) &&
      ((node.metadataJson as Record<string, unknown>).assetId)),
  )
  const displayPrompt = (node.prompt ?? '').trim().slice(0, 80)

  return (
    <div className="border-b border-white/[0.07] px-4 py-3">
      <div className="flex gap-3">
        {hasImage && (
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={node.resultImageUrl!}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}
        {!hasImage && node.resultVideoUrl && (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
            <Play size={16} className="text-white/30" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
              {node.kind === 'image' ? '图片节点' : node.kind === 'video' ? '视频节点' : '文本节点'}
            </span>
            {hasAsset && (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                已有资产
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[12px] font-medium text-white/75">
            {node.title || '未命名节点'}
          </p>
          {displayPrompt ? (
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-white/40">
              {displayPrompt}{(node.prompt ?? '').trim().length > 80 ? '…' : ''}
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] text-white/25">暂无 Prompt</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── character card ───────────────────────────────────────────────────────────

function CharacterCard({
  character,
  canInsert,
  copiedId,
  onAppend,
  onCopy,
  onDelete,
}: {
  character: CharacterProfile
  canInsert: boolean
  copiedId: string | null
  onAppend: (character: CharacterProfile) => void
  onCopy: (id: string, text: string) => void
  onDelete: (characterId: string) => void
}) {
  const hero = getHeroReference(character)
  const hasAssetRef = Boolean(hero?.imageUrl)
  const descPreview = (character.appearance ?? '').trim().slice(0, 80)
  const isCopied = copiedId === character.id

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
      <div className="flex gap-2.5">
        {/* Thumbnail */}
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
          {hero?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero.imageUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <UserRound size={18} className="text-white/20" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold leading-tight text-white/85">
            {character.name}
          </p>
          {character.referenceKeywords?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {character.referenceKeywords.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-white/40"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {hero?.sourceNodeId && (
            <p className="mt-0.5 truncate text-[9px] text-white/25">
              来源：{hero.sourceNodeId.slice(0, 12)}...
            </p>
          )}
        </div>
      </div>

      {/* Description preview */}
      {descPreview ? (
        <div className="mt-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1.5">
          <p className="line-clamp-2 font-mono text-[10px] leading-relaxed text-white/40">
            {descPreview}{(character.appearance ?? '').trim().length > 80 ? '…' : ''}
          </p>
        </div>
      ) : null}

      {/* Asset protection notice */}
      {hasAssetRef ? (
        <p className="mt-1.5 text-[9px] leading-relaxed text-white/25">
          此角色卡引用已生成资产。删除角色卡不会删除资产，也不会影响原节点。
        </p>
      ) : null}

      {/* Actions */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={!canInsert}
          title={!canInsert ? '打开节点对话框后可追加' : undefined}
          onClick={() => onAppend(character)}
          className="inline-flex h-6 items-center rounded-md border border-violet-500/25 bg-violet-500/[0.07] px-2 text-[10px] font-medium text-violet-300/80 transition hover:bg-violet-500/[0.14] disabled:cursor-not-allowed disabled:opacity-30"
        >
          追加到 Prompt
        </button>
        <button
          type="button"
          onClick={() => {
            void onCopy(character.id, character.appearance ?? character.name)
          }}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-2 text-[10px] font-medium text-white/55 transition hover:border-white/20 hover:text-white/80"
        >
          <Copy size={9} />
          {isCopied ? '已复制' : '复制描述'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(character.id)}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-red-500/20 bg-red-500/[0.05] px-2 text-[10px] font-medium text-red-400/70 transition hover:bg-red-500/[0.12]"
        >
          <Trash2 size={9} />
          删除
        </button>
      </div>
    </div>
  )
}

// ─── register form ────────────────────────────────────────────────────────────

function RegisterForm({
  node,
  onSave,
  onCancel,
}: {
  node: VisualCanvasNode
  onSave: (name: string, description: string, tags: string[]) => void
  onCancel: () => void
}) {
  const hasImage = Boolean(node.resultImageUrl)
  const hasAsset = Boolean(node.assetId || hasImage)
  const assetIntelligence = parseAssetIntelligence(node.metadataJson)
  const defaultDescription = useMemo(
    () => generateCharacterDescription(node.prompt ?? '', assetIntelligence),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.id],
  )

  const [name, setName] = useState(node.title || '新角色')
  const [description, setDescription] = useState(defaultDescription)
  const [tagsRaw, setTagsRaw] = useState('')

  const handleSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    onSave(trimmedName, description.trim(), tags)
  }

  return (
    <div className="space-y-3 px-4 py-3">
      {!hasAsset && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2">
          <p className="text-[10px] leading-relaxed text-amber-400/80">
            当前还没有生成图片资产。建议先生成角色参考图后再注册，草案仅基于 Prompt。
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
          角色名
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/85 outline-none placeholder:text-white/25 focus:border-violet-500/40"
          placeholder="角色名称"
          maxLength={50}
        />
      </div>

      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
          角色描述词
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[10px] leading-relaxed text-white/75 outline-none placeholder:text-white/25 focus:border-violet-500/40"
          placeholder="角色外貌、服装、气质描述..."
        />
        <p className="mt-0.5 text-[9px] text-white/25">可直接编辑，追加到其他节点 Prompt 时使用此描述。</p>
      </div>

      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
          标签（逗号分隔）
        </label>
        <input
          type="text"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/85 outline-none placeholder:text-white/25 focus:border-violet-500/40"
          placeholder="主角, 女性, 现代, ..."
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim()}
          className="flex-1 rounded-lg border border-violet-500/30 bg-violet-500/[0.1] py-1.5 text-[11px] font-semibold text-violet-300/90 transition hover:bg-violet-500/[0.18] disabled:cursor-not-allowed disabled:opacity-40"
        >
          保存角色卡
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/45 transition hover:text-white/70"
        >
          取消
        </button>
      </div>
    </div>
  )
}

// ─── main panel ───────────────────────────────────────────────────────────────

export function CharacterLockPanel({
  node,
  characterBible,
  canInsert,
  onInsert,
  onSaveBible,
  onClose,
}: CharacterLockPanelProps) {
  const { copiedId, copy } = useCopy()
  const [isRegistering, setIsRegistering] = useState(false)

  const characters = characterBible.characters

  const handleRegisterSave = (name: string, description: string, tags: string[]) => {
    const profile = createCharacterProfile({ name, appearance: description, referenceKeywords: tags.length ? tags : undefined })
    let nextBible = { ...characterBible, characters: [...characterBible.characters, profile] }

    // Attach hero reference asset if image is available
    if (node?.resultImageUrl) {
      const refAsset = createReferenceAsset({
        characterId: profile.id,
        kind: 'hero',
        label: '主参考',
        imageUrl: node.resultImageUrl,
        sourceNodeId: node.id,
        sourcePrompt: node.prompt ?? undefined,
        isHero: true,
      })
      nextBible = addReferenceToCharacter(nextBible, profile.id, refAsset)
    }

    onSaveBible(nextBible)
    setIsRegistering(false)
  }

  const handleDelete = (characterId: string) => {
    const nextBible = deleteCharacterProfile(characterBible, characterId)
    onSaveBible(nextBible)
  }

  const handleAppend = (character: CharacterProfile) => {
    const hero = getHeroReference(character)
    const sourceId = hero?.sourceNodeId ?? node?.id ?? ''
    const text = buildCharacterPromptAppend(character.name, sourceId, character.appearance ?? character.name)
    onInsert(text)
  }

  const isImageNode = node?.kind === 'image'
  const isTextNode = node?.kind === 'text'

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] flex max-h-[88vh] w-[360px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/96 shadow-2xl backdrop-blur-xl"
      data-no-node-drag="true"
      data-smart-toolbar-panel="true"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/[0.07] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
            Canvas Smart Tools · Tool 4
          </p>
          <h2 className="mt-1 text-sm font-semibold text-white/90">角色锁定</h2>
          <p className="mt-0.5 text-[11px] text-white/40">
            {node ? (node.title || '未命名节点') : '未选中节点'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-3 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white/80"
          aria-label="关闭角色锁定"
        >
          <X size={13} />
        </button>
      </div>

      {/* Sub-header notice */}
      <div className="border-b border-white/[0.07] px-4 py-2">
        <p className="text-[10px] leading-relaxed text-white/30">
          把当前图片资产注册为角色卡，并在后续图片/视频节点中复用。工具不会自动生成，也不会消耗 credits。
        </p>
      </div>

      {/* No node selected */}
      {!node ? (
        <div className="flex-1 px-5 py-8 text-center">
          <UserRound size={28} className="mx-auto mb-3 text-white/15" />
          <p className="text-sm font-medium text-white/40">请先选择一个节点</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/25">
            选择 image 节点可注册为角色卡，选择 image/video 节点可绑定已有角色卡并追加描述到 Prompt。
          </p>
        </div>
      ) : (
        <>
          {/* Node summary */}
          <NodeSummary node={node} />

          {/* Text node banner */}
          {isTextNode && (
            <div className="border-b border-amber-500/15 bg-amber-500/[0.05] px-4 py-2.5">
              <p className="text-[11px] leading-relaxed text-amber-400/70">
                角色锁定主要用于图片/视频节点。文本节点可先生成角色图，再注册为角色卡。
              </p>
            </div>
          )}

          {/* Registration form */}
          {isRegistering && isImageNode ? (
            <div className="flex-1 overflow-y-auto">
              <div className="border-b border-white/[0.07] px-4 py-2">
                <p className="text-[11px] font-semibold text-white/60">注册角色卡</p>
              </div>
              <RegisterForm
                node={node}
                onSave={handleRegisterSave}
                onCancel={() => setIsRegistering(false)}
              />
            </div>
          ) : (
            <>
              {/* Character card list */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {characters.length === 0 ? (
                  <div className="py-6 text-center">
                    <UserRound size={24} className="mx-auto mb-2 text-white/15" />
                    <p className="text-[11px] text-white/35">暂无角色卡</p>
                    <p className="mt-1 text-[10px] text-white/20">
                      选择一个已生成的图片节点，点击下方&ldquo;注册角色卡&rdquo;按钮创建第一张角色卡。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {characters.map((character) => (
                      <CharacterCard
                        key={character.id}
                        character={character}
                        canInsert={canInsert}
                        copiedId={copiedId}
                        onAppend={handleAppend}
                        onCopy={copy}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom action area */}
              <div className="border-t border-white/[0.07] px-4 py-3">
                {isImageNode ? (
                  <button
                    type="button"
                    onClick={() => setIsRegistering(true)}
                    className="w-full rounded-xl border border-violet-500/25 bg-violet-500/[0.07] py-2 text-[12px] font-semibold text-violet-300/80 transition hover:bg-violet-500/[0.14]"
                  >
                    + 注册当前图片为角色卡
                  </button>
                ) : isTextNode ? (
                  <p className="text-center text-[10px] text-white/25">
                    请先在图片节点生成角色参考图，再注册为角色卡。
                  </p>
                ) : (
                  /* video node */
                  <p className="text-center text-[10px] text-white/30">
                    选择上方角色卡，点击&ldquo;追加到 Prompt&rdquo;将角色描述插入当前视频节点。
                  </p>
                )}
                <p className="mt-2 text-center text-[9px] leading-relaxed text-white/20">
                  角色卡保存在本地浏览器，不跨设备同步。删除角色卡不会删除已生成资产。
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
