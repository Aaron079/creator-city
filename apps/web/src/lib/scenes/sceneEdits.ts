export type SceneEditTool =
  | 'weather'
  | 'color'
  | 'lighting'
  | 'atmosphere'
  | 'person'
  | 'architecture'
  | 'prop'
  | 'camera'
  | 'mask'

export type SceneEditMark = {
  id: string
  tool: SceneEditTool
  label: string
  instruction: string
  x: number
  y: number
  width?: number
  height?: number
  createdAt: string
}

export type SceneEditToolOption = {
  tool: SceneEditTool
  label: string
  icon: string
  instruction: string
  cursor: string
}

export const SCENE_EDIT_TOOL_OPTIONS: SceneEditToolOption[] = [
  {
    tool: 'weather',
    label: '天气',
    icon: '☔',
    instruction: '调整这里的天气效果，例如雨、雪、雾、湿度、天空状态。',
    cursor: 'crosshair',
  },
  {
    tool: 'color',
    label: '调色',
    icon: '🎨',
    instruction: '调整这里的色调、冷暖、饱和度、对比度。',
    cursor: 'cell',
  },
  {
    tool: 'lighting',
    label: '光线',
    icon: '💡',
    instruction: '调整这里的光源、亮度、阴影、高光方向。',
    cursor: 'crosshair',
  },
  {
    tool: 'atmosphere',
    label: '氛围',
    icon: '🌫',
    instruction: '增强这里的氛围，例如雾气、孤独感、压迫感、电影感。',
    cursor: 'crosshair',
  },
  {
    tool: 'person',
    label: '人物',
    icon: '👤',
    instruction: '在这里增加、强化或调整人物存在，并保持整体风格一致。',
    cursor: 'copy',
  },
  {
    tool: 'architecture',
    label: '建筑',
    icon: '🏙',
    instruction: '调整这里的建筑密度、空间结构、玻璃幕墙、城市纵深。',
    cursor: 'crosshair',
  },
  {
    tool: 'prop',
    label: '道具',
    icon: '🧩',
    instruction: '增加或修改这里的关键道具/物件。',
    cursor: 'copy',
  },
  {
    tool: 'camera',
    label: '镜头',
    icon: '🎥',
    instruction: '调整构图、景别、镜头方向或运动意图。',
    cursor: 'crosshair',
  },
  {
    tool: 'mask',
    label: '遮罩',
    icon: '🖌',
    instruction: '标记一个需要重点修改的区域。',
    cursor: 'crosshair',
  },
]

const DEFAULT_SCENE_EDIT_TOOL_OPTION: SceneEditToolOption = {
  tool: 'weather',
  label: '天气',
  icon: '☔',
  instruction: '调整这里的天气效果，例如雨、雪、雾、湿度、天空状态。',
  cursor: 'crosshair',
}

function nowIso() {
  return new Date().toISOString()
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `scene-edit-${Math.random().toString(36).slice(2, 10)}`
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function getSceneEditToolOption(tool: SceneEditTool) {
  return SCENE_EDIT_TOOL_OPTIONS.find((option) => option.tool === tool) ?? DEFAULT_SCENE_EDIT_TOOL_OPTION
}

export function isSceneEditTool(value: unknown): value is SceneEditTool {
  return typeof value === 'string' && SCENE_EDIT_TOOL_OPTIONS.some((option) => option.tool === value)
}

export function createSceneEditMark(input: {
  tool: SceneEditTool
  x: number
  y: number
  width?: number
  height?: number
  instruction?: string
}): SceneEditMark {
  const option = getSceneEditToolOption(input.tool)
  return {
    id: createId(),
    tool: input.tool,
    label: option.label,
    instruction: input.instruction?.trim() || option.instruction,
    x: clampRatio(input.x),
    y: clampRatio(input.y),
    width: input.width == null ? undefined : clampRatio(input.width),
    height: input.height == null ? undefined : clampRatio(input.height),
    createdAt: nowIso(),
  }
}

export function normalizeSceneEditMark(input: unknown): SceneEditMark | null {
  const record = recordValue(input)
  const id = stringValue(record.id)
  const tool = isSceneEditTool(record.tool) ? record.tool : null
  const x = numberValue(record.x)
  const y = numberValue(record.y)
  if (!id || !tool || x == null || y == null) return null
  const option = getSceneEditToolOption(tool)
  return {
    id,
    tool,
    label: stringValue(record.label) || option.label,
    instruction: stringValue(record.instruction) || option.instruction,
    x: clampRatio(x),
    y: clampRatio(y),
    width: numberValue(record.width),
    height: numberValue(record.height),
    createdAt: stringValue(record.createdAt) || nowIso(),
  }
}

export function normalizeSceneEdits(input: unknown): SceneEditMark[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => normalizeSceneEditMark(item))
    .filter((item): item is SceneEditMark => Boolean(item))
}

export function getSceneEdits(metadataJson: unknown): SceneEditMark[] {
  return normalizeSceneEdits(recordValue(metadataJson).sceneEdits)
}

export function sceneEditsMetadata(metadataJson: unknown, sceneEdits: SceneEditMark[]) {
  return {
    ...recordValue(metadataJson),
    sceneEdits: normalizeSceneEdits(sceneEdits),
  }
}

function formatPercent(value: number) {
  return `${Math.round(clampRatio(value) * 100)}%`
}

export function summarizeSceneEdits(sceneEdits: SceneEditMark[]) {
  const edits = normalizeSceneEdits(sceneEdits)
  if (!edits.length) return '当前节点还没有场景编辑标记。'
  return edits.map((edit, index) => {
    const size = edit.width && edit.height
      ? `，范围 ${formatPercent(edit.width)} × ${formatPercent(edit.height)}`
      : ''
    return `${index + 1}. ${edit.label} (${formatPercent(edit.x)}, ${formatPercent(edit.y)}${size})：${edit.instruction}`
  }).join('\n')
}

export function formatSceneEditsForPrompt(sceneEdits: SceneEditMark[]) {
  const edits = normalizeSceneEdits(sceneEdits)
  if (!edits.length) return ''
  return [
    '【场景可视化编辑层】',
    '用户在图片上标记了以下修改意图：',
    ...edits.map((edit) => {
      const size = edit.width && edit.height
        ? `，范围：宽 ${formatPercent(edit.width)} / 高 ${formatPercent(edit.height)}`
        : ''
      return [
        `- 工具：${edit.label}`,
        `  位置：x ${formatPercent(edit.x)} / y ${formatPercent(edit.y)}${size}`,
        `  指令：${edit.instruction}`,
      ].join('\n')
    }),
    '生成要求：',
    '1. 尊重这些场景编辑标记。',
    '2. 优先保持原图构图和主体。',
    '3. 只修改标记对应的区域或意图。',
    '4. 不要破坏角色、场景、色调一致性。',
  ].join('\n')
}
