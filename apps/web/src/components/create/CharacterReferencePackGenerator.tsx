'use client'

import { useState } from 'react'
import type { CharacterBible, CharacterProfile, CharacterReferenceAsset } from '@/lib/characters'
import { addReferenceToCharacter, createReferenceAsset } from '@/lib/characters'
import type { VisualCanvasNode } from './CanvasNodeCard'

type Template = 'four-shot' | 'four-view' | 'nine-grid' | 'expression' | 'costume'

type PlanItem = {
  kind: string
  label: string
  prompt: string
  status: 'pending' | 'running' | 'done' | 'error'
  imageUrl?: string
  errorMessage?: string
}

const TEMPLATES: Record<Template, { label: string; description: string; items: Pick<PlanItem, 'kind' | 'label' | 'prompt'>[] }> = {
  'four-shot': {
    label: '四景别',
    description: '全身 · 中景 · 近景 · 特写',
    items: [
      { kind: 'full-body', label: '全身', prompt: '生成该角色的全身参考图，站立姿态，完整展示服装、身形和关键道具。' },
      { kind: 'medium-shot', label: '中景', prompt: '生成该角色中景参考图，从膝盖或腰部以上，保持服装和气质一致。' },
      { kind: 'close-up', label: '近景', prompt: '生成该角色近景参考图，突出脸部、发型、眼神和上半身细节。' },
      { kind: 'extreme-close-up', label: '特写', prompt: '生成该角色特写参考图，突出面部特征和眼神，保持同一人物。' },
    ],
  },
  'four-view': {
    label: '四视图',
    description: '正面 · 侧面 · 背面 · 3/4',
    items: [
      { kind: 'front', label: '正面', prompt: '生成该角色正面参考图，完整展示正面外貌、服装和道具。' },
      { kind: 'side', label: '侧面', prompt: '生成该角色侧面参考图，展示侧面轮廓、发型和服装细节。' },
      { kind: 'back', label: '背面', prompt: '生成该角色背面参考图，展示背面服装、发型背面和道具。' },
      { kind: 'three-quarter', label: '3/4 角度', prompt: '生成该角色 3/4 角度参考图，兼顾正面和侧面特征。' },
    ],
  },
  'nine-grid': {
    label: '九宫格',
    description: '全面参考资产包（9张独立图）',
    items: [
      { kind: 'full-body', label: '全身', prompt: '生成该角色的全身参考图，站立姿态，完整展示服装、身形和关键道具。' },
      { kind: 'medium-shot', label: '中景', prompt: '生成该角色中景参考图，从膝盖或腰部以上，保持服装和气质一致。' },
      { kind: 'close-up', label: '近景', prompt: '生成该角色近景参考图，突出脸部、发型、眼神和上半身细节。' },
      { kind: 'extreme-close-up', label: '特写', prompt: '生成该角色特写参考图，突出面部特征和眼神，保持同一人物。' },
      { kind: 'front', label: '正面', prompt: '生成该角色正面参考图，完整展示正面外貌、服装和道具。' },
      { kind: 'side', label: '侧面', prompt: '生成该角色侧面参考图，展示侧面轮廓、发型和服装细节。' },
      { kind: 'back', label: '背面', prompt: '生成该角色背面参考图，展示背面服装、发型背面和道具。' },
      { kind: 'expression', label: '表情', prompt: '生成该角色表情特写，展示丰富的表情变化，保持脸型和年龄一致。' },
      { kind: 'costume', label: '服装/道具细节', prompt: '生成该角色服装和道具细节参考图，展示服装材质、道具细节和配饰。' },
    ],
  },
  'expression': {
    label: '表情包',
    description: '平静 · 微笑 · 愤怒 · 悲伤 · 紧张 · 疲惫',
    items: [
      { kind: 'expression', label: '平静', prompt: '生成该角色平静表情参考图，自然、放松的面部状态。' },
      { kind: 'expression', label: '微笑', prompt: '生成该角色微笑表情参考图，展示自然的笑容，保持角色气质。' },
      { kind: 'expression', label: '愤怒', prompt: '生成该角色愤怒表情参考图，眉头紧锁，眼神锐利，保持角色外貌一致。' },
      { kind: 'expression', label: '悲伤', prompt: '生成该角色悲伤表情参考图，展示内敛的情绪，保持角色外貌一致。' },
      { kind: 'expression', label: '紧张', prompt: '生成该角色紧张表情参考图，警觉状态，眼神专注，保持角色外貌一致。' },
      { kind: 'expression', label: '疲惫', prompt: '生成该角色疲惫表情参考图，展示疲倦状态，保持角色外貌一致。' },
    ],
  },
  'costume': {
    label: '服装道具包',
    description: '服装 · 鞋 · 配饰 · 道具 · 手持物',
    items: [
      { kind: 'costume', label: '服装细节', prompt: '生成该角色服装细节参考图，展示服装材质、纹理和设计细节。' },
      { kind: 'costume', label: '鞋履', prompt: '生成该角色鞋履细节参考图，展示脚部穿着细节。' },
      { kind: 'costume', label: '配饰', prompt: '生成该角色配饰参考图，展示帽子、项链、手链等配饰细节。' },
      { kind: 'prop', label: '关键道具', prompt: '生成该角色关键道具的特写参考图，展示道具细节、材质和设计。' },
      { kind: 'prop', label: '手持物', prompt: '生成该角色手持物参考图，展示角色拿着标志性道具的样态。' },
    ],
  },
}

