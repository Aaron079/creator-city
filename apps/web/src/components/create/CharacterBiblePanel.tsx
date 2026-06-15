'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createCharacterProfile,
  deleteCharacterProfile,
  updateCharacterProfile,
  type CharacterBible,
  type CharacterProfile,
} from '@/lib/characters'

interface CharacterBiblePanelProps {
  open: boolean
  bible: CharacterBible
  onClose: () => void
  onSave: (bible: CharacterBible) => void
}

type QuickTag = { label: string }

const CHARACTER_FIELDS: Array<{
  key: keyof Pick<CharacterProfile, 'name' | 'role' | 'logline' | 'appearance' | 'ageAndTemperament' | 'costume' | 'hairstyle' | 'props' | 'behaviorRules' | 'negativeRules'>
  label: string
  placeholder: string
  multiline?: boolean
  quickTags?: QuickTag[]
}> = [
  { key: 'name', label: '角色名', placeholder: '未来城市信使' },
  {
    key: 'role',
    label: '一句话身份',
    placeholder: '在雨夜城市中传递秘密文件的孤独信使',
    quickTags: [
      { label: '主角' }, { label: '反派' }, { label: '导师' },
      { label: '搭档' }, { label: '神秘人' }, { label: '群演' },
    ],
  },
  { key: 'logline', label: '身份补充', placeholder: '角色在故事中的目标、关系或秘密。', multiline: true },
  {
    key: 'appearance',
    label: '外貌特征',
    placeholder: '黑色长风衣，冷峻眼神，瘦高身材',
    multiline: true,
    quickTags: [
      { label: '银发' }, { label: '黑衣' }, { label: '伤疤' },
      { label: '机械义肢' }, { label: '雨衣' }, { label: '制服' }, { label: '霓虹反光' },
    ],
  },
  {
    key: 'ageAndTemperament',
    label: '年龄/气质',
    placeholder: '二十多岁，克制、警觉、孤独。',
    quickTags: [
      { label: '冷静' }, { label: '冲动' }, { label: '疲惫' },
      { label: '孤独' }, { label: '危险' }, { label: '温柔' }, { label: '精准' },
    ],
  },
  {
    key: 'costume',
    label: '服装',
    placeholder: '黑色防水长风衣，深色内搭，旧皮靴',
    multiline: true,
    quickTags: [
      { label: '风衣' }, { label: '制服' }, { label: '战甲' },
      { label: '便服' }, { label: '礼服' }, { label: '伪装服' },
    ],
  },
  { key: 'hairstyle', label: '发型', placeholder: '短发，略凌乱，被雨水打湿' },
  {
    key: 'props',
    label: '关键道具',
    placeholder: '金属信筒、旧式纸质信件',
    multiline: true,
    quickTags: [
      { label: '手电' }, { label: '相机' }, { label: '终端机' },
      { label: '武器' }, { label: '日记' }, { label: '耳机' },
    ],
  },
  { key: 'behaviorRules', label: '行为规则', placeholder: '说话简短，行动迅速，始终保护信件。', multiline: true },
  { key: 'negativeRules', label: '禁止变化项', placeholder: '不要变成儿童，不要更换红色衣服，不要变成卡通角色', multiline: true },
]

