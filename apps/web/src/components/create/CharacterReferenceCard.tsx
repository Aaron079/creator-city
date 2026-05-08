'use client'

import { useRef, useState } from 'react'
import type { CharacterReferenceAsset } from '@/lib/characters'
import { CHARACTER_REFERENCE_KIND_LABELS } from '@/lib/characters'

export type CharacterReferenceDragPayload = {
  type: 'creator-city/character-reference'
  referenceId: string
  characterId: string
  imageUrl: string
  kind: string
  label: string
}

const DRAG_MIME = 'application/x-creator-city-charref'

interface CharacterReferenceCardProps {
  asset: CharacterReferenceAsset
  characterName: string
  isSelected?: boolean
  currentNodeId?: string
  isBoundToCurrentNode?: boolean
  onClick?: () => void
  onSetHero: () => void
  onBindToNode: () => void
  onUnbindFromNode?: () => void
  onDelete: () => void
  onCopyLink: () => void
}

export function CharacterReferenceCard({
  asset,
  characterName: _characterName,
  isSelected,
  isBoundToCurrentNode,
  onClick,
  onSetHero,
  onBindToNode,
  onUnbindFromNode,
  onDelete,
  onCopyLink,
}: CharacterReferenceCardProps) {
  const [imgError, setImgError] = useState(false)
  const [copyDone, setCopyDone] = useState(false)
  const dragImgRef = useRef<HTMLImageElement | null>(null)

  const kindLabel = CHARACTER_REFERENCE_KIND_LABELS[asset.kind] ?? asset.kind

  function handleDragStart(event: React.DragEvent<HTMLDivElement>) {
    const payload: CharacterReferenceDragPayload = {
      type: 'creator-city/character-reference',
      referenceId: asset.id,
      characterId: asset.characterId,
      imageUrl: asset.imageUrl,
      kind: asset.kind,
      label: asset.label,
    }
    event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
    event.dataTransfer.setData('text/plain', asset.imageUrl)
    event.dataTransfer.effectAllowed = 'copy'

    // Custom drag ghost: small image preview
    if (dragImgRef.current) {
      event.dataTransfer.setDragImage(dragImgRef.current, 24, 24)
    }
  }

  function handleCopyLink() {
    void navigator.clipboard.writeText(asset.imageUrl).then(() => {
      setCopyDone(true)
      window.setTimeout(() => setCopyDone(false), 1400)
    }).catch(() => {
      setCopyDone(false)
    })
    onCopyLink()
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}
      className={[
        'group relative flex cursor-grab flex-col overflow-hidden rounded-xl border transition active:cursor-grabbing',
        isSelected
          ? 'border-cyan-200/50 bg-cyan-200/10 shadow-[0_0_0_2px_rgba(165,243,252,0.25)]'
          : 'border-white/10 bg-white/[0.04] hover:border-white/20',
      ].join(' ')}
    >
      {/* Drag ghost (hidden) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={dragImgRef}
        src={asset.imageUrl}
        alt=""
        aria-hidden
        className="pointer-events-none fixed -left-[9999px] top-0 h-12 w-12 rounded object-cover opacity-0"
      />

      {/* Image area */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-black/30">
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.imageUrl}
            alt={asset.label}
            draggable={false}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/30">
            图片加载失败
          </div>
        )}

        {/* Hero badge */}
        {asset.isHero ? (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold text-slate-900 shadow">
            ★ 主参考
          </div>
        ) : null}

        {/* Kind badge */}
        <div className="absolute bottom-2 right-2 rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm">
          {kindLabel}
        </div>

        {/* Bound-to-node indicator */}
        {isBoundToCurrentNode ? (
          <div className="absolute left-2 bottom-2 flex items-center gap-1 rounded-full bg-cyan-400/80 px-2 py-0.5 text-[10px] font-semibold text-slate-900 shadow">
            ✓ 已绑定
          </div>
        ) : null}

        {/* Hover action overlay */}
        <div className="absolute inset-0 flex items-end justify-center gap-1 bg-black/0 px-2 pb-2 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
          <div className="flex flex-wrap items-end justify-center gap-1">
            {!asset.isHero ? (
              <button
                type="button"
                className="rounded-md bg-amber-400/90 px-2 py-1 text-[10px] font-bold text-slate-900 shadow hover:bg-amber-300"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onSetHero() }}
                title="设为主参考"
              >
                设主参考
              </button>
            ) : null}
            {isBoundToCurrentNode ? (
              <button
                type="button"
                className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/80 shadow hover:bg-red-400/30 hover:text-red-100"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onUnbindFromNode?.() }}
                title="解除绑定"
              >
                解绑
              </button>
            ) : (
              <button
                type="button"
                className="rounded-md bg-cyan-400/80 px-2 py-1 text-[10px] font-semibold text-slate-900 shadow hover:bg-cyan-300"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onBindToNode() }}
                title="绑定到当前节点"
              >
                绑定节点
              </button>
            )}
            <button
              type="button"
              className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/70 shadow hover:bg-white/20"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); handleCopyLink() }}
              title="复制图片链接"
            >
              {copyDone ? '已复制' : '复制链接'}
            </button>
            <button
              type="button"
              className="rounded-md bg-red-400/20 px-2 py-1 text-[10px] font-semibold text-red-100/80 shadow hover:bg-red-400/40"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              title="删除此参考图"
            >
              删除
            </button>
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div className="flex items-start justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white/82">{asset.label || kindLabel}</p>
          {asset.sourceNodeId ? (
            <p className="mt-0.5 truncate text-[10px] text-white/35">来源: {asset.sourceNodeId.slice(0, 12)}…</p>
          ) : null}
        </div>
        <div className="shrink-0 text-[10px] text-white/28">
          {new Date(asset.createdAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
        </div>
      </div>
    </div>
  )
}

export { DRAG_MIME as CHAR_REF_DRAG_MIME }