type ApiReferenceResult = {
  id: string
  characterId: string
  kind: string
  label: string
  imageUrl: string
  sourceImageUrl: string
  providerId: string
  model?: string
  generationTemplate?: string
  createdAt: string
}

type ApiErrorItem = {
  kind: string
  label: string
  errorCode?: string
  message: string
}

interface CharacterReferencePackGeneratorProps {
  characterBible: CharacterBible
  currentNode: VisualCanvasNode | null
  onSaveCharacterBible: (bible: CharacterBible) => void
}

function itemStatusIcon(status: PlanItem['status']) {
  if (status === 'done') return '✓'
  if (status === 'error') return '✕'
  if (status === 'running') return '…'
  return '○'
}

function itemStatusClass(status: PlanItem['status']) {
  if (status === 'done') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
  if (status === 'error') return 'border-red-400/30 bg-red-400/10 text-red-100'
  if (status === 'running') return 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
  return 'border-white/10 bg-white/[0.04] text-white/60'
}

export function CharacterReferencePackGenerator({
  characterBible,
  currentNode,
  onSaveCharacterBible,
}: CharacterReferencePackGeneratorProps) {
  const sourceImageUrl = currentNode?.kind === 'image' ? (currentNode.resultImageUrl ?? '') : ''
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    characterBible.characters[0]?.id ?? '',
  )
  const [selectedTemplate, setSelectedTemplate] = useState<Template>('four-shot')
  const [planItems, setPlanItems] = useState<PlanItem[]>(() =>
    TEMPLATES['four-shot'].items.map((item) => ({ ...item, status: 'pending' as const })),
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationDone, setGenerationDone] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [completedRefs, setCompletedRefs] = useState<CharacterReferenceAsset[]>([])

  const selectedCharacter: CharacterProfile | null =
    characterBible.characters.find((c) => c.id === selectedCharacterId) ?? characterBible.characters[0] ?? null

  function selectTemplate(template: Template) {
    if (isGenerating) return
    setSelectedTemplate(template)
    setPlanItems(TEMPLATES[template].items.map((item) => ({ ...item, status: 'pending' as const })))
    setGenerationDone(false)
    setCompletedRefs([])
    setGlobalError('')
  }

  async function handleGenerate() {
    if (!selectedCharacter) { setGlobalError('请先选择或新建一个角色。'); return }
    if (!sourceImageUrl) { setGlobalError('当前节点没有可用的角色源图，请先确保当前 Image 节点已生成图片。'); return }

    setIsGenerating(true)
    setGenerationDone(false)
    setGlobalError('')
    setCompletedRefs([])
    setPlanItems((prev) => prev.map((item) => ({ ...item, status: 'pending', imageUrl: undefined, errorMessage: undefined })))

    const templateDef = TEMPLATES[selectedTemplate]
    const newRefs: CharacterReferenceAsset[] = []

    for (let i = 0; i < planItems.length; i++) {
      const item = templateDef.items[i]
      if (!item) continue
      setPlanItems((prev) => prev.map((p, idx) => idx === i ? { ...p, status: 'running' } : p))

      try {
        const res = await fetch('/api/generate/character-reference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceImageUrl,
            characterId: selectedCharacter.id,
            template: selectedTemplate,
            items: [item],
            providerId: 'volcengine-seedream-image',
          }),
        })
        const data = await res.json() as {
          success: boolean
          references?: ApiReferenceResult[]
          errors?: ApiErrorItem[]
          errorCode?: string
          message?: string
        }

        const apiRef = data.references?.[0]
        if (data.success && apiRef) {
          const ref = createReferenceAsset({
            id: apiRef.id,
            characterId: selectedCharacter.id,
            kind: item.kind as CharacterReferenceAsset['kind'],
            label: item.label,
            imageUrl: apiRef.imageUrl,
            sourceImageUrl,
            sourceNodeId: currentNode?.id,
            providerId: apiRef.providerId,
            model: apiRef.model,
            generationTemplate: selectedTemplate,
          })
          newRefs.push(ref)
          setPlanItems((prev) => prev.map((p, idx) => idx === i ? { ...p, status: 'done', imageUrl: apiRef.imageUrl } : p))
        } else {
          const errMsg = data.errors?.[0]?.message ?? data.message ?? '生成失败'
          setPlanItems((prev) => prev.map((p, idx) => idx === i ? { ...p, status: 'error', errorMessage: errMsg } : p))
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '请求失败'
        setPlanItems((prev) => prev.map((p, idx) => idx === i ? { ...p, status: 'error', errorMessage: errMsg } : p))
      }
    }

    if (newRefs.length > 0) {
      let updatedBible = characterBible
      for (const ref of newRefs) {
        updatedBible = addReferenceToCharacter(updatedBible, selectedCharacter.id, ref)
      }
      onSaveCharacterBible(updatedBible)
      setCompletedRefs(newRefs)
    }

    setIsGenerating(false)
    setGenerationDone(true)
  }

  function resetPlan() {
    setPlanItems(TEMPLATES[selectedTemplate].items.map((item) => ({ ...item, status: 'pending' as const })))
    setGenerationDone(false)
    setCompletedRefs([])
    setGlobalError('')
  }

  const doneCount = planItems.filter((p) => p.status === 'done').length
  const errorCount = planItems.filter((p) => p.status === 'error').length

  return (
    <div className="space-y-5">
      {/* Source image */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 text-sm font-semibold text-white/82">角色源图</h3>
        {sourceImageUrl ? (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sourceImageUrl}
              alt="角色源图"
              className="h-24 w-24 shrink-0 rounded-lg object-cover"
              draggable={false}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white/82">当前 Image 节点</p>
              <p className="mt-1 truncate text-xs text-white/48">{currentNode?.title ?? '未命名节点'}</p>
              <p className="mt-2 text-[10px] leading-5 text-emerald-300/80">✓ 已就绪，可作为参考图生成参考包</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/14 p-4 text-xs leading-6 text-white/48">
            <p className="font-semibold text-white/62">未找到角色源图</p>
            <p className="mt-1">请先选择已生成图片的 Image 节点，或在画布上选中满意的角色图片后重新打开此面板。</p>
          </div>
        )}
      </section>

      {/* Character selection */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 text-sm font-semibold text-white/82">绑定角色</h3>
        {characterBible.characters.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {characterBible.characters.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={isGenerating}
                onClick={() => setSelectedCharacterId(c.id)}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${selectedCharacterId === c.id ? 'border-cyan-300/40 bg-cyan-300/12 text-cyan-50' : 'border-white/10 bg-white/[0.04] text-white/62 hover:bg-white/10'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/48">角色库为空，请先在&ldquo;角色设定&rdquo;中新建角色。</p>
        )}
      </section>

      {/* Template selection */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 text-sm font-semibold text-white/82">参考包模板</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {(Object.entries(TEMPLATES) as [Template, typeof TEMPLATES[Template]][]).map(([key, tpl]) => (
            <button
              key={key}
              type="button"
              disabled={isGenerating}
              onClick={() => selectTemplate(key)}
              className={`flex flex-col rounded-lg border px-3 py-2.5 text-left transition ${selectedTemplate === key ? 'border-cyan-300/40 bg-cyan-300/12' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'}`}
            >
              <span className={`text-xs font-semibold ${selectedTemplate === key ? 'text-cyan-50' : 'text-white/82'}`}>
                {tpl.label}
              </span>
              <span className="mt-1 text-[10px] leading-4 text-white/44">{tpl.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Generation plan */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white/82">
            生成计划 — {TEMPLATES[selectedTemplate].label}
            <span className="ml-2 text-xs font-normal text-white/44">({planItems.length} 张独立参考图)</span>
          </h3>
          {generationDone && (
            <button type="button" onClick={resetPlan} className="text-xs text-white/42 hover:text-white/78">
              重置
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {planItems.map((item, idx) => (
            <div
              key={idx}
              className={`relative flex flex-col overflow-hidden rounded-lg border transition ${itemStatusClass(item.status)}`}
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.label} className="aspect-square w-full object-cover" draggable={false} />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center text-2xl opacity-40">
                  {itemStatusIcon(item.status)}
                </div>
              )}
              <div className="px-2 py-1.5">
                <p className="text-[10px] font-semibold">{item.label}</p>
                {item.status === 'running' && (
                  <p className="mt-0.5 text-[10px] text-cyan-200/70">生成中…</p>
                )}
                {item.errorMessage && (
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-red-200/80">{item.errorMessage}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {generationDone && (
          <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${doneCount > 0 ? 'border-emerald-400/20 bg-emerald-400/8 text-emerald-100/80' : 'border-red-400/20 bg-red-400/8 text-red-100/80'}`}>
            {doneCount > 0 && errorCount === 0 && `✓ 全部完成，${doneCount} 张参考图已加入角色资产板。`}
            {doneCount > 0 && errorCount > 0 && `部分完成：${doneCount} 张成功，${errorCount} 张失败。成功的已加入资产板。`}
            {doneCount === 0 && '全部生成失败，请检查 Provider 配置后重试。'}
          </div>
        )}
      </section>

      {/* Cost warning + generate button */}
      <section className="rounded-xl border border-amber-400/18 bg-amber-400/[0.06] p-4">
        <div className="mb-3 flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-amber-300/70">⚠</span>
          <p className="text-xs leading-5 text-amber-100/70">
            <strong className="text-amber-100/90">会消耗 Provider API 额度。</strong>
            每张参考图独立调用图片生成 API。{planItems.length} 张图片共消耗约 {planItems.length} 次调用。平台本身不收费，但会使用你在 /admin/providers 配置的 API Key 的额度。
          </p>
        </div>

        {globalError && (
          <div className="mb-3 rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-100/80">
            {globalError}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isGenerating || !sourceImageUrl || !selectedCharacter}
            onClick={() => { void handleGenerate() }}
            className="rounded-md bg-cyan-100 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isGenerating ? `生成中…（${doneCount}/${planItems.length}）` : generationDone ? '重新生成' : '生成角色参考包'}
          </button>
          {!sourceImageUrl && (
            <p className="self-center text-xs text-white/44">需要先选中有图片的 Image 节点</p>
          )}
          {!selectedCharacter && sourceImageUrl && (
            <p className="self-center text-xs text-white/44">需要先选择角色</p>
          )}
        </div>
      </section>

      {/* Completed thumbnails */}
      {completedRefs.length > 0 && (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-3 text-sm font-semibold text-white/82">
            已生成参考图
            <span className="ml-2 text-xs font-normal text-white/44">（已自动加入参考资产板）</span>
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {completedRefs.map((ref) => (
              <div key={ref.id} className="flex flex-col overflow-hidden rounded-lg border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ref.imageUrl} alt={ref.label} className="aspect-square w-full object-cover" draggable={false} />
                <p className="px-2 py-1 text-[10px] font-semibold text-white/70">{ref.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