function appendToField(current: string, tag: string): string {
  const c = current.trim()
  if (!c) return tag
  if (c.includes(tag)) return current
  return c + '、' + tag
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

function parseKeywords(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function CharacterBiblePanel({
  open,
  bible,
  onClose,
  onSave,
}: CharacterBiblePanelProps) {
  const [draftBible, setDraftBible] = useState<CharacterBible>(bible)
  const [selectedId, setSelectedId] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (!open) return
    setDraftBible(bible)
    setSelectedId((current) => (
      bible.characters.some((character) => character.id === current)
        ? current
        : bible.characters[0]?.id || ''
    ))
    setCopyState('idle')
  }, [bible, open])

  const selectedCharacter = useMemo(
    () => draftBible.characters.find((character) => character.id === selectedId) ?? draftBible.characters[0] ?? null,
    [draftBible.characters, selectedId],
  )

  const patchSelected = (patch: Partial<CharacterProfile>) => {
    if (!selectedCharacter) return
    setDraftBible((current) => updateCharacterProfile(current, selectedCharacter.id, patch))
  }

  const addCharacter = () => {
    const character = createCharacterProfile()
    setDraftBible((current) => ({
      characters: [...current.characters, character],
      updatedAt: new Date().toISOString(),
    }))
    setSelectedId(character.id)
  }

  const removeSelected = () => {
    if (!selectedCharacter) return
    const nextBible = deleteCharacterProfile(draftBible, selectedCharacter.id)
    setDraftBible(nextBible)
    setSelectedId(nextBible.characters[0]?.id || '')
  }

  const copySelected = async () => {
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
      data-character-bible="true"
      onPointerDown={(event) => {
        event.stopPropagation()
        onClose()
      }}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <aside
        className="m-4 flex max-h-[84vh] w-[min(760px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#101214]/96 text-white shadow-2xl backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label="角色库 / Character Bible"
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
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/48">Character Bible</p>
              <h2 className="mt-1 text-lg font-semibold text-white">角色库 / Character Bible</h2>
              <p className="mt-2 text-sm text-white/52">当前 {draftBible.characters.length} 个角色</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10" onClick={addCharacter}>
                新建角色
              </button>
              <button
                type="button"
                className="rounded-md bg-cyan-100 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-white"
                onClick={() => onSave(draftBible)}
              >
                保存角色库
              </button>
              <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10" onClick={onClose}>
                关闭
              </button>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)] overflow-hidden max-md:grid-cols-1">
          <div className="min-h-0 overflow-y-auto border-r border-white/10 p-4 max-md:max-h-44 max-md:border-b max-md:border-r-0">
            {draftBible.characters.length ? (
              <div className="space-y-2">
                {draftBible.characters.map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    className={`w-full rounded-md border px-3 py-2 text-left transition ${character.id === selectedCharacter?.id ? 'border-cyan-200/35 bg-cyan-200/12' : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.07]'}`}
                    onClick={() => setSelectedId(character.id)}
                  >
                    <span className="block truncate text-sm font-semibold text-white/86">{character.name}</span>
                    <span className="mt-1 block truncate text-xs text-white/46">{character.role || character.logline || '未填写身份'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/14 p-4 text-sm text-white/48">
                还没有角色。点击“新建角色”创建第一位角色。
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            {selectedCharacter ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-white">{selectedCharacter.name}</h3>
                    <p className="mt-1 text-xs text-white/42">角色 ID: {selectedCharacter.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10" onClick={() => { void copySelected() }}>
                      {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制角色设定'}
                    </button>
                    <button type="button" className="rounded-md border border-red-200/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100/78 hover:bg-red-400/18" onClick={removeSelected}>
                      删除
                    </button>
                  </div>
                </div>

                <div className="grid gap-3">
                  {CHARACTER_FIELDS.map((field) => (
                    <div key={field.key} className="grid gap-1.5">
                      <span className="text-xs font-semibold text-white/56">{field.label}</span>
                      {field.quickTags && field.quickTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {field.quickTags.map((tag) => (
                            <button
                              key={tag.label}
                              type="button"
                              onClick={() => patchSelected({ [field.key]: appendToField(String(selectedCharacter[field.key] ?? ''), tag.label) })}
                              className="inline-flex items-center rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[9px] text-white/40 transition hover:border-cyan-400/30 hover:bg-cyan-500/[0.07] hover:text-cyan-200/80"
                            >
                              {tag.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {field.multiline ? (
                        <textarea
                          value={String(selectedCharacter[field.key] ?? '')}
                          onChange={(event) => patchSelected({ [field.key]: event.target.value })}
                          placeholder={field.placeholder}
                          rows={3}
                          className="min-h-[74px] resize-y rounded-md border border-white/10 bg-black/22 px-3 py-2 text-sm leading-6 text-white/82 outline-none placeholder:text-white/28 focus:border-cyan-200/36"
                        />
                      ) : (
                        <input
                          value={String(selectedCharacter[field.key] ?? '')}
                          onChange={(event) => patchSelected({ [field.key]: event.target.value })}
                          placeholder={field.placeholder}
                          className="h-9 rounded-md border border-white/10 bg-black/22 px-3 text-sm text-white/82 outline-none placeholder:text-white/28 focus:border-cyan-200/36"
                        />
                      )}
                    </div>
                  ))}

                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-white/56">参考关键词</span>
                    <textarea
                      value={selectedCharacter.referenceKeywords?.join(', ') ?? ''}
                      onChange={(event) => patchSelected({ referenceKeywords: parseKeywords(event.target.value) })}
                      placeholder="cyberpunk courier, black trench coat, metal message tube"
                      rows={2}
                      className="min-h-[58px] resize-y rounded-md border border-white/10 bg-black/22 px-3 py-2 text-sm leading-6 text-white/82 outline-none placeholder:text-white/28 focus:border-cyan-200/36"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/14 p-5 text-sm text-white/48">
                选择或新建一个角色后编辑设定。
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
