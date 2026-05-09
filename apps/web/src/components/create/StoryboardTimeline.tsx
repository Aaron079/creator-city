'use client'

import { useRef, useState } from 'react'
import type { ShotCard } from '@/lib/storyboard/types'
import { ShotCard as ShotCardComponent } from './ShotCard'

interface StoryboardTimelineProps {
  shots: ShotCard[]
  activeShotId: string | null
  onSelectShot: (id: string) => void
  onReorder: (shots: ShotCard[]) => void
  onAddShot: () => void
}

export function StoryboardTimeline({
  shots,
  activeShotId,
  onSelectShot,
  onReorder,
  onAddShot,
}: StoryboardTimelineProps) {
  const [dragShotId, setDragShotId] = useState<string | null>(null)
  const overShotIdRef = useRef<string | null>(null)

  const handleDragStart = (shotId: string) => (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = 'move'
    setDragShotId(shotId)
  }

  const handleDragOver = (shotId: string) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    overShotIdRef.current = shotId
  }

  const handleDrop = (targetShotId: string) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!dragShotId || dragShotId === targetShotId) {
      setDragShotId(null)
      return
    }
    const fromIndex = shots.findIndex((s) => s.id === dragShotId)
    const toIndex = shots.findIndex((s) => s.id === targetShotId)
    if (fromIndex < 0 || toIndex < 0) {
      setDragShotId(null)
      return
    }
    const next = [...shots]
    const [moved] = next.splice(fromIndex, 1)
    if (!moved) { setDragShotId(null); return }
    next.splice(toIndex, 0, moved)
    const reindexed = next.map((shot, i) => {
      const num = String(i + 1).padStart(2, '0')
      return { ...shot, index: i, title: shot.title.match(/^S\d+$/) ? `S${num}` : shot.title }
    })
    onReorder(reindexed)
    setDragShotId(null)
  }

  const handleDragEnd = () => {
    setDragShotId(null)
    overShotIdRef.current = null
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: '12px 16px',
        minHeight: 140,
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.15) transparent',
      }}
      onDragEnd={handleDragEnd}
    >
      {shots.map((shot) => (
        <ShotCardComponent
          key={shot.id}
          shot={shot}
          selected={shot.id === activeShotId}
          dragging={shot.id === dragShotId}
          onSelect={() => onSelectShot(shot.id)}
          onDragStart={handleDragStart(shot.id)}
          onDragOver={handleDragOver(shot.id)}
          onDrop={handleDrop(shot.id)}
        />
      ))}

      <button
        type="button"
        onClick={onAddShot}
        style={{
          flexShrink: 0,
          width: 80,
          height: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          borderRadius: 10,
          border: '1.5px dashed rgba(255,255,255,0.18)',
          background: 'rgba(255,255,255,0.03)',
          color: 'rgba(255,255,255,0.45)',
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
          fontSize: 11,
          fontWeight: 600,
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget as HTMLButtonElement
          btn.style.borderColor = 'rgba(103,232,249,0.45)'
          btn.style.background = 'rgba(103,232,249,0.06)'
          btn.style.color = 'rgba(103,232,249,0.9)'
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget as HTMLButtonElement
          btn.style.borderColor = 'rgba(255,255,255,0.18)'
          btn.style.background = 'rgba(255,255,255,0.03)'
          btn.style.color = 'rgba(255,255,255,0.45)'
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
        <span>新建镜头</span>
      </button>
    </div>
  )
}
