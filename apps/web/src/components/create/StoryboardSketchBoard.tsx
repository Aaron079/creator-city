'use client'

import React from 'react'
import type { StoryboardSketchBoard as StoryboardSketchBoardState } from '@/lib/storyboard/recipe/types'
import type { patchStoryboardSketchFrame } from '@/lib/storyboard/recipe/state-machine'
import {
  renderStoryboardSketchSvg,
} from '@/lib/storyboard/sketch/renderer'
import type {
  StoryboardSketchActionLine,
  StoryboardSketchCameraAngle,
  StoryboardSketchComposition,
  StoryboardSketchMovement,
  StoryboardSketchSubjectAnchor,
} from '@/lib/storyboard/sketch/types'

type StoryboardSketchFramePatch = Parameters<typeof patchStoryboardSketchFrame>[2]

export type StoryboardSketchBoardProps = {
  board: StoryboardSketchBoardState
  disabled?: boolean
  onPatchFrame: (shotId: string, patch: StoryboardSketchFramePatch) => void
  onRegenerateFrame: (shotId: string) => void
}

const COMPOSITIONS: Array<{ value: StoryboardSketchComposition; label: string }> = [
  { value: 'establishing', label: '建立镜头' },
  { value: 'two-shot', label: '双人构图' },
  { value: 'single', label: '单人构图' },
  { value: 'detail', label: '细节特写' },
]

const CAMERA_ANGLES: Array<{ value: StoryboardSketchCameraAngle; label: string }> = [
  { value: 'eye-level', label: '平视' },
  { value: 'high', label: '俯视' },
  { value: 'low', label: '仰视' },
]

const SUBJECT_ANCHORS: Array<{ value: StoryboardSketchSubjectAnchor; label: string }> = [
  { value: 'lower-left', label: '左侧' },
  { value: 'lower-center', label: '中间' },
  { value: 'lower-right', label: '右侧' },
]

const ACTION_LINES: Array<{ value: StoryboardSketchActionLine; label: string }> = [
  { value: 'none', label: '无行动线' },
  { value: 'left-to-right', label: '左至右' },
  { value: 'right-to-left', label: '右至左' },
  { value: 'toward-camera', label: '朝向镜头' },
  { value: 'away-camera', label: '远离镜头' },
]

const MOVEMENTS: Array<{ value: StoryboardSketchMovement; label: string }> = [
  { value: 'static', label: '固定' },
  { value: 'pan', label: '摇移' },
  { value: 'tilt', label: '俯仰' },
  { value: 'dolly', label: '推拉' },
  { value: 'zoom', label: '变焦' },
  { value: 'handheld', label: '手持' },
]

const STATUS = {
  ready: {
    label: '草图已就绪',
    className: 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100/85',
  },
  'needs-review': {
    label: '需审核',
    className: 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100/85',
  },
  stale: {
    label: '已变更，待恢复本地推演',
    className: 'border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100/85',
  },
} as const

const selectClassName = 'h-7 min-w-0 rounded border border-white/10 bg-[#181b20] px-1.5 text-[10px] text-white/80 outline-none focus:border-cyan-200/45 disabled:cursor-not-allowed disabled:opacity-45'

function SelectControl<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  disabled: boolean
  onChange: (value: T) => void
}) {
  return (
    <label className="grid min-w-0 gap-1 text-[9px] leading-3 text-white/43">
      <span className="truncate">{label}</span>
      <select
        aria-label={label}
        className={selectClassName}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

export function StoryboardSketchBoard({
  board,
  disabled = false,
  onPatchFrame,
  onRegenerateFrame,
}: StoryboardSketchBoardProps) {
  return (
    <section aria-label="本地草图分镜" className="space-y-2.5">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-2">
        <div>
          <h3 className="text-xs font-semibold text-white/88">本地草图分镜</h3>
          <p className="mt-0.5 text-[10px] leading-4 text-white/45">基于已批准镜头的确定性示意，不调用生成服务。</p>
        </div>
        <span className="shrink-0 text-[10px] text-white/42">{board.frames.length} 镜头</span>
      </div>

      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="草图镜头顺序">
        {board.frames.map((frame, index) => {
          const status = STATUS[frame.status]
          const shotLabel = `镜头 ${index + 1}`
          return (
            <li key={frame.shotId}>
              <article
                aria-label={shotLabel}
                className="grid gap-2 border border-white/10 bg-[#14171c]/88 p-2.5"
              >
                <header className="flex min-w-0 items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-white/88">{shotLabel}</p>
                    <p className="truncate text-[9px] text-white/38">{frame.shotId}</p>
                  </div>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] leading-3 ${status.className}`}>
                    {status.label}
                  </span>
                </header>

                <div
                  className="overflow-hidden border border-white/10 bg-[#f8f8f4]"
                  dangerouslySetInnerHTML={{ __html: renderStoryboardSketchSvg(frame) }}
                />

                <div className="grid grid-cols-2 gap-1.5">
                  <SelectControl
                    label={`${shotLabel} 构图`}
                    value={frame.composition}
                    options={COMPOSITIONS}
                    disabled={disabled}
                    onChange={(composition) => onPatchFrame(frame.shotId, { composition })}
                  />
                  <SelectControl
                    label={`${shotLabel} 机位`}
                    value={frame.camera.angle}
                    options={CAMERA_ANGLES}
                    disabled={disabled}
                    onChange={(angle) => onPatchFrame(frame.shotId, { camera: { angle } })}
                  />
                  {frame.subjects.map((subject, subjectIndex) => (
                    <SelectControl
                      key={`${frame.shotId}-${subject.label}-${subjectIndex}`}
                      label={`${shotLabel} 主体 ${subject.label} 位置`}
                      value={subject.anchor}
                      options={SUBJECT_ANCHORS}
                      disabled={disabled}
                      onChange={(anchor) => onPatchFrame(frame.shotId, {
                        subjects: frame.subjects.map((currentSubject, currentIndex) => ({
                          anchor: currentIndex === subjectIndex ? anchor : currentSubject.anchor,
                        })),
                      })}
                    />
                  ))}
                  <SelectControl
                    label={`${shotLabel} 行动线`}
                    value={frame.actionLine}
                    options={ACTION_LINES}
                    disabled={disabled}
                    onChange={(actionLine) => onPatchFrame(frame.shotId, { actionLine })}
                  />
                  <SelectControl
                    label={`${shotLabel} 运镜`}
                    value={frame.movement}
                    options={MOVEMENTS}
                    disabled={disabled}
                    onChange={(movement) => onPatchFrame(frame.shotId, { movement })}
                  />
                </div>

                <button
                  type="button"
                  aria-label={`恢复本地推演${shotLabel}`}
                  className="h-7 border border-white/14 bg-white/[0.04] px-2 text-[10px] font-medium text-white/74 transition-colors hover:border-cyan-200/35 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={disabled}
                  onClick={() => onRegenerateFrame(frame.shotId)}
                >
                  恢复本地推演
                </button>
              </article>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
