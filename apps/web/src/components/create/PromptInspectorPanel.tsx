'use client'

import { useMemo, useState, type ReactNode } from 'react'
import type { VisualCanvasNode as CanvasNode } from '@/components/create/CanvasNodeCard'
import type { CharacterProfile } from '@/lib/characters'
import { CHARACTER_REFERENCE_KIND_LABELS, getHeroReference } from '@/lib/characters'
import { getSceneEdits, getSceneEditTasks, getSceneEditTaskOption, getSceneEditToolOption, type SceneProfile } from '@/lib/scenes'
import type { CreatorSkill, CreatorSkillTarget, ProjectStyleBible } from '@/lib/skills'
import { getNodeImageUrl, getNodeVideoUrl } from '@/lib/canvas/media-urls'
import { asAssetIntelligence } from '@/lib/asset-intelligence'
import { AssetIntelligencePanel } from './AssetIntelligencePanel'

interface PromptInspectorPanelProps {
  open: boolean
  node: CanvasNode | null
  upstreamNodes?: CanvasNode[]
  styleBible?: ProjectStyleBible | null
  enabledSkills?: CreatorSkill[]
  characterContext?: {
    boundCharacters: CharacterProfile[]
    inheritedCharacters: CharacterProfile[]
    inheritedCharacterIdsFromEdges: string[]
    lockCharacterConsistency: boolean
  } | null
  sceneContext?: {
    boundScenes: SceneProfile[]
    inheritedScenes: SceneProfile[]
    inheritedSceneIdsFromEdges: string[]
    lockSceneConsistency: boolean
  } | null
  onClose: () => void
}

type CopyTarget = 'prompt' | 'upstream' | 'compiled'
type CopyState = Partial<Record<CopyTarget, 'copied' | 'failed'>>

const STYLE_BIBLE_FIELDS: Array<{ key: keyof ProjectStyleBible; label: string }> = [
  { key: 'logline', label: 'logline' },
  { key: 'storyWorld', label: 'storyWorld' },
  { key: 'visualStyle', label: 'visualStyle' },
  { key: 'colorPalette', label: 'colorPalette' },
  { key: 'cameraLanguage', label: 'cameraLanguage' },
  { key: 'characterRules', label: 'characterRules' },
  { key: 'sceneRules', label: 'sceneRules' },
  { key: 'negativeRules', label: 'negativeRules' },
]

function metadataRecord(metadataJson: unknown) {
  return metadataJson && typeof metadataJson === 'object' && !Array.isArray(metadataJson)
    ? metadataJson as Record<string, unknown>
    : {}
}

function nestedRecord(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function displayValue(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value == null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function isLikelyTemporaryUrl(url: string) {
  const lower = url.toLowerCase()
  return [
    'x-tos-expires',
    'x-tos-signature',
    'x-amz-expires',
    'x-amz-signature',
    'x-oss-expires',
    'x-oss-signature',
    'expires=',
    'signature=',
    'security-token=',
  ].some((pattern) => lower.includes(pattern))
}

function mediaPersistenceStatus(value: unknown) {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  if (record.status === 'persisted' || record.ok === true) return 'persisted'
  if (record.status === 'failed' || record.ok === false || record.errorCode) return 'failed'
  return 'missing'
}

function compactText(value: string, limit: number) {
  const text = value.trim()
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

function characterSummary(character: CharacterProfile) {
  return [
    character.role || character.logline,
    character.appearance,
    character.costume,
    character.hairstyle,
    character.props,
  ].filter(Boolean).join(' · ')
}

function sceneSummary(scene: SceneProfile) {
  return [
    scene.location,
    scene.era,
    scene.atmosphere,
    scene.architecture,
    scene.lighting,
    scene.weather,
  ].filter(Boolean).join(' · ')
}

function formatDateValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
  }
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
  }
  return ''
}

function isPromptNodeKind(kind: CanvasNode['kind']): kind is CreatorSkillTarget {
  return kind === 'text' || kind === 'image' || kind === 'video'
}

