'use client'

import { useMemo, useState, type ReactNode } from 'react'
import type { VisualCanvasNode as CanvasNode } from '@/components/create/CanvasNodeCard'
import type { CharacterProfile } from '@/lib/characters'
import { getSceneEdits, getSceneEditToolOption, type SceneProfile } from '@/lib/scenes'
import type { CreatorSkill, CreatorSkillTarget, ProjectStyleBible } from '@/lib/skills'

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
  const sceneEdits = useMemo(() => getSceneEdits(node?.metadataJson), [node?.metadataJson])
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
                      {boundCharacters.map((character) => (
                        <article key={character.id} className="rounded-md border border-white/10 bg-black/16 p-3">
                          <div className="text-sm font-semibold text-white/82">{character.name}</div>
                          <p className="mt-1 text-sm leading-5 text-white/60">{characterSummary(character) || '已绑定，暂无详细设定。'}</p>
                          {character.negativeRules ? (
                            <p className="mt-2 text-xs leading-5 text-red-100/70">禁止变化项：{character.negativeRules}</p>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-white/45">当前节点未直接绑定角色。</p>
                  )}
                </div>
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

          <Section title="场景可视化编辑">
            {sceneEdits.length ? (
              <div className="space-y-2">
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
              <p className="text-sm text-white/45">当前节点还没有场景编辑标记。</p>
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
