'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { VisualCanvasNode as CanvasNode } from '@/components/create/CanvasNodeCard'
import {
  createCharacterProfile,
  deleteCharacterProfile,
  updateCharacterProfile,
  type CharacterBible,
  type CharacterProfile,
} from '@/lib/characters'
import type { SceneBible } from '@/lib/scenes'
import { SceneBiblePanel } from './SceneBiblePanel'
import { SceneLabPanel } from './SceneLabPanel'

type CreativeAssetTab = 'characters' | 'scenes' | 'scene-lab' | 'palette' | 'props' | 'camera'

interface CreativeAssetsPanelProps {
  open: boolean
  nodeTitle: string
  nodes: CanvasNode[]
  currentNodeId?: string
  projectId?: string
  characterBible: CharacterBible
  sceneBible: SceneBible
  selectedCharacterIds: string[]
  selectedSceneIds: string[]
  initialTab?: CreativeAssetTab
  initialSceneLabSourceNodeId?: string
  onCharacterBibleSave: (bible: CharacterBible) => void
  onSceneBibleSave: (bible: SceneBible) => void
  onCharacterIdsChange: (characterIds: string[]) => void
  onSceneIdsChange: (sceneIds: string[]) => void
  onSendPromptToNode?: (nodeId: string, prompt: string, sourceNodeId?: string) => void
  onSceneEditPromptChange?: (nodeId: string, prompt: string, sourceNodeId?: string) => void
  onClose: () => void
}

const TABS: Array<{ id: CreativeAssetTab; label: string }> = [
  { id: 'characters', label: '角色' },
  { id: 'scenes', label: '场景' },
  { id: 'scene-lab', label: 'Scene Lab' },
  { id: 'palette', label: '调色' },
  { id: 'props', label: '道具' },
  { id: 'camera', label: '镜头' },
]

const inputClassName = 'h-9 rounded-md border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] px-3 text-sm text-white outline-none placeholder:text-[rgba(255,255,255,0.45)] focus:border-cyan-200/60'
const textareaClassName = 'min-h-[74px] resize-y rounded-md border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-[rgba(255,255,255,0.45)] focus:border-cyan-200/60'
const compactTextareaClassName = 'min-h-[58px] resize-y rounded-md border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-[rgba(255,255,255,0.45)] focus:border-cyan-200/60'

const CHARACTER_FIELDS: Array<{
  key: keyof Pick<CharacterProfile, 'name' | 'role' | 'logline' | 'appearance' | 'ageAndTemperament' | 'costume' | 'hairstyle' | 'props' | 'behaviorRules' | 'negativeRules'>
  label: string
  placeholder: string
  multiline?: boolean
}> = [
  { key: 'name', label: '角色名', placeholder: '未来城市信使' },
  { key: 'role', label: '一句话身份', placeholder: '在雨夜城市中传递秘密文件的孤独信使' },
  { key: 'logline', label: '身份补充', placeholder: '角色在故事中的目标、关系或秘密。', multiline: true },
  { key: 'appearance', label: '外貌特征', placeholder: '黑色长风衣，冷峻眼神，瘦高身材', multiline: true },
  { key: 'ageAndTemperament', label: '年龄/气质', placeholder: '二十多岁，克制、警觉、孤独。' },
  { key: 'costume', label: '服装', placeholder: '黑色防水长风衣，深色内搭，旧皮靴', multiline: true },
  { key: 'hairstyle', label: '发型', placeholder: '短发，略凌乱，被雨水打湿' },
  { key: 'props', label: '关键道具', placeholder: '金属信筒、旧式纸质信件', multiline: true },
  { key: 'behaviorRules', label: '行为规则', placeholder: '说话简短，行动迅速，始终保护信件。', multiline: true },
  { key: 'negativeRules', label: '禁止变化项', placeholder: '不要变成儿童，不要更换红色衣服，不要变成卡通角色', multiline: true },
]

