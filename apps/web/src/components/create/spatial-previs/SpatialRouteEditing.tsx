'use client'

import * as React from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Line } from '@react-three/drei/core/Line'
import type { ThreeEvent } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { Vec3 } from '@/lib/spatial-previs/types'

export type RoutePointRequest = {
  kind: 'actor' | 'camera'
  actorTrackId?: string
  timeSec: number
  ground?: Vec3
}

export function SpatialRouteGuide({ keyframes, color, selected, onInsert }: {
  keyframes: Array<{ position: Vec3; timeSec: number }>
  color: string
  selected: boolean
  onInsert?: (event: ThreeEvent<MouseEvent>, timeSec: number) => void
}) {
  const keys = useMemo(() => [...keyframes].sort((a, b) => a.timeSec - b.timeSec), [keyframes])
  const points = useMemo(() => keys.map(k => new Vector3(k.position.x, k.position.y, k.position.z)), [keys])
  const segments = useMemo(() => points.slice(1).map((point, index) => [points[index]!, point]), [points])
  if (keys.length < 2) return null
  return <>
    <Line points={points} color={color} lineWidth={selected ? 2 : 1.5} transparent opacity={selected ? 0.9 : 0.55} depthTest={false} depthWrite={false} renderOrder={500} />
    {onInsert && keys.slice(1).map((end, index) => {
      const start = keys[index]!
      const a = points[index]!, b = points[index + 1]!
      if (end.timeSec <= start.timeSec || a.distanceToSquared(b) < 1e-10) return null
      return <Line key={`${index}-${start.timeSec}`} points={segments[index]!} lineWidth={14} transparent opacity={0} depthWrite={false}
        userData={{ spatialPickPriority: 0.75 }}
        onPointerDown={event => {
          if (event.button !== 2) return
          event.stopPropagation()
          event.nativeEvent.stopImmediatePropagation()
        }}
        onContextMenu={event => {
          event.stopPropagation()
          event.nativeEvent.preventDefault()
          const point = new Vector3()
          event.ray.distanceSqToSegment(a, b, undefined, point)
          const progress = point.sub(a).dot(b.clone().sub(a)) / a.distanceToSquared(b)
          onInsert(event, Number((start.timeSec + Math.max(0, Math.min(1, progress)) * (end.timeSec - start.timeSec)).toFixed(3)))
        }} />
    })}
  </>
}

export function SpatialRouteMenu({ x, y, timeSec, ground, duplicate, onAdd, onClose }: {
  x: number; y: number; timeSec: number; ground: boolean; duplicate: boolean
  onAdd: () => void; onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
    const outside = (event: Event) => { if (!ref.current?.contains(event.target as Node)) onClose() }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', escape, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])
  return createPortal(<div ref={ref} role="menu" aria-label="轨道点位" tabIndex={-1}
    onContextMenu={event => { event.preventDefault(); event.stopPropagation() }}
    onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus() } }}
    className="fixed z-[3001] w-44 rounded-md border border-white/20 bg-[#10171d]/85 p-1.5 text-xs font-normal text-white shadow-lg backdrop-blur-md outline-none"
    style={{ left: Math.max(8, Math.min(x, window.innerWidth - 184)), top: Math.max(8, Math.min(y, window.innerHeight - 90)) }}>
    <div className="px-2 py-1 text-[10px] text-white/50">{timeSec}s{duplicate ? ' · 该时间已有点位' : ''}</div>
    <button type="button" role="menuitem" disabled={duplicate} onClick={onAdd} className="w-full rounded px-2 py-2 text-left hover:bg-white/10 focus:bg-white/10 disabled:opacity-35">
      {ground ? '添加人物走位点' : '添加点位'}
    </button>
  </div>, document.body)
}
