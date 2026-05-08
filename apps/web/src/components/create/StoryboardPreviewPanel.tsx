'use client'

import { useEffect, useMemo, useState } from 'react'
import type { VisualCanvasNode as CanvasNode } from '@/components/create/CanvasNodeCard'
import { buildStoryboardFromCanvas, type StoryboardCanvasEdge, type StoryboardShot } from '@/lib/storyboard'

interface StoryboardPreviewPanelProps {
  open: boolean
  nodes: CanvasNode[]
  edges: StoryboardCanvasEdge[]
  projectId?: string
  onClose: () => void
  onOpenPromptInspector?: (nodeId: string) => void
}

type StoryboardShotSetting = {
  notes?: string
  hidden?: boolean
}

type StoryboardSettings = {
  order: string[]
  shots: Record<string, StoryboardShotSetting>
}

type CopyState = 'idle' | 'copied' | 'failed'

const EMPTY_SETTINGS: StoryboardSettings = { order: [], shots: {} }

function storyboardStorageKey(projectId?: string) {
  return `creator-city:storyboard:${projectId || 'local'}`
}

function compactText(value: string | undefined, limit: number) {
  const text = value?.trim() ?? ''
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

function missingLabel(value: string) {
  if (value === 'text') return '缺文案'
  if (value === 'image') return '缺图片'
  if (value === 'video') return '缺视频'
  return value
}

function shotStatus(shot: StoryboardShot) {
  if (shot.status === 'error') return 'error'
  if (shot.status === 'queued' || shot.status === 'running' || shot.status === 'generating') return 'running'
  if (shot.missing.includes('image')) return 'missing image'
  if (shot.missing.includes('video')) return 'missing video'
  return 'ready'
}

function shotCopyText(shot: StoryboardShot) {
  return [
    `镜头 ${shot.order}`,
    shot.text ? `文案:\n${shot.text}` : '',
    shot.prompt ? `Prompt:\n${shot.prompt}` : '',
    shot.notes ? `备注:\n${shot.notes}` : '',
    shot.imageUrl ? `Image: ${shot.imageUrl}` : '',
    shot.videoUrl ? `Video: ${shot.videoUrl}` : '',
  ].filter(Boolean).join('\n\n')
}

function allCopyText(shots: StoryboardShot[]) {
  return shots.filter((shot) => !shot.hidden).map(shotCopyText).join('\n\n---\n\n')
}

function readSettings(raw: string | null): StoryboardSettings {
  if (!raw) return EMPTY_SETTINGS
  try {
    const parsed = JSON.parse(raw) as Partial<StoryboardSettings>
    return {
      order: Array.isArray(parsed.order) ? parsed.order.filter((id): id is string => typeof id === 'string') : [],
      shots: parsed.shots && typeof parsed.shots === 'object' && !Array.isArray(parsed.shots)
        ? Object.fromEntries(Object.entries(parsed.shots).map(([id, value]) => {
            const record = value && typeof value === 'object' && !Array.isArray(value)
              ? value as Record<string, unknown>
              : {}
            return [id, {
              notes: typeof record.notes === 'string' ? record.notes : undefined,
              hidden: typeof record.hidden === 'boolean' ? record.hidden : undefined,
            }]
          }))
        : {},
    }
  } catch {
    return EMPTY_SETTINGS
  }
}

function moveItem(ids: string[], id: string, direction: -1 | 1) {
  const index = ids.indexOf(id)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return ids
  const next = [...ids]
  const [item] = next.splice(index, 1)
  if (!item) return ids
  next.splice(nextIndex, 0, item)
  return next
}

function ShotText({ shot }: { shot: StoryboardShot }) {
  const [expanded, setExpanded] = useState(false)
  const text = shot.text?.trim() || ''
  if (!text) return <p className="text-sm text-white/42">当前镜头没有 Text 文案。</p>
  const display = expanded ? text : compactText(text, 300)
  return (
    <div>
      <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-white/76">{display}</pre>
      {text.length > 300 ? (
        <button
          type="button"
          className="mt-2 text-xs font-medium text-cyan-100/72 hover:text-cyan-50"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setExpanded((current) => !current)
          }}
        >
          {expanded ? '收起文案' : '展开文案'}
        </button>
      ) : null}
    </div>
  )
}

