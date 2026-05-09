'use client'

import type { ShotCard as ShotCardType } from '@/lib/storyboard/types'
import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'

const SHOT_TYPE_LABELS: Record<string, string> = {
  ELS: '大远景',
  LS: '远景',
  MS: '中景',
  MCU: '中近景',
  CU: '近景',
  ECU: '特写',
}

interface ShotCardProps {
  shot: ShotCardType
  selected: boolean
  dragging?: boolean
  onSelect: () => void
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
}

export function ShotCard({
  shot,
  selected,
  dragging,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
}: ShotCardProps) {
  const thumbSrc = shot.thumbnailUrl ? getProxiedMediaUrl(shot.thumbnailUrl) : null
  const shotTypeLabel = shot.shotType ? (SHOT_TYPE_LABELS[shot.shotType] ?? shot.shotType) : null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e) }}
      onDrop={onDrop}
      onClick={onSelect}
      style={{
        opacity: dragging ? 0.4 : 1,
        cursor: 'grab',
        userSelect: 'none',
        flexShrink: 0,
        width: 120,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 10,
        border: selected ? '1.5px solid rgba(103,232,249,0.6)' : '1.5px solid rgba(255,255,255,0.10)',
        background: selected ? 'rgba(8,32,48,0.96)' : 'rgba(18,22,28,0.92)',
        overflow: 'hidden',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Thumbnail */}
      <div style={{
        height: 68,
        background: 'rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={shot.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 24, opacity: 0.18 }}>◫</span>
        )}
        {/* Shot label overlay */}
        <span style={{
          position: 'absolute',
          top: 4,
          left: 4,
          fontSize: 10,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.9)',
          background: 'rgba(0,0,0,0.55)',
          borderRadius: 4,
          padding: '1px 5px',
          letterSpacing: '0.04em',
        }}>
          {shot.title}
        </span>
        {shot.durationSec != null ? (
          <span style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            fontSize: 9,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.75)',
            background: 'rgba(0,0,0,0.55)',
            borderRadius: 3,
            padding: '1px 4px',
          }}>
            {shot.durationSec}s
          </span>
        ) : null}
      </div>

      {/* Info row */}
      <div style={{ padding: '6px 7px 7px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {shotTypeLabel ? (
          <span style={{ fontSize: 10, color: 'rgba(103,232,249,0.8)', fontWeight: 600 }}>{shotTypeLabel}</span>
        ) : null}
        {shot.mood ? (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {shot.mood}
          </span>
        ) : null}
        {shot.directorNote ? (
          <span style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.38)',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.4,
          }}>
            {shot.directorNote}
          </span>
        ) : null}
        {shot.nodeIds.length > 0 ? (
          <span style={{
            fontSize: 9,
            color: 'rgba(103,232,249,0.55)',
            fontWeight: 600,
            marginTop: 1,
          }}>
            {shot.nodeIds.length} 节点
          </span>
        ) : (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)' }}>空镜头</span>
        )}
      </div>
    </div>
  )
}
