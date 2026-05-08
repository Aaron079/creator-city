import { normalizeImageEditLayers, type ImageEditLayer } from './imageEditLayers'
import { createSceneEditMark, normalizeSceneEdits, type SceneEditMark, type SceneEditTool } from './sceneEdits'

export type SceneEditTaskType =
  | 'replace-scene'
  | 'weather-time'
  | 'space-structure'
  | 'preserve'
  | 'remove'
  | 'continuity'

export type SceneEditTask = {
  id: string
  type: SceneEditTaskType
  label: string
  instruction: string
  x: number
  y: number
  width: number
  height: number
  preserveInstruction?: string
  negativeInstruction?: string
  createdAt: string
}

export type SceneEditTaskOption = {
  type: SceneEditTaskType
  label: string
  icon: string
  instruction: string
  color: string
}

export const SCENE_EDIT_TASK_OPTIONS: SceneEditTaskOption[] = [
  {
    type: 'replace-scene',
    label: '替换场景',
    icon: '🏙',
    instruction: '把选区改成新的场景，例如海边城市、室内大厅、废土街区。',
    color: '#38bdf8',
  },
  {
    type: 'weather-time',
    label: '天气时间',
    icon: '🌧',
    instruction: '修改选区或整体天气、时间，例如雪夜、黄昏、清晨、雾天。',
    color: '#22d3ee',
  },
  {
    type: 'space-structure',
    label: '空间结构',
    icon: '🏗',
    instruction: '调整建筑密度、街道纵深、空间开阔度、天空比例。',
    color: '#a78bfa',
  },
  {
    type: 'preserve',
    label: '保留区域',
    icon: '🔒',
    instruction: '该区域不改变，包括构图、建筑结构、主体关系和场景细节。',
    color: '#34d399',
  },
  {
    type: 'remove',
    label: '移除区域',
    icon: '🧹',
    instruction: '移除该区域中的干扰元素，并自然补全原有场景。',
    color: '#fb7185',
  },
  {
    type: 'continuity',
    label: '场景一致性',
    icon: '🧭',
    instruction: '保持当前场景的构图、透视、世界观、色调和空间关系。',
    color: '#fbbf24',
  },
]

const DEFAULT_TASK_OPTION = SCENE_EDIT_TASK_OPTIONS[0]!

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'scene-task') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function clampRatio(value: number | undefined, fallback = 0) {
  if (value == null || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(1, value))
}

export function getSceneEditTaskOption(type: SceneEditTaskType) {
  return SCENE_EDIT_TASK_OPTIONS.find((option) => option.type === type) ?? DEFAULT_TASK_OPTION
}

export function isSceneEditTaskType(value: unknown): value is SceneEditTaskType {
  return typeof value === 'string' && SCENE_EDIT_TASK_OPTIONS.some((option) => option.type === value)
}

export function createSceneEditTask(input: {
  type: SceneEditTaskType
  x: number
  y: number
  width?: number
  height?: number
  instruction?: string
  preserveInstruction?: string
  negativeInstruction?: string
  label?: string
}): SceneEditTask {
  const option = getSceneEditTaskOption(input.type)
  return {
    id: createId(),
    type: input.type,
    label: input.label?.trim() || option.label,
    instruction: input.instruction?.trim() || option.instruction,
    x: clampRatio(input.x),
    y: clampRatio(input.y),
    width: Math.max(0.05, clampRatio(input.width, 0.16)),
    height: Math.max(0.05, clampRatio(input.height, 0.12)),
    preserveInstruction: stringValue(input.preserveInstruction),
    negativeInstruction: stringValue(input.negativeInstruction),
    createdAt: nowIso(),
  }
}

export function normalizeSceneEditTask(input: unknown): SceneEditTask | null {
  const record = recordValue(input)
  const type = isSceneEditTaskType(record.type) ? record.type : null
  const x = numberValue(record.x)
  const y = numberValue(record.y)
  if (!type || x == null || y == null) return null
  const option = getSceneEditTaskOption(type)
  return {
    id: stringValue(record.id) || createId(),
    type,
    label: stringValue(record.label) || option.label,
    instruction: stringValue(record.instruction) || option.instruction,
    x: clampRatio(x),
    y: clampRatio(y),
    width: Math.max(0.05, clampRatio(numberValue(record.width), 0.16)),
    height: Math.max(0.05, clampRatio(numberValue(record.height), 0.12)),
    preserveInstruction: stringValue(record.preserveInstruction),
    negativeInstruction: stringValue(record.negativeInstruction),
    createdAt: stringValue(record.createdAt) || nowIso(),
  }
}

export function normalizeSceneEditTasks(input: unknown): SceneEditTask[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => normalizeSceneEditTask(item))
    .filter((item): item is SceneEditTask => Boolean(item))
}

export function getSceneEditTasks(metadataJson: unknown): SceneEditTask[] {
  const record = recordValue(metadataJson)
  const tasks = normalizeSceneEditTasks(record.sceneEditTasks)
  if (tasks.length) return tasks
  const legacySceneEdits = sceneEditsToSceneEditTasks(record.sceneEdits)
  if (legacySceneEdits.length) return legacySceneEdits
  return imageEditLayersToSceneEditTasks(record.imageEditLayers)
}