function statusLabel(status: CanvasNode['status']) {
  if (status === 'queued') return '排队中'
  if (status === 'running' || status === 'generating') return '运行中'
  if (status === 'done') return '完成'
  if (status === 'error') return '失败'
  return '待运行'
}

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white/86">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function CopyButton({
  label,
  copiedLabel = '已复制',
  state,
  onCopy,
}: {
  label: string
  copiedLabel?: string
  state?: 'copied' | 'failed'
  onCopy: () => void
}) {
  return (
    <button
      type="button"
      className="inline-flex h-7 items-center rounded-md border border-white/10 bg-white/[0.06] px-2.5 text-xs font-medium text-white/72 transition hover:border-cyan-200/25 hover:bg-cyan-200/10 hover:text-cyan-50"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onCopy()
      }}
    >
      {state === 'copied' ? copiedLabel : state === 'failed' ? '复制失败，请手动选择文本。' : label}
    </button>
  )
}

export function PromptInspectorPanel({
  open,
  node,
  upstreamNodes = [],
  styleBible,
  enabledSkills = [],
  characterContext,
  sceneContext,
  onClose,
}: PromptInspectorPanelProps) {
  const [copyState, setCopyState] = useState<CopyState>({})
  const [compiledExpanded, setCompiledExpanded] = useState(false)
  const metadata = useMemo(() => metadataRecord(node?.metadataJson), [node?.metadataJson])
  const compiledDebug = useMemo(() => nestedRecord(metadata, 'compiledPromptDebug'), [metadata])
  const lastError = metadata.lastError ?? node?.errorMessage

  const providerId = node?.providerId
    || stringValue(metadata.providerId)
    || stringValue(compiledDebug.providerId)
  const model = stringValue(metadata.model) || node?.model || ''
  const rawPrompt = node?.prompt?.trim() || ''
  const upstreamText = useMemo(() => {
    const fromNodes = upstreamNodes
      .map((item) => item.resultText || (item.kind === 'text' ? item.resultPreview || item.outputLabel : ''))
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n\n')
    return fromNodes
      || stringValue(metadata.upstreamText)
      || stringValue(compiledDebug.upstreamText)
  }, [compiledDebug, metadata, upstreamNodes])
  const upstreamImageUrls = upstreamNodes
    .map((item) => item.resultImageUrl)
    .filter((value): value is string => Boolean(value))
  const nodeGenerationJobId = node && 'generationJobId' in node
    ? stringValue((node as { generationJobId?: unknown }).generationJobId)
    : ''
  const compiledPromptPreview = stringValue(metadata.compiledPromptPreview)
  const sceneEditPromptPreview = stringValue(metadata.sceneEditPromptPreview)
  const sceneEditPromptSourceNodeId = stringValue(metadata.sceneEditPromptSourceNodeId)
  const scenePluginType = stringValue(metadata.scenePluginType)
  const scenePluginSourceNodeId = stringValue(metadata.sourceImageNodeId)
  const scenePluginSourceImageUrl = stringValue(metadata.sourceImageUrl)
  const scenePluginResultImageUrl = scenePluginType ? (node?.resultImageUrl || '') : ''
  const scenePluginPreserveInstruction = stringValue(metadata.preserveInstruction)
  const scenePluginNegativeInstruction = stringValue(metadata.negativeInstruction)
  const sceneReplacePrompt = stringValue(metadata.sceneReplacePrompt) || rawPrompt
  const sceneEdits = useMemo(() => getSceneEdits(node?.metadataJson), [node?.metadataJson])
  const sceneEditTasks = useMemo(() => getSceneEditTasks(node?.metadataJson), [node?.metadataJson])
  const generationIdInputs: Array<[string, unknown]> = [
    ['generationJobId', metadata.generationJobId || nodeGenerationJobId],
    ['taskId', metadata.taskId],
  ]
  const generationIds = generationIdInputs.filter(([, value]) => Boolean(value))
  const timeFieldInputs: Array<[string, unknown]> = [
    ['createdAt', node?.createdAt],
    ['updatedAt', metadata.updatedAt],
    ['submittedAt', metadata.submittedAt],
    ['completedAt', metadata.completedAt],
  ]
  const timeFields = timeFieldInputs
    .map(([label, value]) => [label, formatDateValue(value)] as const)
    .filter(([, value]) => value)
  const nodeKind = node?.kind
  const applicableSkills = nodeKind && isPromptNodeKind(nodeKind)
    ? enabledSkills.filter((skill) => skill.appliesTo.includes(nodeKind))
    : enabledSkills
  const hasStyleBible = STYLE_BIBLE_FIELDS.some((field) => stringValue(styleBible?.[field.key]))
  const resultSummary = node?.kind === 'text'
    ? compactText(node.resultText || '', 500)
    : node?.kind === 'image'
      ? node.resultImageUrl || ''
      : node?.kind === 'video'
        ? node.resultVideoUrl || ''
        : ''
  const mediaType = node?.kind === 'image' || node?.kind === 'video' ? node.kind : null
  const assetUrl = stringValue(metadata.assetUrl)
  const originalProviderUrl = mediaType === 'image'
    ? stringValue(metadata.originalProviderImageUrl)
    : mediaType === 'video'
      ? stringValue(metadata.originalProviderVideoUrl)
      : ''
  const currentMediaUrl = mediaType === 'image'
    ? getNodeImageUrl(node)
    : mediaType === 'video'
      ? getNodeVideoUrl(node)
      : ''
  const mediaStatusItems: Array<[string, unknown]> = [
    ['resultImageUrl', node?.resultImageUrl],
    ['resultVideoUrl', node?.resultVideoUrl],
    ['assetUrl', assetUrl],
    ['originalProvider URL', originalProviderUrl],
    ['mediaPersistence', mediaPersistenceStatus(metadata.mediaPersistence)],
    ['当前 URL 是否稳定资产', currentMediaUrl && assetUrl && currentMediaUrl === assetUrl && mediaPersistenceStatus(metadata.mediaPersistence) === 'persisted' ? '是' : '否'],
    ['是否临时外链', currentMediaUrl && isLikelyTemporaryUrl(currentMediaUrl) ? '是' : '否'],
    ['最近诊断结果', metadata.mediaDiagnostics ?? metadata.mediaResyncDiagnostic ?? metadata.mediaResync],
  ]
  const assetIntelligence = asAssetIntelligence(metadata.assetIntelligence)
  const debugItems: Array<[string, unknown]> = [
    ['compiledPromptDebug', compiledDebug],
    ['lastError', lastError],
    ['providerId', providerId],
    ['model', model],
    ...generationIds,
  ]
  const boundCharacters = characterContext?.boundCharacters ?? []
  const inheritedCharacters = characterContext?.inheritedCharacters ?? []
  const hasCharacters = boundCharacters.length > 0 || inheritedCharacters.length > 0
  const boundScenes = sceneContext?.boundScenes ?? []
  const inheritedScenes = sceneContext?.inheritedScenes ?? []
  const hasScenes = boundScenes.length > 0 || inheritedScenes.length > 0

  const copyText = async (target: CopyTarget, text: string) => {
    try {
      if (!text.trim() || !navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(text)
      setCopyState((current) => ({ ...current, [target]: 'copied' }))
      window.setTimeout(() => {
        setCopyState((current) => ({ ...current, [target]: undefined }))
      }, 1600)
    } catch {
      setCopyState((current) => ({ ...current, [target]: 'failed' }))
    }
  }

  if (!open || !node) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex justify-end bg-black/10"
      role="presentation"
      data-no-node-drag="true"
      data-prompt-inspector="true"
      onPointerDown={(event) => {
        event.stopPropagation()
        onClose()
      }}
      onClick={(event) => {
        event.stopPropagation()
      }}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <aside
        className="m-4 flex max-h-[80vh] w-[min(460px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#101214]/95 text-white shadow-2xl backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label="生成依据 / Prompt Inspector"
        data-no-node-drag="true"
        data-prompt-inspector="true"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        onWheelCapture={(event) => event.stopPropagation()}
      >
        <header className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/48">Prompt Inspector</p>
              <h2 className="mt-1 text-lg font-semibold text-white">生成依据</h2>
              <p className="mt-2 truncate text-sm text-white/58">{node.title} / {node.kind}</p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-lg leading-none text-white/66 hover:bg-white/10 hover:text-white"
              aria-label="关闭生成依据"
              onClick={onClose}
            >
              ×
            </button>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md border border-white/10 bg-white/[0.035] p-2">
              <dt className="text-white/38">providerId</dt>
              <dd className="mt-1 truncate font-mono text-white/78">{providerId || '未记录'}</dd>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.035] p-2">
              <dt className="text-white/38">model</dt>
              <dd className="mt-1 truncate font-mono text-white/78">{model || '未记录'}</dd>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.035] p-2">
              <dt className="text-white/38">status</dt>
              <dd className="mt-1 text-white/78">{statusLabel(node.status)}</dd>
            </div>
          </dl>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Section
            title="原始 Prompt"
            action={<CopyButton label="复制" state={copyState.prompt} onCopy={() => { void copyText('prompt', rawPrompt) }} />}
          >
            {rawPrompt ? (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/22 p-3 text-sm leading-6 text-white/78">{rawPrompt}</pre>
            ) : (
              <p className="text-sm text-white/45">当前节点还没有原始 prompt。</p>
            )}
          </Section>

          <Section
            title="上游内容"
            action={<CopyButton label="复制上游文本" state={copyState.upstream} onCopy={() => { void copyText('upstream', upstreamText) }} />}
          >
            {upstreamText ? (
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/22 p-3 text-sm leading-6 text-white/76">
                {node.kind === 'image' ? compactText(upstreamText, 500) : upstreamText}
              </pre>
            ) : (
              <p className="text-sm text-white/45">当前节点没有可读取的上游文本。</p>
            )}
            {node.kind === 'video' && upstreamImageUrls.length ? (
              <div className="mt-3 space-y-2">
                {upstreamImageUrls.map((url) => (
                  <p key={url} className="break-all rounded-md bg-black/18 p-2 font-mono text-xs text-cyan-100/72">{url}</p>
                ))}
              </div>
            ) : null}
          </Section>

          {mediaType ? (
            <Section title="媒体状态">
              <dl className="space-y-2 text-sm">
                {mediaStatusItems.map(([label, value]) => (
                  <div key={label} className="rounded-md bg-black/18 p-2">
                    <dt className="font-mono text-xs text-white/42">{label}</dt>
                    <dd className="mt-1 break-all font-mono text-xs leading-5 text-white/70">{displayValue(value) || '未记录'}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          ) : null}

          {assetIntelligence ? (
            <Section title="Asset Intelligence">
              <AssetIntelligencePanel intelligence={assetIntelligence} compact />
            </Section>
          ) : null}

          <Section title="Project Style Bible">
            {hasStyleBible ? (
              <dl className="space-y-2">
                {STYLE_BIBLE_FIELDS.map((field) => {
                  const value = stringValue(styleBible?.[field.key])
                  if (!value) return null
                  return (
                    <div key={field.key} className="grid gap-1 rounded-md bg-black/18 p-2">
                      <dt className="font-mono text-xs text-white/42">{field.label}</dt>
                      <dd className="whitespace-pre-wrap break-words text-sm leading-6 text-white/76">{value}</dd>
                    </div>
                  )
                })}
              </dl>
            ) : (
              <p className="text-sm text-white/45">当前项目还没有填写风格圣经。</p>
            )}
          </Section>

          <Section title="角色依据">
            {hasCharacters ? (
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-semibold text-white/52">当前节点绑定角色</h4>
                  {boundCharacters.length ? (
                    <div className="mt-2 space-y-2">
                      {boundCharacters.map((character) => {
                        const heroRef = getHeroReference(character)
                        return (
                          <article key={character.id} className="rounded-md border border-white/10 bg-black/16 p-3">
                            <div className="flex items-start gap-3">
                              {heroRef ? (
                                <div className="shrink-0">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={heroRef.imageUrl}
                                    alt={heroRef.label}
                                    className="h-14 w-14 rounded-lg border border-white/12 object-cover"
                                  />
                                  <div className="mt-1 text-center text-[9px] text-amber-300/70">★ 主参考</div>
                                </div>
                              ) : null}
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-white/82">{character.name}</div>
                                <p className="mt-1 text-sm leading-5 text-white/60">{characterSummary(character) || '已绑定，暂无详细设定。'}</p>
                                {character.negativeRules ? (
                                  <p className="mt-2 text-xs leading-5 text-red-100/70">禁止变化项：{character.negativeRules}</p>
                                ) : null}
                              </div>
                            </div>
                            {(character.referencePack?.length ?? 0) > 1 ? (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {character.referencePack!.slice(0, 6).map((ref) => (
                                  <div key={ref.id} className="relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={ref.imageUrl}
                                      alt={ref.label}
                                      className="h-10 w-10 rounded-md border border-white/10 object-cover"
                                      title={`${CHARACTER_REFERENCE_KIND_LABELS[ref.kind] ?? ref.kind}: ${ref.label}`}
                                    />
                                    {ref.isHero ? (
                                      <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[7px] font-bold text-slate-900">★</span>
                                    ) : null}
                                  </div>
                                ))}
                                {(character.referencePack?.length ?? 0) > 6 ? (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[10px] text-white/40">
                                    +{(character.referencePack?.length ?? 0) - 6}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </article>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-white/45">当前节点未直接绑定角色。</p>
                  )}
                </div>

                {/* Character reference images applied to this prompt */}
                {(() => {
                  const metadata = metadataRecord(node?.metadataJson)
                  const debugRecord = metadata.compiledPromptDebug && typeof metadata.compiledPromptDebug === 'object'
                    ? metadata.compiledPromptDebug as Record<string, unknown>
                    : null
                  const charRefs = Array.isArray(debugRecord?.characterReferencesApplied)
                    ? debugRecord.characterReferencesApplied as Array<{
                        referenceId: string; characterName?: string; kind: string; label: string; imageUrl: string; isHero?: boolean
                      }>
                    : []
                  if (!charRefs.length) return null
                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-white/52">本次注入角色参考图</h4>
                      <div className="mt-2 flex flex-col gap-2">
                        {charRefs.map((ref) => (
                          <div key={ref.referenceId} className="flex items-center gap-3 rounded-md border border-amber-200/14 bg-amber-200/[0.06] p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ref.imageUrl} alt={ref.label} className="h-10 w-10 shrink-0 rounded-md object-cover" />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-amber-50/82">
                                {ref.characterName ?? '角色'} · {CHARACTER_REFERENCE_KIND_LABELS[ref.kind as keyof typeof CHARACTER_REFERENCE_KIND_LABELS] ?? ref.kind}
                              </div>
                              <div className="mt-0.5 truncate text-[10px] text-white/38">{ref.label}</div>
                              {ref.isHero ? <div className="mt-0.5 text-[9px] text-amber-300/60">★ 主参考</div> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                <div>
                  <h4 className="text-xs font-semibold text-white/52">从连接线继承的角色</h4>
                  {inheritedCharacters.length ? (
                    <div className="mt-2 space-y-2">
                      {inheritedCharacters.map((character) => (
                        <article key={character.id} className="rounded-md border border-cyan-100/14 bg-cyan-200/[0.06] p-3">
                          <div className="text-sm font-semibold text-cyan-50/88">{character.name}</div>
                          <p className="mt-1 text-sm leading-5 text-white/62">{characterSummary(character) || '由上游角色锁定继承。'}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-white/45">没有从连接线继承角色。</p>
                  )}
                </div>
                <div className="rounded-md bg-black/18 p-3 text-sm leading-6 text-white/64">
                  角色一致性规则：保持角色身份、外貌、年龄/气质、服装、发型与关键道具；图片/视频生成不得随意改变角色外观。
                  {characterContext?.lockCharacterConsistency ? <span className="block text-cyan-100/72">Edge Director 已开启角色锁定。</span> : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/45">当前节点未绑定角色。</p>
            )}
          </Section>

          <Section title="场景依据">
            {hasScenes ? (
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-semibold text-white/52">当前节点绑定场景</h4>
                  {boundScenes.length ? (
                    <div className="mt-2 space-y-2">
                      {boundScenes.map((scene) => (
                        <article key={scene.id} className="rounded-md border border-white/10 bg-black/16 p-3">
                          <div className="text-sm font-semibold text-white/82">{scene.name}</div>
                          <p className="mt-1 text-sm leading-5 text-white/60">{sceneSummary(scene) || scene.logline || '已绑定，暂无详细设定。'}</p>
                          {scene.negativeRules ? (
                            <p className="mt-2 text-xs leading-5 text-red-100/70">禁止变化项：{scene.negativeRules}</p>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-white/45">当前节点未直接绑定场景。</p>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white/52">从连接线继承的场景</h4>
                  {inheritedScenes.length ? (
                    <div className="mt-2 space-y-2">
                      {inheritedScenes.map((scene) => (
                        <article key={scene.id} className="rounded-md border border-cyan-100/14 bg-cyan-200/[0.06] p-3">
                          <div className="text-sm font-semibold text-cyan-50/88">{scene.name}</div>
                          <p className="mt-1 text-sm leading-5 text-white/62">{sceneSummary(scene) || '由上游场景连续继承。'}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-white/45">没有从连接线继承场景。</p>
                  )}
                </div>
                <div className="rounded-md bg-black/18 p-3 text-sm leading-6 text-white/64">
                  场景一致性规则：保持场景结构、地点、时代、天气、光线、色彩和氛围；图片/视频生成不得随意改变昼夜、建筑类型或环境基调。
                  {sceneContext?.lockSceneConsistency ? <span className="block text-cyan-100/72">Edge Director 已开启场景连续。</span> : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/45">当前节点未绑定场景。</p>
            )}
          </Section>

          <Section title="场景修改任务">
            {sceneEditTasks.length ? (
              <div className="mb-3 space-y-2">
                <h4 className="text-xs font-semibold text-white/52">Scene Edit Plugin</h4>
                {sceneEditTasks.map((task, index) => {
                  const option = getSceneEditTaskOption(task.type)
                  return (
                  <article key={task.id} className="rounded-md border border-cyan-100/12 bg-cyan-200/[0.045] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-cyan-50/86">
                        <span className="mr-2" aria-hidden="true">{option.icon}</span>
                        任务 {index + 1}：{option.label}
                      </h4>
                      <span className="font-mono text-xs text-white/44">
                        x {Math.round(task.x * 100)}% / y {Math.round(task.y * 100)}%
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-white/48">区域：{Math.round(task.width * 100)}% × {Math.round(task.height * 100)}%</p>
                    <p className="mt-2 text-sm leading-6 text-white/68">{task.instruction}</p>
                    {task.preserveInstruction ? (
                      <p className="mt-2 text-xs leading-5 text-emerald-100/70">保留：{task.preserveInstruction}</p>
                    ) : null}
                    {task.negativeInstruction ? (
                      <p className="mt-1 text-xs leading-5 text-red-100/70">禁止：{task.negativeInstruction}</p>
                    ) : null}
                  </article>
                  )
                })}
              </div>
            ) : null}
            {!sceneEditTasks.length && sceneEdits.length ? (
              <div className="space-y-2">
                <p className="rounded-md border border-white/10 bg-black/16 p-3 text-sm text-white/58">旧场景标记已兼容为场景修改意图；下一次在 Scene Lab 保存后会写入 sceneEditTasks。</p>
                {sceneEdits.map((edit) => {
                  const option = getSceneEditToolOption(edit.tool)
                  return (
                    <article key={edit.id} className="rounded-md border border-white/10 bg-black/16 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-white/82">
                          <span className="mr-2" aria-hidden="true">{option.icon}</span>
                          {edit.label}
                        </h4>
                        <span className="font-mono text-xs text-white/42">
                          x {Math.round(edit.x * 100)}% / y {Math.round(edit.y * 100)}%
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/70">{edit.instruction}</p>
                      {edit.width && edit.height ? (
                        <p className="mt-2 font-mono text-xs text-cyan-100/62">
                          区域：{Math.round(edit.width * 100)}% × {Math.round(edit.height * 100)}%
                        </p>
                      ) : null}
                      <p className="mt-2 font-mono text-xs text-white/36">创建时间：{formatDateValue(edit.createdAt)}</p>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-white/45">当前节点还没有场景修改任务。</p>
            )}
          </Section>

          <Section title="启用 Skills">
            {applicableSkills.length ? (
              <div className="space-y-2">
                {applicableSkills.map((skill) => (
                  <article key={skill.id} className="rounded-md border border-white/10 bg-black/16 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-white/82">{skill.name}</h4>
                      <span className="rounded border border-cyan-100/15 px-1.5 py-0.5 text-xs text-cyan-100/70">{skill.category}</span>
                    </div>
                    <p className="mt-2 text-sm leading-5 text-white/58">{skill.description}</p>
                    <p className="mt-2 font-mono text-xs text-white/42">appliesTo: {skill.appliesTo.join(', ')}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/45">当前节点没有启用适用的 Skill。</p>
            )}
          </Section>

          <Section
            title="最终 Compiled Prompt"
            action={(
              <div className="flex items-center gap-2">
                <CopyButton label="复制 compiledPrompt" state={copyState.compiled} onCopy={() => { void copyText('compiled', compiledPromptPreview) }} />
                {compiledPromptPreview ? (
                  <button
                    type="button"
                    className="inline-flex h-7 items-center rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-xs text-white/64 hover:bg-white/10"
                    onClick={() => setCompiledExpanded((current) => !current)}
                  >
                    {compiledExpanded ? '收起' : '展开'}
                  </button>
                ) : null}
              </div>
            )}
          >
            {compiledPromptPreview ? (
              <pre className={`${compiledExpanded ? 'max-h-[520px]' : 'max-h-44'} overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/22 p-3 text-sm leading-6 text-white/78`}>
                {compiledPromptPreview}
              </pre>
            ) : (
              <p className="text-sm text-white/45">当前节点还没有 compiledPromptPreview，下一次生成后会显示。</p>
            )}
          </Section>

          {sceneEditPromptPreview ? (
            <Section title="Scene Lab 场景改造">
              <dl className="space-y-2 text-sm">
                <div className="rounded-md bg-black/18 p-2">
                  <dt className="font-mono text-xs text-white/42">来源节点</dt>
                  <dd className="mt-1 break-words font-mono text-xs text-white/70">{sceneEditPromptSourceNodeId || '未记录'}</dd>
                </div>
                <div className="rounded-md bg-black/18 p-2">
                  <dt className="font-mono text-xs text-white/42">sceneEditPromptPreview</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-white/72">{sceneEditPromptPreview}</dd>
                </div>
              </dl>
            </Section>
          ) : null}

          {scenePluginType ? (
            <Section title="Scene Replace Plugin">
              <dl className="space-y-2 text-sm">
                <div className="rounded-md bg-black/18 p-2">
                  <dt className="font-mono text-xs text-white/42">Scene Plugin Type</dt>
                  <dd className="mt-1 break-words font-mono text-xs text-white/70">{scenePluginType}</dd>
                </div>
                <div className="rounded-md bg-black/18 p-2">
                  <dt className="font-mono text-xs text-white/42">Source Image Node</dt>
                  <dd className="mt-1 break-words font-mono text-xs text-white/70">{scenePluginSourceNodeId || '未记录'}</dd>
                </div>
                <div className="rounded-md bg-black/18 p-2">
                  <dt className="font-mono text-xs text-white/42">Source Image URL</dt>
                  <dd className="mt-1 break-all font-mono text-xs leading-5 text-white/70">{scenePluginSourceImageUrl || '未记录'}</dd>
                </div>
                <div className="rounded-md bg-black/18 p-2">
                  <dt className="font-mono text-xs text-white/42">Selected Region</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-white/70">{displayValue(metadata.selectedRegion) || '未记录'}</dd>
                </div>
                <div className="rounded-md bg-black/18 p-2">
                  <dt className="font-mono text-xs text-white/42">Plugin Result Image</dt>
                  {scenePluginResultImageUrl ? (
                    <div className="mt-2 space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={scenePluginResultImageUrl} alt="Scene plugin result" className="max-h-40 w-full rounded-md border border-white/10 object-cover" />
                      <dd className="break-all font-mono text-xs leading-5 text-white/70">{scenePluginResultImageUrl}</dd>
                    </div>
                  ) : (
                    <dd className="mt-1 text-xs text-white/45">未记录</dd>
                  )}
                </div>
                <div className="rounded-md bg-black/18 p-2">
                  <dt className="font-mono text-xs text-white/42">Preserve / Negative</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-white/72">
                    {[
                      scenePluginPreserveInstruction && `Preserve: ${scenePluginPreserveInstruction}`,
                      scenePluginNegativeInstruction && `Negative: ${scenePluginNegativeInstruction}`,
                    ].filter(Boolean).join('\n') || '未记录'}
                  </dd>
                </div>
                <div className="rounded-md bg-black/18 p-2">
                  <dt className="font-mono text-xs text-white/42">Scene Replace Prompt</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-white/72">{sceneReplacePrompt || '未记录'}</dd>
                </div>
              </dl>
            </Section>
          ) : null}

          <Section title="Debug">
            <dl className="space-y-2 text-sm">
              {debugItems.map(([label, value]) => (
                <div key={label} className="rounded-md bg-black/18 p-2">
                  <dt className="font-mono text-xs text-white/42">{label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-white/70">{displayValue(value) || '未记录'}</dd>
                </div>
              ))}
              {timeFields.map(([label, value]) => (
                <div key={label} className="rounded-md bg-black/18 p-2">
                  <dt className="font-mono text-xs text-white/42">{label}</dt>
                  <dd className="mt-1 font-mono text-xs text-white/70">{value}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="结果摘要">
            {resultSummary ? (
              <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/22 p-3 text-sm leading-6 text-white/76">{resultSummary}</pre>
            ) : (
              <p className="text-sm text-white/45">当前节点还没有生成结果。</p>
            )}
          </Section>
        </div>
      </aside>
    </div>
  )
}
