'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createSceneProfile,
  deleteSceneProfile,
  updateSceneProfile,
  type SceneBible,
  type SceneProfile,
} from '@/lib/scenes'

interface SceneBiblePanelProps {
  open: boolean
  bible: SceneBible
  embedded?: boolean
  onClose?: () => void
  onSave: (bible: SceneBible) => void
}

const SCENE_FIELDS: Array<{
  key: keyof Pick<SceneProfile, 'name' | 'logline' | 'location' | 'era' | 'atmosphere' | 'architecture' | 'lighting' | 'weather' | 'colorRules' | 'keyObjects' | 'continuityRules' | 'negativeRules'>
  label: string
  placeholder: string
  multiline?: boolean
}> = [
  { key: 'name', label: '场景名', placeholder: '未来雨夜城市街区' },
  { key: 'logline', label: '一句话描述', placeholder: '霓虹灯照亮的高密度未来城市街道，雨水反射蓝紫色光。', multiline: true },
  { key: 'location', label: '地点', placeholder: '未来城市商业区' },
  { key: 'era', label: '时代', placeholder: '近未来' },
  { key: 'atmosphere', label: '氛围', placeholder: '孤独、潮湿、冷峻、电影感', multiline: true },
  { key: 'architecture', label: '建筑/空间结构', placeholder: '高楼、玻璃幕墙、窄街、发光广告牌', multiline: true },
  { key: 'lighting', label: '光线', placeholder: '霓虹蓝紫，高反差，湿地反光', multiline: true },
  { key: 'weather', label: '天气', placeholder: '雨夜' },
  { key: 'colorRules', label: '色彩规则', placeholder: '冷色调为主，蓝紫霓虹，避免暖色阳光。', multiline: true },
  { key: 'keyObjects', label: '关键物件', placeholder: '悬浮车、广告屏、雨伞、湿润街道', multiline: true },
  { key: 'continuityRules', label: '连续性规则', placeholder: '始终保持雨夜、霓虹、湿润反光和高楼压迫感', multiline: true },
  { key: 'negativeRules', label: '禁止变化项', placeholder: '不要变成白天，不要乡村，不要暖色阳光，不要卡通化', multiline: true },
]

function formatSceneForCopy(scene: SceneProfile) {
  const keywords = scene.referenceKeywords?.filter(Boolean).join(', ')
  return [
    `场景名：${scene.name}`,
    scene.logline && `一句话描述：${scene.logline}`,
    scene.location && `地点：${scene.location}`,
    scene.era && `时代：${scene.era}`,
    scene.atmosphere && `氛围：${scene.atmosphere}`,
    scene.architecture && `建筑/空间结构：${scene.architecture}`,
    scene.lighting && `光线：${scene.lighting}`,
    scene.weather && `天气：${scene.weather}`,
    scene.colorRules && `色彩规则：${scene.colorRules}`,
    scene.keyObjects && `关键物件：${scene.keyObjects}`,
    scene.continuityRules && `连续性规则：${scene.continuityRules}`,
    scene.negativeRules && `禁止变化项：${scene.negativeRules}`,
    keywords && `参考关键词：${keywords}`,
  ].filter(Boolean).join('\n')
}

