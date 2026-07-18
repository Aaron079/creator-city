'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { ShotCard, StoryboardState } from '@/lib/storyboard/types'
import {
  createShotCard,
  reindexShots,
  type LegacyDirectorStateReadResult,
} from '@/lib/storyboard/director'
import type { StoryboardDirectorRecipe } from '@/lib/storyboard/recipe/types'
import { StoryboardTimeline } from './StoryboardTimeline'
import {
  StoryboardDirectorRecipePanel,
  type StoryboardDirectorRecipePanelProps,
} from './StoryboardDirectorRecipePanel'

const SHOT_TYPE_OPTIONS = [
  { value: '', label: '选择景别' },
  { value: 'ELS', label: '大远景 ELS' },
  { value: 'LS', label: '远景 LS' },
  { value: 'MS', label: '中景 MS' },
  { value: 'MCU', label: '中近景 MCU' },
  { value: 'CU', label: '近景 CU' },
  { value: 'ECU', label: '特写 ECU' },
]

const CAMERA_MOVEMENT_OPTIONS = [
  { value: '', label: '选择运镜' },
  { value: 'static', label: '固定' },
  { value: 'pan', label: '横摇 Pan' },
  { value: 'tilt', label: '纵摇 Tilt' },
  { value: 'dolly', label: '推拉 Dolly' },
  { value: 'zoom', label: '变焦 Zoom' },
  { value: 'handheld', label: '手持 Handheld' },
  { value: 'drone', label: '航拍 Drone' },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 6,
  padding: '6px 10px',
  color: 'rgba(255,255,255,0.88)',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 4,
}

export type StoryboardDirectorPanelTab = 'recipe' | 'board'

export interface StoryboardDirectorPanelProps {
  open: boolean
  state: StoryboardState
  activeShotId: string | null
  recipe?: StoryboardDirectorRecipe | null
  openedFromRecipe?: boolean
  availableSources?: Array<{ id: string; title: string }>
  availableRecipes?: Array<{ nodeId: string; recipeId: string; title: string; status: string }>
  saveState?: 'local' | 'saving' | 'cloud' | 'failed'
  legacyState?: LegacyDirectorStateReadResult
  projectId?: string
  canvasNodes?: Array<{ id: string; kind: string; title?: string; resultImageUrl?: string; resultVideoUrl?: string }>
  onStateChange: (state: StoryboardState) => void
  onActiveShotChange: (id: string | null) => void
  onStartRecipe?: (sourceNodeId: string) => void
  onOpenRecipe?: (controlNodeId: string) => void
  onCommitRecipe?: (recipe: StoryboardDirectorRecipe) => void
  onFocusSource?: (sourceNodeId: string) => void
  onMaterializeGrouped?: StoryboardDirectorRecipePanelProps['onMaterializeGrouped']
  onSyncShotBoard?: () => void
  onCreateDraftNodes?: () => void
  onImportLegacy?: () => void
  onClose: () => void
}

function now() {
  return new Date().toISOString()
}

function patchState(state: StoryboardState, shots: ShotCard[]): StoryboardState {
  return { ...state, shots, updatedAt: now() }
}

export function createStoryboardDirectorPanelState({
  hasRecipe,
  openedFromRecipe,
}: {
  hasRecipe: boolean
  openedFromRecipe: boolean
}) {
  return { tab: hasRecipe && openedFromRecipe ? 'recipe' as const : 'board' as const }
}

export function selectStoryboardDirectorTab<T extends { tab: StoryboardDirectorPanelTab }>(
  state: T,
  tab: StoryboardDirectorPanelTab,
): T {
  return state.tab === tab ? state : { ...state, tab }
}

export function patchStoryboardDirectorShot(
  state: StoryboardState,
  shotId: string,
  patch: Partial<ShotCard>,
  updatedAt: string,
): StoryboardState {
  let changed = false
  const shots = state.shots.map((shot) => {
    if (shot.id !== shotId) return shot
    changed = true
    return { ...shot, ...patch, updatedAt }
  })
  return changed ? { ...state, shots, updatedAt } : state
}

const NOOP = () => {}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  )
}