export function StoryboardPreviewPanel({
  open,
  nodes,
  edges,
  projectId,
  onClose,
  onOpenPromptInspector,
}: StoryboardPreviewPanelProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [settings, setSettings] = useState<StoryboardSettings>(EMPTY_SETTINGS)
  const [loadedKey, setLoadedKey] = useState('')
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [mediaPreview, setMediaPreview] = useState<{ type: 'image' | 'video'; url: string; title: string } | null>(null)
  const storageKey = storyboardStorageKey(projectId)
  const baseShots = useMemo(() => {
    void refreshKey
    return buildStoryboardFromCanvas(nodes, edges)
  }, [edges, nodes, refreshKey])
  const shots = useMemo<StoryboardShot[]>(() => {
    const ids = new Set(baseShots.map((shot) => shot.id))
    const orderedIds = [
      ...settings.order.filter((id) => ids.has(id)),
      ...baseShots.map((shot) => shot.id).filter((id) => !settings.order.includes(id)),
    ]
    const byId = new Map(baseShots.map((shot) => [shot.id, shot]))
    return orderedIds
      .flatMap((id, index) => {
        const shot = byId.get(id)
        if (!shot) return []
        const shotSetting = settings.shots[id] ?? {}
        const nextShot: StoryboardShot = {
          ...shot,
          order: index + 1,
        }
        if (shotSetting.notes) nextShot.notes = shotSetting.notes
        if (typeof shotSetting.hidden === 'boolean') nextShot.hidden = shotSetting.hidden
        return [nextShot]
      })
  }, [baseShots, settings])
  const stats = useMemo(() => ({
    total: shots.length,
    imageCount: shots.filter((shot) => Boolean(shot.imageUrl)).length,
    videoCount: shots.filter((shot) => Boolean(shot.videoUrl)).length,
    runningCount: shots.filter((shot) => shotStatus(shot) === 'running').length,
    missingCount: shots.reduce((total, shot) => total + shot.missing.length, 0),
  }), [shots])

  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    setSettings(readSettings(window.localStorage.getItem(storageKey)))
    setLoadedKey(storageKey)
  }, [open, storageKey])

  useEffect(() => {
    if (!open || loadedKey !== storageKey || typeof window === 'undefined') return
    window.localStorage.setItem(storageKey, JSON.stringify(settings))
  }, [loadedKey, open, settings, storageKey])

  const updateShotSetting = (shotId: string, patch: StoryboardShotSetting) => {
    setSettings((current) => ({
      ...current,
      shots: {
        ...current.shots,
        [shotId]: {
          ...current.shots[shotId],
          ...patch,
        },
      },
    }))
  }

  const ensureOrder = () => {
    const currentIds = shots.map((shot) => shot.id)
    setSettings((current) => ({ ...current, order: currentIds }))
    return currentIds
  }

  const moveShot = (shotId: string, direction: -1 | 1) => {
    const ids = settings.order.length ? settings.order.filter((id) => shots.some((shot) => shot.id === id)) : ensureOrder()
    const missingIds = shots.map((shot) => shot.id).filter((id) => !ids.includes(id))
    setSettings((current) => ({
      ...current,
      order: moveItem([...ids, ...missingIds], shotId, direction),
    }))
  }

  const copyText = async (text: string) => {
    try {
      if (!text.trim() || !navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1600)
    } catch {
      setCopyState('failed')
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[88] flex justify-end bg-black/20"
      role="presentation"
      data-no-node-drag="true"
      data-storyboard-preview="true"
      onPointerDown={(event) => {
        event.stopPropagation()
        onClose()
      }}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <aside
        className="m-4 flex max-h-[85vh] w-[min(880px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#101214]/96 text-white shadow-2xl backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label="组合预览 / Storyboard Timeline"
        data-no-node-drag="true"
        data-storyboard-preview="true"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        onWheelCapture={(event) => event.stopPropagation()}
      >
        <header className="border-b border-white/10 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/48">Storyboard Timeline</p>
              <h2 className="mt-1 text-lg font-semibold text-white">组合预览</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10"
                onClick={() => setRefreshKey((current) => current + 1)}
              >
                刷新预览
              </button>
              <button
                type="button"
                className="rounded-md border border-cyan-100/20 bg-cyan-100/10 px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-100/15"
                onClick={() => { void copyText(allCopyText(shots)) }}
              >
                {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败，请手动选择文本。' : '复制全部文案'}
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-lg leading-none text-white/66 hover:bg-white/10 hover:text-white"
                aria-label="关闭组合预览"
                onClick={onClose}
              >
                ×
              </button>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            {[
              ['总镜头数', stats.total],
              ['已有图片', stats.imageCount],
              ['已有视频', stats.videoCount],
              ['生成中', stats.runningCount],
              ['缺失项', stats.missingCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-white/10 bg-white/[0.035] p-2">
                <dt className="text-white/38">{label}</dt>
                <dd className="mt-1 font-mono text-sm text-white/82">{value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {shots.length ? (
            <div className="space-y-4">
              {shots.map((shot, index) => {
                const state = shotStatus(shot)
                const inspectorNodeId = shot.videoNodeId || shot.imageNodeId || shot.textNodeId
                return (
                  <article
                    key={shot.id}
                    className={`rounded-xl border p-4 ${shot.hidden ? 'border-white/6 bg-white/[0.02] opacity-55' : 'border-white/10 bg-white/[0.035]'}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-cyan-100/20 bg-cyan-100/10 px-2 py-1 font-mono text-xs text-cyan-50">SHOT {shot.order}</span>
                          <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                            state === 'ready'
                              ? 'border-emerald-200/20 bg-emerald-200/10 text-emerald-50'
                              : state === 'running'
                                ? 'border-sky-200/20 bg-sky-200/10 text-sky-50'
                                : state === 'error'
                                  ? 'border-rose-200/20 bg-rose-200/10 text-rose-50'
                                  : 'border-amber-200/20 bg-amber-200/10 text-amber-50'
                          }`}>
                            {state}
                          </span>
                          {shot.missing.map((item) => (
                            <span key={item} className="rounded border border-amber-200/15 px-1.5 py-0.5 text-xs text-amber-100/75">{missingLabel(item)}</span>
                          ))}
                        </div>
                        <p className="mt-2 font-mono text-xs text-white/40">
                          {[shot.providerId, shot.model].filter(Boolean).join(' / ') || 'provider/model 未记录'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/68 hover:bg-white/10" disabled={index === 0} onClick={() => moveShot(shot.id, -1)}>上移</button>
                        <button type="button" className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/68 hover:bg-white/10" disabled={index === shots.length - 1} onClick={() => moveShot(shot.id, 1)}>下移</button>
                        <button type="button" className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/68 hover:bg-white/10" onClick={() => updateShotSetting(shot.id, { hidden: !shot.hidden })}>
                          {shot.hidden ? '显示' : '隐藏'}
                        </button>
                        <button type="button" className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/68 hover:bg-white/10" onClick={() => { void copyText(shotCopyText(shot)) }}>复制文案</button>
                        {onOpenPromptInspector && inspectorNodeId ? (
                          <button
                            type="button"
                            className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/68 hover:bg-white/10"
                            onClick={() => onOpenPromptInspector(inspectorNodeId)}
                          >
                            生成依据
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="space-y-4">
                        <section className="rounded-lg bg-black/18 p-3">
                          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/36">Text</h3>
                          <ShotText shot={shot} />
                        </section>
                        <section className="rounded-lg bg-black/18 p-3">
                          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/36">Prompt</h3>
                          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white/60">{compactText(shot.prompt, 220) || '未记录 prompt。'}</p>
                          {shot.compiledPromptPreview ? (
                            <p className="mt-2 whitespace-pre-wrap break-words border-t border-white/8 pt-2 text-xs leading-5 text-white/42">
                              compiledPromptPreview: {compactText(shot.compiledPromptPreview, 260)}
                            </p>
                          ) : null}
                        </section>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/36">备注</span>
                          <textarea
                            value={shot.notes ?? ''}
                            onChange={(event) => updateShotSetting(shot.id, { notes: event.target.value })}
                            className="mt-2 min-h-20 w-full resize-y rounded-lg border border-white/10 bg-black/24 px-3 py-2 text-sm leading-6 text-white/78 outline-none transition placeholder:text-white/28 focus:border-cyan-100/30"
                            placeholder="给这个镜头写内部备注..."
                          />
                        </label>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-lg border border-white/10 bg-black/18 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/36">Image</h3>
                            {shot.imageUrl ? (
                              <button type="button" className="text-xs text-cyan-100/70 hover:text-cyan-50" onClick={() => setMediaPreview({ type: 'image', url: shot.imageUrl!, title: `Shot ${shot.order} Image` })}>大预览</button>
                            ) : null}
                          </div>
                          {shot.imageUrl ? (
                            <button type="button" className="block overflow-hidden rounded-md border border-white/10 bg-black/30" onClick={() => setMediaPreview({ type: 'image', url: shot.imageUrl!, title: `Shot ${shot.order} Image` })}>
                              <img src={shot.imageUrl} alt={`Shot ${shot.order}`} className="aspect-video w-full object-cover" loading="lazy" draggable={false} />
                            </button>
                          ) : (
                            <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-white/12 text-sm text-white/34">缺图片</div>
                          )}
                        </div>

                        <div className="rounded-lg border border-white/10 bg-black/18 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/36">Video</h3>
                            {shot.videoUrl ? (
                              <button type="button" className="text-xs text-cyan-100/70 hover:text-cyan-50" onClick={() => setMediaPreview({ type: 'video', url: shot.videoUrl!, title: `Shot ${shot.order} Video` })}>大预览</button>
                            ) : null}
                          </div>
                          {shot.videoUrl ? (
                            <button type="button" className="block w-full overflow-hidden rounded-md border border-white/10 bg-black/30" onClick={() => setMediaPreview({ type: 'video', url: shot.videoUrl!, title: `Shot ${shot.order} Video` })}>
                              <video src={shot.videoUrl} className="aspect-video w-full object-cover" muted playsInline preload="metadata" />
                            </button>
                          ) : (
                            <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-white/12 text-sm text-white/34">缺视频</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-white/12 bg-white/[0.025] text-sm text-white/42">
              当前画布没有可组合预览的 Text / Image / Video 节点。
            </div>
          )}
        </div>

        {mediaPreview ? (
          <div
            className="absolute inset-0 z-[2] flex items-center justify-center bg-black/70 p-5"
            role="presentation"
            onPointerDown={(event) => {
              event.stopPropagation()
              setMediaPreview(null)
            }}
            onWheel={(event) => event.stopPropagation()}
          >
            <section
              className="max-h-full w-[min(920px,100%)] overflow-hidden rounded-xl border border-white/12 bg-[#0d0f11] shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label={mediaPreview.title}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-white/82">{mediaPreview.title}</h3>
                <button type="button" className="rounded-md border border-white/10 px-2 py-1 text-sm text-white/68 hover:bg-white/10" onClick={() => setMediaPreview(null)}>关闭</button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-4">
                {mediaPreview.type === 'image' ? (
                  <img src={mediaPreview.url} alt={mediaPreview.title} className="mx-auto max-h-[64vh] max-w-full rounded-lg object-contain" />
                ) : (
                  <video src={mediaPreview.url} className="mx-auto max-h-[64vh] max-w-full rounded-lg" controls playsInline />
                )}
              </div>
            </section>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