function parseKeywords(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function SceneBiblePanel({
  open,
  bible,
  embedded = false,
  onClose,
  onSave,
}: SceneBiblePanelProps) {
  const [draftBible, setDraftBible] = useState<SceneBible>(bible)
  const [selectedId, setSelectedId] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (!open) return
    setDraftBible(bible)
    setSelectedId((current) => (
      bible.scenes.some((scene) => scene.id === current)
        ? current
        : bible.scenes[0]?.id || ''
    ))
    setCopyState('idle')
  }, [bible, open])

  const selectedScene = useMemo(
    () => draftBible.scenes.find((scene) => scene.id === selectedId) ?? draftBible.scenes[0] ?? null,
    [draftBible.scenes, selectedId],
  )

  const patchSelected = (patch: Partial<SceneProfile>) => {
    if (!selectedScene) return
    setDraftBible((current) => updateSceneProfile(current, selectedScene.id, patch))
  }

  const addScene = () => {
    const scene = createSceneProfile()
    setDraftBible((current) => ({
      scenes: [...current.scenes, scene],
      updatedAt: new Date().toISOString(),
    }))
    setSelectedId(scene.id)
  }

  const removeSelected = () => {
    if (!selectedScene) return
    const nextBible = deleteSceneProfile(draftBible, selectedScene.id)
    setDraftBible(nextBible)
    setSelectedId(nextBible.scenes[0]?.id || '')
  }

  const copySelected = async () => {
    if (!selectedScene) return
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(formatSceneForCopy(selectedScene))
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1400)
    } catch {
      setCopyState('failed')
    }
  }

  if (!open) return null

  const panel = (
    <div className={`${embedded ? 'h-full min-h-[520px]' : 'max-h-[84vh]'} flex w-full flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#101214]/96 text-white shadow-2xl backdrop-blur-xl`}>
      <header className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/48">Scene Bible</p>
            <h2 className="mt-1 text-lg font-semibold text-white">场景库 / Scene Bible</h2>
            <p className="mt-2 text-sm text-white/52">当前 {draftBible.scenes.length} 个场景</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10" onClick={addScene}>
              新建场景
            </button>
            <button
              type="button"
              className="rounded-md bg-cyan-100 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-white"
              onClick={() => onSave(draftBible)}
            >
              保存场景库
            </button>
            {!embedded ? (
              <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10" onClick={onClose}>
                关闭
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)] overflow-hidden max-md:grid-cols-1">
        <div className="min-h-0 overflow-y-auto border-r border-white/10 p-4 max-md:max-h-44 max-md:border-b max-md:border-r-0">
          {draftBible.scenes.length ? (
            <div className="space-y-2">
              {draftBible.scenes.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  className={`w-full rounded-md border px-3 py-2 text-left transition ${scene.id === selectedScene?.id ? 'border-cyan-200/35 bg-cyan-200/12' : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.07]'}`}
                  onClick={() => setSelectedId(scene.id)}
                >
                  <span className="block truncate text-sm font-semibold text-white/86">{scene.name}</span>
                  <span className="mt-1 block truncate text-xs text-white/46">{scene.location || scene.logline || '未填写地点'}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/14 p-4 text-sm text-white/48">
              还没有场景。点击“新建场景”创建第一处场景。
            </div>
          )}
        </div>

        <div className="min-h-0 overflow-y-auto p-5">
          {selectedScene ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-white">{selectedScene.name}</h3>
                  <p className="mt-1 text-xs text-white/42">场景 ID: {selectedScene.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10" onClick={() => { void copySelected() }}>
                    {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制场景设定'}
                  </button>
                  <button type="button" className="rounded-md border border-red-200/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100/78 hover:bg-red-400/18" onClick={removeSelected}>
                    删除
                  </button>
                </div>
              </div>

              <div className="grid gap-3">
                {SCENE_FIELDS.map((field) => (
                  <label key={field.key} className="grid gap-1.5">
                    <span className="text-xs font-semibold text-white/56">{field.label}</span>
                    {field.multiline ? (
                      <textarea
                        value={String(selectedScene[field.key] ?? '')}
                        onChange={(event) => patchSelected({ [field.key]: event.target.value })}
                        placeholder={field.placeholder}
                        rows={3}
                        className="min-h-[74px] resize-y rounded-md border border-white/10 bg-black/22 px-3 py-2 text-sm leading-6 text-white/82 outline-none placeholder:text-white/28 focus:border-cyan-200/36"
                      />
                    ) : (
                      <input
                        value={String(selectedScene[field.key] ?? '')}
                        onChange={(event) => patchSelected({ [field.key]: event.target.value })}
                        placeholder={field.placeholder}
                        className="h-9 rounded-md border border-white/10 bg-black/22 px-3 text-sm text-white/82 outline-none placeholder:text-white/28 focus:border-cyan-200/36"
                      />
                    )}
                  </label>
                ))}

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-white/56">参考关键词</span>
                  <textarea
                    value={selectedScene.referenceKeywords?.join(', ') ?? ''}
                    onChange={(event) => patchSelected({ referenceKeywords: parseKeywords(event.target.value) })}
                    placeholder="rainy neon city, wet street, cyberpunk district"
                    rows={2}
                    className="min-h-[58px] resize-y rounded-md border border-white/10 bg-black/22 px-3 py-2 text-sm leading-6 text-white/82 outline-none placeholder:text-white/28 focus:border-cyan-200/36"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/14 p-5 text-sm text-white/48">
              选择或新建一个场景后编辑设定。
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (embedded) return panel

  return (
    <div
      className="fixed inset-0 z-[92] flex justify-end bg-black/20 p-4"
      role="presentation"
      data-no-node-drag="true"
      data-scene-bible="true"
      onPointerDown={(event) => {
        event.stopPropagation()
        onClose?.()
      }}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <aside
        className="w-[min(760px,calc(100vw-32px))]"
        role="dialog"
        aria-modal="true"
        aria-label="场景库 / Scene Bible"
        data-no-node-drag="true"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        onWheelCapture={(event) => event.stopPropagation()}
      >
        {panel}
      </aside>
    </div>
  )
}