export function sceneEditTasksMetadata(metadataJson: unknown, tasks: SceneEditTask[]) {
  return {
    ...recordValue(metadataJson),
    sceneEditTasks: normalizeSceneEditTasks(tasks),
  }
}

function formatPercent(value: number) {
  return `${Math.round(clampRatio(value) * 100)}%`
}

export function summarizeSceneEditTasks(tasks: SceneEditTask[]) {
  const normalized = normalizeSceneEditTasks(tasks)
  if (!normalized.length) return '当前节点还没有场景修改任务。'
  return normalized.map((task, index) => {
    const option = getSceneEditTaskOption(task.type)
    return `${index + 1}. ${option.label}：区域 x ${formatPercent(task.x)} / y ${formatPercent(task.y)} / 宽 ${formatPercent(task.width)} / 高 ${formatPercent(task.height)}。${task.instruction}`
  }).join('\n')
}

export function formatSceneEditTasksForPrompt(tasks: SceneEditTask[]) {
  const normalized = normalizeSceneEditTasks(tasks)
  if (!normalized.length) return ''
  return [
    '【场景修改任务】',
    '请基于原图进行场景修改，保持原图主体、构图和整体世界观。只按照以下区域任务修改，不要无关重绘。',
    '',
    ...normalized.map((task, index) => {
      const option = getSceneEditTaskOption(task.type)
      return [
        `任务 ${index + 1}：${option.label}`,
        `区域：x ${formatPercent(task.x)} / y ${formatPercent(task.y)} / width ${formatPercent(task.width)} / height ${formatPercent(task.height)}`,
        `指令：${task.instruction}`,
        task.preserveInstruction ? `保留：${task.preserveInstruction}` : '',
        task.negativeInstruction ? `禁止：${task.negativeInstruction}` : '',
      ].filter(Boolean).join('\n')
    }),
    '',
    '【全局要求】',
    '1. 保持未标记区域稳定。',
    '2. 保持角色、场景和构图连续。',
    '3. 不要改变原图主体关系。',
    '4. 输出适合图片生成/图片编辑模型的提示词。',
  ].join('\n')
}

function legacyToolToTaskType(tool: SceneEditTool): SceneEditTaskType {
  if (tool === 'weather' || tool === 'weather-time' || tool === 'lighting' || tool === 'atmosphere') return 'weather-time'
  if (tool === 'architecture' || tool === 'space-structure') return 'space-structure'
  if (tool === 'mask' || tool === 'replace-scene') return 'replace-scene'
  if (tool === 'preserve') return 'preserve'
  if (tool === 'remove') return 'remove'
  if (tool === 'continuity' || tool === 'color' || tool === 'camera') return 'continuity'
  return 'replace-scene'
}

export function sceneEditsToSceneEditTasks(sceneEdits: unknown): SceneEditTask[] {
  return normalizeSceneEdits(sceneEdits).map((edit) => ({
    ...createSceneEditTask({
      type: legacyToolToTaskType(edit.tool),
      x: edit.x,
      y: edit.y,
      width: edit.width,
      height: edit.height,
      instruction: edit.instruction,
      label: edit.label,
    }),
    id: edit.id,
    createdAt: edit.createdAt,
  }))
}

function imageLayerToTaskType(layer: ImageEditLayer): SceneEditTaskType | null {
  if (layer.type === 'weather-overlay' || layer.type === 'fog-overlay' || layer.type === 'light-overlay') return 'weather-time'
  if (layer.type === 'architecture-marker') return 'space-structure'
  if (layer.type === 'mask') return 'replace-scene'
  if (layer.type === 'color-adjustment' || layer.type === 'camera-guide') return 'continuity'
  return null
}

export function imageEditLayersToSceneEditTasks(imageEditLayers: unknown): SceneEditTask[] {
  return normalizeImageEditLayers(imageEditLayers)
    .flatMap((layer) => {
      const type = imageLayerToTaskType(layer)
      if (!type) return []
      const marks = layer.marks?.length ? layer.marks : [{ id: layer.id, x: 0.5, y: 0.5, instruction: layer.instruction }]
      return marks.map((mark) => ({
        ...createSceneEditTask({
          type,
          x: mark.x,
          y: mark.y,
          width: mark.width,
          height: mark.height,
          label: layer.name,
          instruction: mark.instruction || layer.instruction,
        }),
        id: mark.id,
        createdAt: layer.createdAt,
      }))
    })
}

export function sceneEditTasksToSceneEdits(tasks: SceneEditTask[]): SceneEditMark[] {
  return normalizeSceneEditTasks(tasks).map((task) => ({
    ...createSceneEditMark({
      tool: task.type,
      x: task.x,
      y: task.y,
      width: task.width,
      height: task.height,
      instruction: task.instruction,
    }),
    id: task.id,
    label: task.label,
    createdAt: task.createdAt,
  }))
}
