'use client'

import { useCallback, useEffect, useState } from 'react'
import type { VisualCanvasNode as CanvasNode } from '@/components/create/CanvasNodeCard'
import type { CharacterBible, CharacterProfile, CharacterReferenceKind } from '@/lib/characters'
import {
  CHARACTER_REFERENCE_KIND_LABELS,
  CHARACTER_REFERENCE_KINDS,
  addReferenceToCharacter,
  bindReferenceToNode,
  createReferenceAsset,
  getNodeReferenceIds,
  removeReferenceFromCharacter,
  resolveNodeCharacterReferences,
  setHeroReference,
  unbindReferenceFromNode,
} from '@/lib/characters'
import { CharacterReferenceCard } from './CharacterReferenceCard'

interface CharacterReferenceBoardProps {
  characterBible: CharacterBible
  currentNode: CanvasNode | null
  selectedCharacterIds: string[]
  onSaveCharacterBible: (bible: CharacterBible) => void
}

type AddDialogState = {
  open: boolean
  characterId: string
  kind: CharacterReferenceKind
  label: string
}

const KIND_FILTER_ALL = '__all__'

const KIND_DISPLAY_ORDER: CharacterReferenceKind[] = [
  'hero',
  'full-body',
  'medium-shot',
  'close-up',
  'extreme-close-up',
  'front',
  'side',
  'back',
  'three-quarter',
  'expression',
  'costume',
  'prop',
  'pose',
  'other',
]

function DropFeedback({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 3000)
    return () => window.clearTimeout(t)
  }, [onDismiss])
  return (
    <div className="fixed bottom-6 left-1/2 z-[99] -translate-x-1/2 rounded-xl border border-cyan-200/30 bg-[#0e1520]/92 px-5 py-3 text-sm font-semibold text-cyan-100 shadow-2xl backdrop-blur-xl">
      {message}
    </div>
  )
}