export function StoryboardDirectorPanel({
  open,
  state,
  activeShotId,
  recipe = null,
  openedFromRecipe = false,
  availableSources = [],
  availableRecipes = [],
  saveState = 'local',
  legacyState = { status: 'absent' },
  canvasNodes = [],
  onStateChange,
  onActiveShotChange,
  onStartRecipe = NOOP,
  onOpenRecipe = NOOP,
  onCommitRecipe = NOOP,
  onFocusSource = NOOP,
  onMaterializeGrouped = NOOP,
  onSyncShotBoard = NOOP,
  onCreateDraftNodes = NOOP,
  onImportLegacy = NOOP,
  onClose,
}: StoryboardDirectorPanelProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [panelState, setPanelState] = useState(() => createStoryboardDirectorPanelState({
    hasRecipe: Boolean(recipe),
    openedFromRecipe,
  }))
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      setPanelState(createStoryboardDirectorPanelState({
        hasRecipe: Boolean(recipe),
        openedFromRecipe,
      }))
    }
    wasOpen.current = open
  }, [open, openedFromRecipe, recipe])

  if (!open) return null

  const { shots } = state
  const activeShot = activeShotId ? shots.find((s) => s.id === activeShotId) ?? null : null

  const updateShot = (id: string, patch: Partial<ShotCard>) => {
    onStateChange(patchStoryboardDirectorShot(state, id, patch, now()))
  }

  const handleAddShot = () => {
    const newShot = createShotCard(shots.length)
    const nextShots = [...shots, newShot]
    onStateChange(patchState(state, nextShots))
    onActiveShotChange(newShot.id)
  }

  const handleReorder = (reorderedShots: ShotCard[]) => {
    onStateChange(patchState(state, reorderedShots))
  }

  const handleDeleteShot = (id: string) => {
    const nextShots = reindexShots(shots.filter((s) => s.id !== id))
    onStateChange(patchState(state, nextShots))
    if (activeShotId === id) onActiveShotChange(nextShots[0]?.id ?? null)
    setConfirmDeleteId(null)
  }

  const boundNodes = activeShot
    ? canvasNodes.filter((n) => activeShot.nodeIds.includes(n.id))
    : []

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.18)',
      }}
      role="presentation"
      data-no-node-drag="true"
      data-storyboard-director="true"
      onPointerDown={(e) => { e.stopPropagation(); onClose() }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onWheelCapture={(e) => e.stopPropagation()}
    >
      <aside
        style={{
          margin: 16,
          display: 'flex',
          flexDirection: 'column',
          width: 'min(1120px, calc(100vw - 32px))',
          maxHeight: '88vh',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.10)',
          background: 'rgba(10,12,16,0.97)',
          color: 'white',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
          backdropFilter: 'blur(20px)',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Storyboard Director"
        data-no-node-drag="true"
        data-storyboard-director="true"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onWheelCapture={(e) => e.stopPropagation()}
      >
        <header className="flex flex-none flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <div className="min-w-[120px]">
            <p className="mb-0.5 text-[9px] font-semibold uppercase text-cyan-200/45">Storyboard Director</p>
            <h2 className="m-0 text-[15px] font-semibold text-white">分镜导演</h2>
          </div>
          <div className="grid h-9 grid-cols-2 rounded-md border border-white/10 bg-white/[0.025] p-0.5" role="tablist" aria-label="分镜导演视图">
            <button
              type="button"
              role="tab"
              aria-selected={panelState.tab === 'recipe'}
              data-testid="storyboard-director-tab-recipe"
              onClick={() => setPanelState((current) => selectStoryboardDirectorTab(current, 'recipe'))}
              className={`min-w-[76px] rounded px-3 text-[10px] font-semibold transition ${panelState.tab === 'recipe' ? 'bg-white/[0.11] text-white' : 'text-white/42 hover:text-white/70'}`}
            >
              Recipe
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panelState.tab === 'board'}
              data-testid="storyboard-director-tab-board"
              onClick={() => setPanelState((current) => selectStoryboardDirectorTab(current, 'board'))}
              className={`min-w-[76px] rounded px-3 text-[10px] font-semibold transition ${panelState.tab === 'board' ? 'bg-white/[0.11] text-white' : 'text-white/42 hover:text-white/70'}`}
            >
              镜头板
            </button>
          </div>
          <div className="flex min-w-[120px] items-center justify-end gap-2">
            {panelState.tab === 'board' ? (
              <button type="button" onClick={handleAddShot} className="h-8 rounded-md border border-cyan-200/30 bg-cyan-200/[0.08] px-3 text-[11px] font-semibold text-cyan-100">
                + 新建镜头
              </button>
            ) : null}
            <button type="button" onClick={onClose} title="关闭分镜导演" aria-label="关闭分镜导演" className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.09] hover:text-white">
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </header>

        {panelState.tab === 'board' ? (
          <>

        {/* Timeline */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {shots.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 24px',
              gap: 10,
            }}>
              <span style={{ fontSize: 32, opacity: 0.2 }}>🎬</span>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
                还没有镜头卡。点击 ＋ 新建镜头 开始构建分镜。
              </p>
            </div>
          ) : (
            <StoryboardTimeline
              shots={shots}
              activeShotId={activeShotId}
              onSelectShot={(id) => onActiveShotChange(id)}
              onReorder={handleReorder}
              onAddShot={handleAddShot}
            />
          )}
        </div>

        {/* Detail area */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {activeShot ? (
            <div style={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden' }}>
              {/* Left: shot fields */}
              <div style={{
                flex: 1,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                overflow: 'auto',
                borderRight: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                    {activeShot.title} 镜头详情
                  </span>
                  {confirmDeleteId === activeShot.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteShot(activeShot.id)}
                        style={{ fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                      >
                        确认删除
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(activeShot.id)}
                      style={{ fontSize: 11, color: 'rgba(248,113,113,0.65)', background: 'transparent', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                    >
                      删除镜头
                    </button>
                  )}
                </div>

                {activeShot.recipe ? (
                  <div className="flex min-h-9 flex-wrap items-center gap-2 border-y border-cyan-200/10 py-2">
                    <button
                      type="button"
                      onClick={() => setPanelState((current) => selectStoryboardDirectorTab(current, 'recipe'))}
                      className="rounded-md border border-cyan-200/20 bg-cyan-200/[0.06] px-2 py-1 text-[9px] font-semibold text-cyan-100"
                    >
                      Recipe {activeShot.recipe.recipeId}
                    </button>
                    <span className="rounded border border-emerald-300/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200">来源已保留</span>
                    <span className="text-[9px] text-white/35">{activeShot.recipe.sceneId} · {activeShot.recipe.beatId ?? '无节拍'} · {activeShot.recipe.shotId}</span>
                  </div>
                ) : null}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FieldRow label="景别">
                    <select
                      value={activeShot.shotType ?? ''}
                      onChange={(e) => updateShot(activeShot.id, { shotType: e.target.value || undefined })}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      {SHOT_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </FieldRow>

                  <FieldRow label="时长 (秒)">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="例: 5"
                      value={activeShot.durationSec ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? undefined : Number(e.target.value)
                        updateShot(activeShot.id, { durationSec: val })
                      }}
                      style={inputStyle}
                    />
                  </FieldRow>

                  <FieldRow label="情绪">
                    <input
                      type="text"
                      placeholder="例: 紧张 / 孤独 / 宏大"
                      value={activeShot.mood ?? ''}
                      onChange={(e) => updateShot(activeShot.id, { mood: e.target.value || undefined })}
                      style={inputStyle}
                    />
                  </FieldRow>

                  <FieldRow label="运镜">
                    <select
                      value={activeShot.cameraMovement ?? ''}
                      onChange={(e) => updateShot(activeShot.id, { cameraMovement: e.target.value || undefined })}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      {CAMERA_MOVEMENT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </FieldRow>
                </div>

                <FieldRow label="导演备注">
                  <textarea
                    placeholder="镜头构图、情感要点、特别说明..."
                    value={activeShot.directorNote ?? ''}
                    onChange={(e) => updateShot(activeShot.id, { directorNote: e.target.value || undefined })}
                    rows={3}
                    style={{
                      ...inputStyle,
                      resize: 'vertical',
                      lineHeight: 1.6,
                      fontFamily: 'inherit',
                      minHeight: 64,
                    }}
                  />
                </FieldRow>
              </div>

              {/* Right: bound nodes */}
              <div style={{ width: 220, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto', flexShrink: 0 }}>
                <span style={labelStyle}>已绑定节点 ({activeShot.nodeIds.length})</span>
                {boundNodes.length === 0 ? (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, margin: 0 }}>
                    在画布节点上点击【加入分镜】绑定节点。
                  </p>
                ) : (
                  boundNodes.map((n) => (
                    <div key={n.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 7,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)',
                    }}>
                      <span style={{ fontSize: 12, opacity: 0.55, flexShrink: 0 }}>
                        {n.kind === 'image' ? '◫' : n.kind === 'video' ? '▻' : '✦'}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {n.title || n.id.slice(0, 8)}
                      </span>
                      <button
                        type="button"
                        title="移除绑定"
                        aria-label="移除绑定"
                        onClick={() => {
                          const nodeIds = activeShot.nodeIds.filter((id) => id !== n.id)
                          const thumbnailUrl = n.id === canvasNodes.find((cn) => cn.id === activeShot.thumbnailUrl)?.id
                            ? nodeIds.find((id) => {
                                const cn = canvasNodes.find((c) => c.id === id)
                                return cn?.kind === 'image' || cn?.kind === 'video'
                              }) ?? undefined
                            : activeShot.thumbnailUrl
                          updateShot(activeShot.id, { nodeIds, thumbnailUrl })
                        }}
                        style={{ color: 'rgba(255,255,255,0.3)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 1, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 32 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.7, margin: 0 }}>
                {shots.length === 0
                  ? '点击 "＋ 新建镜头" 创建第一个镜头卡。'
                  : '点击上方镜头卡选择并编辑镜头信息。'}
              </p>
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div style={{
          padding: '8px 18px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            共 {shots.length} 个镜头
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            总时长 {shots.reduce((sum, s) => sum + (s.durationSec ?? 0), 0).toFixed(1)}s
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            绑定节点 {new Set(shots.flatMap((s) => s.nodeIds)).size}
          </span>
        </div>
          </>
        ) : (
          <StoryboardDirectorRecipePanel
            recipe={recipe}
            availableSources={availableSources}
            availableRecipes={availableRecipes}
            saveState={saveState}
            legacyState={legacyState}
            onStartRecipe={onStartRecipe}
            onOpenRecipe={onOpenRecipe}
            onCommitRecipe={onCommitRecipe}
            onFocusSource={onFocusSource}
            onMaterializeGrouped={onMaterializeGrouped}
            onSyncShotBoard={onSyncShotBoard}
            onCreateDraftNodes={onCreateDraftNodes}
            onImportLegacy={onImportLegacy}
          />
        )}
      </aside>
    </div>
  )
}
