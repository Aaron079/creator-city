'use client'

import * as React from 'react'
import { createManualWhiteboxEntity } from '@/lib/spatial-previs/whitebox-edit'
import type { SpatialPrevisState, WhiteboxEntity } from '@/lib/spatial-previs/types'

const WHITEBOX_ADD_ACTIONS: ReadonlyArray<{
  kind: WhiteboxEntity['kind']
  label: string
}> = [
  { kind: 'floor', label: '地面' },
  { kind: 'wall', label: '墙体' },
  { kind: 'opening', label: '开口' },
  { kind: 'furniture', label: '家具' },
  { kind: 'prop', label: '道具' },
]

function nextManualWhiteboxEntityIndex(
  entities: readonly WhiteboxEntity[],
  kind: WhiteboxEntity['kind'],
) {
  const pattern = new RegExp(`^manual-${kind}-(\\d+)$`)
  const highestIndex = entities.reduce((highest, entity) => {
    const match = entity.id.match(pattern)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  return highestIndex + 1
}

export function appendManualWhiteboxEntity(
  state: SpatialPrevisState,
  kind: WhiteboxEntity['kind'],
): SpatialPrevisState {
  const entity = createManualWhiteboxEntity(kind, nextManualWhiteboxEntityIndex(state.scene.whitebox.entities, kind))
  return {
    ...state,
    scene: {
      ...state.scene,
      whitebox: {
        entities: [...state.scene.whitebox.entities, entity],
      },
    },
  }
}

export function SpatialWhiteboxToolbar({
  state,
  disabled = false,
  onChange,
}: {
  state: SpatialPrevisState
  disabled?: boolean
  onChange: (next: SpatialPrevisState) => void
}) {
  return (
    <div role="toolbar" aria-label="白模搭建工具" className="flex flex-wrap items-center gap-1.5 border-y border-white/10 bg-white/[0.02] px-2.5 py-2">
      {WHITEBOX_ADD_ACTIONS.map((action) => (
        <button
          key={action.kind}
          type="button"
          aria-label={`添加${action.label}`}
          disabled={disabled}
          onClick={() => onChange(appendManualWhiteboxEntity(state, action.kind))}
          className="h-7 rounded-md border border-white/12 bg-white/[0.025] px-2 text-[11px] font-medium text-white/62 transition hover:border-cyan-200/35 hover:bg-cyan-200/[0.09] hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-35"
        >
          + {action.label}
        </button>
      ))}
    </div>
  )
}