function parseKeywords(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatCharacterForCopy(character: CharacterProfile) {
  const keywords = character.referenceKeywords?.filter(Boolean).join(', ')
  return [
    `角色名：${character.name}`,
    character.role && `一句话身份：${character.role}`,
    character.logline && `身份补充：${character.logline}`,
    character.appearance && `外貌特征：${character.appearance}`,
    character.ageAndTemperament && `年龄/气质：${character.ageAndTemperament}`,
    character.costume && `服装：${character.costume}`,
    character.hairstyle && `发型：${character.hairstyle}`,
    character.props && `关键道具：${character.props}`,
    character.behaviorRules && `行为规则：${character.behaviorRules}`,
    character.negativeRules && `禁止变化项：${character.negativeRules}`,
    keywords && `参考关键词：${keywords}`,
  ].filter(Boolean).join('\n')
}

function toggleId(ids: string[], id: string, checked: boolean) {
  return checked ? [...new Set([...ids, id])] : ids.filter((item) => item !== id)
}

function BindingSummary({
  characterCount,
  sceneCount,
}: {
  characterCount: number
  sceneCount: number
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
        <div className="text-xs text-white/42">当前节点绑定角色</div>
        <div className="mt-1 text-sm font-semibold text-white/82">{characterCount} 个</div>
      </div>
      <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
        <div className="text-xs text-white/42">当前节点绑定场景</div>
        <div className="mt-1 text-sm font-semibold text-white/82">{sceneCount} 个</div>
      </div>
    </div>
  )
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/14 bg-white/[0.025] p-8 text-center">
      <div className="text-base font-semibold text-white/82">{label}</div>
      <p className="mt-2 text-sm text-white/45">即将支持</p>
    </div>
  )
}

