import type { SceneBible } from '@/lib/scenes'
import type { ProjectStyleBible } from '@/lib/skills'
import type { ScenePluginRegion, ScenePluginRun, SceneReplaceSourceNode } from './types'

function nowIso() {
  return new Date().toISOString()
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `scene-plugin-${Math.random().toString(36).slice(2, 10)}`
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function clampRatio(value: number | undefined, fallback = 0) {
  if (value == null || !Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

function normalizeRegion(region: ScenePluginRegion): ScenePluginRegion {
  const x = clampRatio(region.x)
  const y = clampRatio(region.y)
  const width = Math.max(0.02, Math.min(1 - x, clampRatio(region.width, 0.16)))
  const height = Math.max(0.02, Math.min(1 - y, clampRatio(region.height, 0.12)))
  return { x, y, width, height }
}

function percent(value: number) {
  return `${Math.round(clampRatio(value) * 100)}%`
}

export function createScenePluginRun(input: {
  sourceNodeId: string
  sourceImageUrl?: string
  targetNodeId?: string
  region: ScenePluginRegion
  targetDescription?: string
  preserveInstruction?: string
  negativeInstruction?: string
  styleInheritance?: 'low' | 'medium' | 'high'
  prompt?: string
  resultImageUrl?: string
  pluginProvider?: string
  pluginResult?: unknown
  status?: 'draft' | 'applied' | 'done'
}): ScenePluginRun {
  const timestamp = nowIso()
  return {
    id: createId(),
    pluginId: 'scene-replace',
    sourceNodeId: input.sourceNodeId,
    sourceImageUrl: input.sourceImageUrl,
    targetNodeId: input.targetNodeId,
    region: normalizeRegion(input.region),
    targetDescription: input.targetDescription?.trim(),
    preserveInstruction: input.preserveInstruction?.trim(),
    negativeInstruction: input.negativeInstruction?.trim(),
    styleInheritance: input.styleInheritance ?? 'high',
    prompt: input.prompt?.trim(),
    resultImageUrl: input.resultImageUrl?.trim(),
    pluginProvider: input.pluginProvider?.trim(),
    pluginResult: input.pluginResult,
    status: input.status ?? 'draft',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function buildSceneReplacePrompt(
  run: ScenePluginRun,
  sourceNode?: SceneReplaceSourceNode | null,
  styleBible?: ProjectStyleBible | null,
  sceneBible?: SceneBible | null,
) {
  const region = normalizeRegion(run.region)
  const styleHints = [
    styleBible?.visualStyle && `视觉风格：${styleBible.visualStyle}`,
    styleBible?.colorPalette && `色彩方案：${styleBible.colorPalette}`,
    styleBible?.sceneRules && `场景规则：${styleBible.sceneRules}`,
  ].filter(Boolean)
  const sceneHints = (sceneBible?.scenes ?? [])
    .slice(0, 3)
    .map((scene) => [scene.name, scene.location, scene.atmosphere, scene.lighting, scene.weather].filter(Boolean).join(' / '))
    .filter(Boolean)

  return [
    '【场景替换任务】',
    '请基于原图进行局部场景替换，不要重绘整张图。',
    '',
    '【来源图像】',
    `- 来源节点：${sourceNode?.title || run.sourceNodeId}`,
    `- 来源图像 URL：${run.sourceImageUrl || sourceNode?.resultImageUrl || '未记录'}`,
    `- 原始提示词：${sourceNode?.prompt?.trim() || '未记录'}`,
    '',
    '【替换区域】',
    `- 区域位置：x ${percent(region.x)} / y ${percent(region.y)} / width ${percent(region.width)} / height ${percent(region.height)}`,
    `- 替换目标：${run.targetDescription || '请根据用户补充填写替换目标。'}`,
    '',
    '【必须保留】',
    '- 保留未选中区域的构图、主体、透视、光影和世界观。',
    `- 保留：${run.preserveInstruction || '保留原图整体构图和未选区内容。'}`,
    '',
    '【禁止改变】',
    `- 禁止：${run.negativeInstruction || '不要改变未选中区域。'}`,
    '- 不要卡通化。',
    '- 不要改变未选中区域。',
    '- 不要改变角色外貌和服装，除非明确要求。',
    '',
    '【风格继承】',
    `- 继承原图风格强度：${run.styleInheritance || 'high'}`,
    '- 继承项目 Style Bible 和场景库设定。',
    styleHints.length ? `- Style Bible：${styleHints.join('；')}` : '',
    sceneHints.length ? `- 场景库参考：${sceneHints.join('；')}` : '',
    '',
    '【输出要求】',
    '生成适合 Image 节点使用的场景改造 Prompt。',
  ].filter((line) => line !== '').join('\n')
}

function normalizeScenePluginRun(input: unknown): ScenePluginRun | null {
  const record = recordValue(input)
  const id = stringValue(record.id)
  const sourceNodeId = stringValue(record.sourceNodeId)
  const regionRecord = recordValue(record.region)
  if (!id || !sourceNodeId || record.pluginId !== 'scene-replace') return null
  return {
    id,
    pluginId: 'scene-replace',
    sourceNodeId,
    sourceImageUrl: stringValue(record.sourceImageUrl),
    targetNodeId: stringValue(record.targetNodeId),
    region: normalizeRegion({
      x: Number(regionRecord.x),
      y: Number(regionRecord.y),
      width: Number(regionRecord.width),
      height: Number(regionRecord.height),
    }),
    targetDescription: stringValue(record.targetDescription),
    preserveInstruction: stringValue(record.preserveInstruction),
    negativeInstruction: stringValue(record.negativeInstruction),
    styleInheritance: record.styleInheritance === 'low' || record.styleInheritance === 'medium' || record.styleInheritance === 'high'
      ? record.styleInheritance
      : 'high',
    prompt: stringValue(record.prompt),
    resultImageUrl: stringValue(record.resultImageUrl),
    pluginProvider: stringValue(record.pluginProvider),
    pluginResult: record.pluginResult,
    status: record.status === 'done' || record.status === 'applied' ? record.status : 'draft',
    createdAt: stringValue(record.createdAt) ?? nowIso(),
    updatedAt: stringValue(record.updatedAt),
  }
}

export function getScenePluginRuns(metadataJson: unknown): ScenePluginRun[] {
  const runs = recordValue(metadataJson).scenePluginRuns
  if (!Array.isArray(runs)) return []
  return runs
    .map((run) => normalizeScenePluginRun(run))
    .filter((run): run is ScenePluginRun => Boolean(run))
}

export function scenePluginRunMetadata(metadataJson: unknown, run: ScenePluginRun) {
  const metadata = recordValue(metadataJson)
  const currentRuns = getScenePluginRuns(metadataJson)
  return {
    ...metadata,
    scenePluginRuns: [
      ...currentRuns.filter((item) => item.id !== run.id),
      { ...run, updatedAt: nowIso() },
    ],
  }
}