export function CharacterReferenceBoard({
  characterBible,
  currentNode,
  selectedCharacterIds,
  onSaveCharacterBible,
}: CharacterReferenceBoardProps) {
  const characters = characterBible.characters

  // Selected character for the board (default: first bound character, then first in bible)
  const defaultCharId =
    characters.find((c) => selectedCharacterIds.includes(c.id))?.id ??
    characters[0]?.id ??
    ''
  const [activeCharId, setActiveCharId] = useState(defaultCharId)
  const [kindFilter, setKindFilter] = useState<CharacterReferenceKind | typeof KIND_FILTER_ALL>(KIND_FILTER_ALL)
  const [dropFeedback, setDropFeedback] = useState<string | null>(null)
  const [addDialog, setAddDialog] = useState<AddDialogState>({
    open: false,
    characterId: '',
    kind: 'hero',
    label: '',
  })

  // Sync active char when bible changes (e.g. new char created)
  useEffect(() => {
    if (activeCharId && characters.some((c) => c.id === activeCharId)) return
    const next = characters.find((c) => selectedCharacterIds.includes(c.id))?.id ?? characters[0]?.id ?? ''
    setActiveCharId(next)
  }, [activeCharId, characters, selectedCharacterIds])

  const activeChar: CharacterProfile | null = characters.find((c) => c.id === activeCharId) ?? null
  const referencePack = activeChar?.referencePack ?? []
  const filtered = kindFilter === KIND_FILTER_ALL
    ? referencePack
    : referencePack.filter((ref) => ref.kind === kindFilter)

  const currentNodeId = currentNode?.id ?? ''
  const currentNodeBoundIds = new Set(getNodeReferenceIds(characterBible, currentNodeId))
  const currentNodeReferences = currentNodeId ? resolveNodeCharacterReferences(characterBible, currentNodeId) : []

  const currentNodeImageUrl = (currentNode?.kind === 'image' || currentNode?.kind === 'video')
    ? currentNode.resultImageUrl
    : undefined

  // Listen for drop events from CanvasNodeCard
  const handleNodeDrop = useCallback((event: Event) => {
    const customEvent = event as CustomEvent<{
      nodeId: string
      referenceId: string
      characterId: string
      imageUrl: string
      kind: string
      label: string
    }>
    const { nodeId, referenceId, label } = customEvent.detail
    const nextBible = bindReferenceToNode(characterBible, nodeId, referenceId)
    onSaveCharacterBible(nextBible)
    setDropFeedback(`已绑定角色参考：${label || referenceId.slice(0, 8)}`)
  }, [characterBible, onSaveCharacterBible])

  useEffect(() => {
    window.addEventListener('creator-city:char-ref-drop', handleNodeDrop)
    return () => window.removeEventListener('creator-city:char-ref-drop', handleNodeDrop)
  }, [handleNodeDrop])

  function openAddDialog() {
    setAddDialog({
      open: true,
      characterId: activeCharId,
      kind: 'hero',
      label: CHARACTER_REFERENCE_KIND_LABELS['hero'],
    })
  }

  function saveAddDialog() {
    if (!addDialog.characterId || !currentNodeImageUrl) return
    const asset = createReferenceAsset({
      characterId: addDialog.characterId,
      kind: addDialog.kind,
      label: addDialog.label || CHARACTER_REFERENCE_KIND_LABELS[addDialog.kind],
      imageUrl: currentNodeImageUrl,
      sourceNodeId: currentNode?.id,
      isHero: addDialog.kind === 'hero',
    })
    let nextBible = addReferenceToCharacter(characterBible, addDialog.characterId, asset)
    // If adding as hero, set it as hero
    if (addDialog.kind === 'hero') {
      nextBible = setHeroReference(nextBible, addDialog.characterId, asset.id)
    }
    onSaveCharacterBible(nextBible)
    setActiveCharId(addDialog.characterId)
    setAddDialog((prev) => ({ ...prev, open: false }))
  }

  function handleDeleteRef(characterId: string, referenceId: string) {
    const nextBible = removeReferenceFromCharacter(characterBible, characterId, referenceId)
    onSaveCharacterBible(nextBible)
  }

  function handleSetHero(characterId: string, referenceId: string) {
    const nextBible = setHeroReference(characterBible, characterId, referenceId)
    onSaveCharacterBible(nextBible)
  }

  function handleBindToNode(characterId: string, referenceId: string, label: string) {
    if (!currentNodeId) return
    const nextBible = bindReferenceToNode(characterBible, currentNodeId, referenceId)
    onSaveCharacterBible(nextBible)
    setDropFeedback(`已绑定到当前节点：${label}`)
  }

  function handleUnbindFromNode(referenceId: string) {
    if (!currentNodeId) return
    const nextBible = unbindReferenceFromNode(characterBible, currentNodeId, referenceId)
    onSaveCharacterBible(nextBible)
  }

  // ─── Empty state: no characters ────────────────────────────────────────────
  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/14 bg-white/[0.025] px-8 py-14 text-center">
        <div className="text-3xl">🎭</div>
        <h3 className="mt-4 text-base font-semibold text-white/82">还没有角色</h3>
        <p className="mt-2 max-w-xs text-sm text-white/42">
          请先在「角色」标签中新建角色，然后回到这里为角色加入视觉参考图。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {dropFeedback ? (
        <DropFeedback message={dropFeedback} onDismiss={() => setDropFeedback(null)} />
      ) : null}

      {/* Character selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {characters.map((character) => (
          <button
            key={character.id}
            type="button"
            onClick={() => setActiveCharId(character.id)}
            className={[
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
              activeCharId === character.id
                ? 'border-cyan-200/50 bg-cyan-200/14 text-cyan-50'
                : 'border-white/12 bg-white/[0.04] text-white/55 hover:border-white/24 hover:text-white/80',
              selectedCharacterIds.includes(character.id)
                ? 'ring-1 ring-cyan-200/25'
                : '',
            ].join(' ')}
          >
            {character.name}
            {selectedCharacterIds.includes(character.id) ? (
              <span className="ml-1.5 text-[9px] text-cyan-200/60">已绑定</span>
            ) : null}
          </button>
        ))}
      </div>

      {activeChar ? (
        <>
          {/* Add reference CTA */}
          {currentNodeImageUrl ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3">
              <div
                className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/12 bg-black/30"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentNodeImageUrl}
                  alt="当前图片"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white/70">当前 Image 节点有可用图片</p>
                <p className="mt-0.5 text-xs text-white/40">可以把这张图加入 {activeChar.name} 的参考包</p>
              </div>
              <button
                type="button"
                onClick={openAddDialog}
                className="shrink-0 rounded-lg bg-cyan-100 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-white"
              >
                加入参考
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-white/35">
              请先在 Image 节点中生成图片，然后可以把生成结果加入角色参考包。
            </div>
          )}

          {/* Current node binding summary */}
          {currentNodeId && currentNodeReferences.length > 0 ? (
            <div className="rounded-xl border border-cyan-200/18 bg-cyan-200/[0.05] px-4 py-3">
              <p className="text-xs font-semibold text-cyan-100/70">
                当前节点已绑定 {currentNodeReferences.length} 张角色参考图
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {currentNodeReferences.map((ref) => (
                  <div key={ref.id} className="flex items-center gap-2 rounded-lg border border-cyan-200/20 bg-cyan-200/10 px-2 py-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ref.imageUrl} alt={ref.label} className="h-6 w-6 rounded object-cover" />
                    <span className="text-[11px] font-semibold text-cyan-50/82">{ref.label}</span>
                    <button
                      type="button"
                      onClick={() => handleUnbindFromNode(ref.id)}
                      className="text-[10px] text-cyan-100/40 hover:text-red-100/70"
                      title="解除绑定"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Kind filter */}
          {referencePack.length > 0 ? (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setKindFilter(KIND_FILTER_ALL)}
                className={[
                  'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition',
                  kindFilter === KIND_FILTER_ALL
                    ? 'border-white/30 bg-white/12 text-white'
                    : 'border-white/10 text-white/45 hover:border-white/20 hover:text-white/70',
                ].join(' ')}
              >
                全部 {referencePack.length}
              </button>
              {KIND_DISPLAY_ORDER.filter((k) => referencePack.some((ref) => ref.kind === k)).map((kind) => {
                const count = referencePack.filter((ref) => ref.kind === kind).length
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setKindFilter(kind)}
                    className={[
                      'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition',
                      kindFilter === kind
                        ? 'border-cyan-200/40 bg-cyan-200/14 text-cyan-50'
                        : 'border-white/10 text-white/45 hover:border-white/20 hover:text-white/70',
                    ].join(' ')}
                  >
                    {CHARACTER_REFERENCE_KIND_LABELS[kind]} {count}
                  </button>
                )
              })}
            </div>
          ) : null}

          {/* Reference grid */}
          {filtered.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((ref) => (
                <CharacterReferenceCard
                  key={ref.id}
                  asset={ref}
                  characterName={activeChar.name}
                  isBoundToCurrentNode={currentNodeBoundIds.has(ref.id)}
                  onSetHero={() => handleSetHero(activeChar.id, ref.id)}
                  onBindToNode={() => handleBindToNode(activeChar.id, ref.id, ref.label)}
                  onUnbindFromNode={() => handleUnbindFromNode(ref.id)}
                  onDelete={() => handleDeleteRef(activeChar.id, ref.id)}
                  onCopyLink={() => {}} // handled inside card
                />
              ))}
            </div>
          ) : referencePack.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.025] px-8 py-12 text-center">
              <div className="text-3xl">🖼</div>
              <h3 className="mt-4 text-sm font-semibold text-white/70">{activeChar.name} 还没有参考图</h3>
              <p className="mt-2 text-xs text-white/40">
                在 Image 节点中生成一张满意的图片，然后点击「加入参考」加入参考包。
              </p>
              {currentNodeImageUrl ? (
                <button
                  type="button"
                  onClick={openAddDialog}
                  className="mt-5 rounded-xl bg-cyan-100 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-white"
                >
                  + 加入当前图片为主参考
                </button>
              ) : null}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-white/40">
              该分类下暂无参考图
            </div>
          )}

          {/* Drag hint */}
          {referencePack.length > 0 ? (
            <p className="text-center text-[11px] text-white/28">
              拖拽参考图卡片到画布节点可绑定角色参考 · 拖拽到空白画布区域可在下一版本创建新节点
            </p>
          ) : null}
        </>
      ) : null}

      {/* Add reference dialog */}
      {addDialog.open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/14 bg-[#0e1520]/96 p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-white">加入角色参考图</h3>
            <p className="mt-1 text-xs text-white/42">将当前 Image 节点的图片加入角色参考包</p>

            {/* Character selector inside dialog (if needed) */}
            {characters.length > 1 ? (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold text-white/55">角色</div>
                <div className="flex flex-wrap gap-1.5">
                  {characters.map((character) => (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => setAddDialog((prev) => ({ ...prev, characterId: character.id }))}
                      className={[
                        'rounded-full border px-2.5 py-1 text-xs font-semibold transition',
                        addDialog.characterId === character.id
                          ? 'border-cyan-200/50 bg-cyan-200/14 text-cyan-50'
                          : 'border-white/12 bg-white/[0.04] text-white/55 hover:border-white/24',
                      ].join(' ')}
                    >
                      {character.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Kind picker */}
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold text-white/55">参考类型</div>
              <div className="grid grid-cols-4 gap-1.5">
                {CHARACTER_REFERENCE_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setAddDialog((prev) => ({
                      ...prev,
                      kind,
                      label: CHARACTER_REFERENCE_KIND_LABELS[kind],
                    }))}
                    className={[
                      'rounded-lg border px-1 py-1.5 text-[11px] font-semibold transition',
                      addDialog.kind === kind
                        ? 'border-cyan-200/50 bg-cyan-200/14 text-cyan-50'
                        : 'border-white/10 bg-white/[0.04] text-white/50 hover:border-white/20 hover:text-white/75',
                    ].join(' ')}
                  >
                    {CHARACTER_REFERENCE_KIND_LABELS[kind]}
                  </button>
                ))}
              </div>
            </div>

            {/* Label input */}
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold text-white/55">标签（可选）</div>
              <input
                value={addDialog.label}
                onChange={(e) => setAddDialog((prev) => ({ ...prev, label: e.target.value }))}
                placeholder={CHARACTER_REFERENCE_KIND_LABELS[addDialog.kind]}
                className="h-9 w-full rounded-md border border-white/16 bg-white/[0.06] px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-200/50"
              />
            </div>

            {/* Preview */}
            {currentNodeImageUrl ? (
              <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentNodeImageUrl}
                  alt="preview"
                  className="h-32 w-full object-cover"
                />
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddDialog((prev) => ({ ...prev, open: false }))}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveAddDialog}
                disabled={!addDialog.characterId || !currentNodeImageUrl}
                className="rounded-lg bg-cyan-100 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                加入参考包
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