export function CreativeAssetsPanel({
  open,
  nodeTitle,
  nodes,
  currentNodeId,
  projectId,
  characterBible,
  sceneBible,
  selectedCharacterIds,
  selectedSceneIds,
  initialTab = 'characters',
  initialSceneLabSourceNodeId,
  onCharacterBibleSave,
  onSceneBibleSave,
  onCharacterIdsChange,
  onSceneIdsChange,
  onSendPromptToNode,
  onSceneEditPromptChange,
  onClose,
}: CreativeAssetsPanelProps) {
  const [activeTab, setActiveTab] = useState<CreativeAssetTab>(initialTab)
  const [draftCharacterBible, setDraftCharacterBible] = useState<CharacterBible>(characterBible)
  const [selectedCharacterId, setSelectedCharacterId] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const wasOpenRef = useRef(false)
  const currentNode = useMemo(
    () => nodes.find((node) => node.id === currentNodeId) ?? null,
    [currentNodeId, nodes],
  )
  const currentNodeCanSeedSceneLab = currentNode?.kind === 'image' || currentNode?.kind === 'video'

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }
    if (!wasOpenRef.current) {
      setActiveTab(initialTab === 'characters' && currentNodeCanSeedSceneLab && sceneBible.scenes.length === 0 ? 'scene-lab' : initialTab)
      wasOpenRef.current = true
    }
    setDraftCharacterBible(characterBible)
    setSelectedCharacterId((current) => (
      characterBible.characters.some((character) => character.id === current)
        ? current
        : characterBible.characters[0]?.id || ''
    ))
    setCopyState('idle')
  }, [characterBible, currentNodeCanSeedSceneLab, initialTab, open, sceneBible.scenes.length])

  const selectedCharacter = useMemo(
    () => draftCharacterBible.characters.find((character) => character.id === selectedCharacterId) ?? draftCharacterBible.characters[0] ?? null,
    [draftCharacterBible.characters, selectedCharacterId],
  )
  const selectedCharacterIdSet = new Set(selectedCharacterIds)
  const selectedSceneIdSet = new Set(selectedSceneIds)

  const patchSelectedCharacter = (patch: Partial<CharacterProfile>) => {
    if (!selectedCharacter) return
    setDraftCharacterBible((current) => updateCharacterProfile(current, selectedCharacter.id, patch))
  }

  const addCharacter = () => {
    const character = createCharacterProfile()
    setDraftCharacterBible((current) => ({
      characters: [...current.characters, character],
      updatedAt: new Date().toISOString(),
    }))
    setSelectedCharacterId(character.id)
  }

  const removeSelectedCharacter = () => {
    if (!selectedCharacter) return
    const nextBible = deleteCharacterProfile(draftCharacterBible, selectedCharacter.id)
    setDraftCharacterBible(nextBible)
    setSelectedCharacterId(nextBible.characters[0]?.id || '')
    onCharacterIdsChange(selectedCharacterIds.filter((id) => id !== selectedCharacter.id))
  }

  const copySelectedCharacter = async () => {
    if (!selectedCharacter) return
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(formatCharacterForCopy(selectedCharacter))
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1400)
    } catch {
      setCopyState('failed')
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[92] flex justify-end bg-black/20"
      role="presentation"
      data-no-node-drag="true"
      data-creative-assets="true"
      onPointerDown={(event) => {
        event.stopPropagation()
        onClose()
      }}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <aside
        className="m-4 flex max-h-[86vh] w-[min(920px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#101214]/96 text-white shadow-2xl backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label="创作资产"
        data-no-node-drag="true"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        onWheelCapture={(event) => event.stopPropagation()}
      >
        <header className="border-b border-white/10 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/48">Creative Assets</p>
              <h2 className="mt-1 text-lg font-semibold text-white">创作资产</h2>
              <p className="mt-2 truncate text-sm text-white/52">{nodeTitle}</p>
            </div>
            <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10" onClick={onClose}>
              关闭
            </button>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`shrink-0 rounded-md border px-3 py-2 text-xs font-semibold transition ${activeTab === tab.id ? 'border-cyan-200/35 bg-cyan-200/12 text-cyan-50' : 'border-white/10 bg-white/[0.035] text-white/58 hover:bg-white/[0.07] hover:text-white/80'}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <BindingSummary characterCount={selectedCharacterIds.length} sceneCount={selectedSceneIds.length} />

          {activeTab === 'characters' ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white/82">角色绑定</h3>
                  {selectedCharacterIds.length ? (
                    <button type="button" className="text-xs text-white/42 hover:text-white/78" onClick={() => onCharacterIdsChange([])}>
                      清空
                    </button>
                  ) : null}
                </div>
                {draftCharacterBible.characters.length ? (
                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {draftCharacterBible.characters.map((character) => {
                      const checked = selectedCharacterIdSet.has(character.id)
                      return (
                        <label
                          key={character.id}
                          className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-2 text-xs transition ${checked ? 'border-cyan-200/30 bg-cyan-200/12' : 'border-white/8 bg-black/16 hover:bg-white/[0.06]'}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => onCharacterIdsChange(toggleId(selectedCharacterIds, character.id, event.target.checked))}
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-white/82">{character.name}</span>
                            <span className="mt-0.5 block truncate text-white/46">{character.role || character.logline || '未填写身份'}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-white/12 p-3 text-xs leading-5 text-white/45">角色库为空。可在右侧新建角色。</p>
                )}
              </section>

              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white/82">角色库 / Character Bible</h3>
                    <p className="mt-1 text-xs text-white/42">当前 {draftCharacterBible.characters.length} 个角色</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10" onClick={addCharacter}>
                      新建角色
                    </button>
                    <button type="button" className="rounded-md bg-cyan-100 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-white" onClick={() => onCharacterBibleSave(draftCharacterBible)}>
                      保存角色库
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
                  <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                    {draftCharacterBible.characters.map((character) => (
                      <button
                        key={character.id}
                        type="button"
                        className={`w-full rounded-md border px-3 py-2 text-left transition ${character.id === selectedCharacter?.id ? 'border-cyan-200/35 bg-cyan-200/12' : 'border-white/10 bg-black/16 hover:bg-white/[0.06]'}`}
                        onClick={() => setSelectedCharacterId(character.id)}
                      >
                        <span className="block truncate text-sm font-semibold text-white/86">{character.name}</span>
                        <span className="mt-1 block truncate text-xs text-white/46">{character.role || character.logline || '未填写身份'}</span>
                      </button>
                    ))}
                  </div>

                  {selectedCharacter ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold text-white">{selectedCharacter.name}</h4>
                          <p className="mt-1 text-xs text-white/42">角色 ID: {selectedCharacter.id}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10" onClick={() => { void copySelectedCharacter() }}>
                            {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制角色设定'}
                          </button>
                          <button type="button" className="rounded-md border border-red-200/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100/78 hover:bg-red-400/18" onClick={removeSelectedCharacter}>
                            删除
                          </button>
                        </div>
                      </div>
                      {CHARACTER_FIELDS.map((field) => (
                        <label key={field.key} className="grid gap-1.5">
                          <span className="text-xs font-semibold text-white/56">{field.label}</span>
                          {field.multiline ? (
                            <textarea
                              value={String(selectedCharacter[field.key] ?? '')}
                              onChange={(event) => patchSelectedCharacter({ [field.key]: event.target.value })}
                              placeholder={field.placeholder}
                              rows={3}
                              className={textareaClassName}
                            />
                          ) : (
                            <input
                              value={String(selectedCharacter[field.key] ?? '')}
                              onChange={(event) => patchSelectedCharacter({ [field.key]: event.target.value })}
                              placeholder={field.placeholder}
                              className={inputClassName}
                            />
                          )}
                        </label>
                      ))}
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold text-white/56">参考关键词</span>
                        <textarea
                          value={selectedCharacter.referenceKeywords?.join(', ') ?? ''}
                          onChange={(event) => patchSelectedCharacter({ referenceKeywords: parseKeywords(event.target.value) })}
                          placeholder="cyberpunk courier, black trench coat, metal message tube"
                          rows={2}
                          className={compactTextareaClassName}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-white/14 p-5 text-sm text-white/48">选择或新建一个角色后编辑设定。</div>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === 'scenes' ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white/82">场景绑定</h3>
                  {selectedSceneIds.length ? (
                    <button type="button" className="text-xs text-white/42 hover:text-white/78" onClick={() => onSceneIdsChange([])}>
                      清空
                    </button>
                  ) : null}
                </div>
                {sceneBible.scenes.length ? (
                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {sceneBible.scenes.map((scene) => {
                      const checked = selectedSceneIdSet.has(scene.id)
                      return (
                        <label
                          key={scene.id}
                          className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-2 text-xs transition ${checked ? 'border-cyan-200/30 bg-cyan-200/12' : 'border-white/8 bg-black/16 hover:bg-white/[0.06]'}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => onSceneIdsChange(toggleId(selectedSceneIds, scene.id, event.target.checked))}
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-white/82">{scene.name}</span>
                            <span className="mt-0.5 block truncate text-white/46">{scene.location || scene.logline || '未填写地点'}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-white/12 p-3 text-xs leading-5 text-white/48">
                    <p className="font-semibold text-white/70">场景库为空</p>
                    <p className="mt-2">你可以在右侧新建场景，或在 Scene Lab 中从当前 Image / Video 节点提取场景。</p>
                    {currentNodeCanSeedSceneLab ? (
                      <button
                        type="button"
                        className="mt-3 w-full rounded-md bg-cyan-100 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-white"
                        onClick={() => setActiveTab('scene-lab')}
                      >
                        {currentNode?.kind === 'image' ? '从当前图片提取场景' : '从当前节点提取场景'}
                      </button>
                    ) : null}
                  </div>
                )}
              </section>

              <SceneBiblePanel
                open
                embedded
                bible={sceneBible}
                onSave={onSceneBibleSave}
                onOpenSceneLab={() => setActiveTab('scene-lab')}
              />
            </div>
          ) : null}

          {activeTab === 'scene-lab' ? (
            <div className="mt-4">
              <SceneLabPanel
                nodes={nodes}
                projectId={projectId}
                currentNode={currentNode}
                currentNodeId={currentNodeId}
                sceneBible={sceneBible}
                selectedSceneIds={selectedSceneIds}
                initialSourceNodeId={initialSceneLabSourceNodeId}
                onSaveScene={(scene) => {
                  const nextBible = {
                    scenes: [...sceneBible.scenes.filter((item) => item.id !== scene.id), scene],
                    updatedAt: new Date().toISOString(),
                  }
                  onSceneBibleSave(nextBible)
                }}
                onSceneIdsChange={onSceneIdsChange}
                onSendPromptToNode={onSendPromptToNode}
                onSceneEditPromptChange={onSceneEditPromptChange}
              />
            </div>
          ) : null}

          {activeTab === 'palette' ? <div className="mt-4"><PlaceholderTab label="调色库" /></div> : null}
          {activeTab === 'props' ? <div className="mt-4"><PlaceholderTab label="道具库" /></div> : null}
          {activeTab === 'camera' ? <div className="mt-4"><PlaceholderTab label="镜头库" /></div> : null}
        </div>
      </aside>
    </div>
  )
}
