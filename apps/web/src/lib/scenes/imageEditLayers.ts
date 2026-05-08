import { createSceneEditMark, type SceneEditMark, type SceneEditTool } from './sceneEdits'

export type ImageEditLayerType =
  | 'base'
  | 'color-adjustment'
  | 'weather-overlay'
  | 'light-overlay'
  | 'fog-overlay'
  | 'mask'
  | 'person-marker'
  | 'architecture-marker'
  | 'prop-marker'
  | 'camera-guide'

export type ImageEditLayerMark = {
  id: string
  x: number
  y: number
  width?: number
  height?: number
  label?: string
  instruction?: string
}

export type ImageEditLayer = {
  id: string
  type: ImageEditLayerType
  name: string
  visible: boolean
  opacity?: number
  blendMode?: string
  instruction?: string
  params?: Record<string, unknown>
  marks?: ImageEditLayerMark[]
  createdAt: string
  updatedAt?: string
}

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'image-layer') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
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

function booleanValue(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

function clampRatio(value: number | undefined, fallback = 0) {
  if (value == null || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(1, value))
}

function isImageEditLayerType(value: unknown): value is ImageEditLayerType {
  return typeof value === 'string' && [
    'base',
    'color-adjustment',
    'weather-overlay',
    'light-overlay',
    'fog-overlay',
    'mask',
    'person-marker',
    'architecture-marker',
    'prop-marker',
    'camera-guide',
  ].includes(value)
}

export function imageEditLayerLabel(type: ImageEditLayerType) {
  if (type === 'base') return '原图层'
  if (type === 'color-adjustment') return '调色层'
  if (type === 'weather-overlay') return '天气层'
  if (type === 'light-overlay') return '光线层'
  if (type === 'fog-overlay') return '雾气层'
  if (type === 'mask') return '遮罩层'
  if (type === 'person-marker') return '人物标记'
  if (type === 'architecture-marker') return '建筑/空间标记'
  if (type === 'prop-marker') return '道具/物件标记'
  return '镜头/构图标记'
}

export function imageEditLayerIcon(type: ImageEditLayerType) {
  if (type === 'base') return '▣'
  if (type === 'color-adjustment') return '🎨'
  if (type === 'weather-overlay') return '☔'
  if (type === 'light-overlay') return '💡'
  if (type === 'fog-overlay') return '🌫'
  if (type === 'mask') return '🖌'
  if (type === 'person-marker') return '👤'
  if (type === 'architecture-marker') return '🏙'
  if (type === 'prop-marker') return '🧩'
  return '🎥'
}

export function defaultImageEditInstruction(type: ImageEditLayerType) {
  if (type === 'color-adjustment') return '调整画面的亮度、对比度、饱和度和色温。'
  if (type === 'weather-overlay') return '为画面叠加天气效果，例如雨、雪或雨雾。'
  if (type === 'light-overlay') return '添加或强化画面中的光源、光晕和高光方向。'
  if (type === 'fog-overlay') return '为画面叠加雾气、湿度和电影氛围。'
  if (type === 'mask') return '标记需要后续局部重绘或重点修改的区域。'
  if (type === 'person-marker') return '在这里增加一个人物，并保持整体风格一致。'
  if (type === 'architecture-marker') return '调整这里的建筑密度、空间结构或城市纵深。'
  if (type === 'prop-marker') return '在这里增加或修改关键道具/物件。'
  if (type === 'camera-guide') return '调整这里的构图、景别、镜头方向或运动意图。'
  return '保留原图主体、构图和世界观。'
}

export function defaultImageEditParams(type: ImageEditLayerType): Record<string, unknown> {
  if (type === 'color-adjustment') {
    return { brightness: 104, contrast: 112, saturation: 112, warmth: 8, hueRotate: 0 }
  }
  if (type === 'weather-overlay') return { weatherType: 'rain', intensity: 62, direction: 18 }
  if (type === 'light-overlay') return { color: '#ffd28a', intensity: 68, radius: 36 }
  if (type === 'fog-overlay') return { density: 42, color: '#d7e7ff' }
  if (type === 'mask') return { color: '#7dd3fc' }
  return {}
}

export function createImageEditLayer(input: Partial<ImageEditLayer> & { type: ImageEditLayerType }): ImageEditLayer {
  const timestamp = nowIso()
  return {
    id: input.id || createId(),
    type: input.type,
    name: input.name || imageEditLayerLabel(input.type),
    visible: input.visible ?? true,
    opacity: input.opacity ?? (input.type === 'color-adjustment' ? 1 : 0.72),
    blendMode: input.blendMode,
    instruction: input.instruction || defaultImageEditInstruction(input.type),
    params: { ...defaultImageEditParams(input.type), ...recordValue(input.params) },
    marks: input.marks,
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
  }
}

function normalizeMark(input: unknown): ImageEditLayerMark | null {
  const record = recordValue(input)
  const x = numberValue(record.x)
  const y = numberValue(record.y)
  if (x == null || y == null) return null
  return {
    id: stringValue(record.id) || createId('image-mark'),
    x: clampRatio(x),
    y: clampRatio(y),
    width: numberValue(record.width),
    height: numberValue(record.height),
    label: stringValue(record.label),
    instruction: stringValue(record.instruction),
  }
}

export function normalizeImageEditLayer(input: unknown): ImageEditLayer | null {
  const record = recordValue(input)
  const type = isImageEditLayerType(record.type) ? record.type : null
  if (!type) return null
  return createImageEditLayer({
    id: stringValue(record.id),
    type,
    name: stringValue(record.name),
    visible: booleanValue(record.visible) ?? true,
    opacity: numberValue(record.opacity),
    blendMode: stringValue(record.blendMode),
    instruction: stringValue(record.instruction),
    params: recordValue(record.params),
    marks: Array.isArray(record.marks)
      ? record.marks.map((mark) => normalizeMark(mark)).filter((mark): mark is ImageEditLayerMark => Boolean(mark))
      : undefined,
    createdAt: stringValue(record.createdAt),
    updatedAt: stringValue(record.updatedAt),
  })
}

export function normalizeImageEditLayers(input: unknown): ImageEditLayer[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => normalizeImageEditLayer(item))
    .filter((item): item is ImageEditLayer => Boolean(item))
}

export function getImageEditLayers(metadataJson: unknown) {
  return normalizeImageEditLayers(recordValue(metadataJson).imageEditLayers)
}

export function imageEditLayersMetadata(metadataJson: unknown, imageEditLayers: ImageEditLayer[]) {
  return {
    ...recordValue(metadataJson),
    imageEditLayers: normalizeImageEditLayers(imageEditLayers),
  }
}

export function updateImageEditLayer(layers: ImageEditLayer[], layerId: string, patch: Partial<ImageEditLayer>) {
  return layers.map((layer) => (
    layer.id === layerId
      ? { ...layer, ...patch, id: layer.id, type: layer.type, updatedAt: nowIso() }
      : layer
  ))
}

export function deleteImageEditLayer(layers: ImageEditLayer[], layerId: string) {
  return layers.filter((layer) => layer.id !== layerId)
}

function paramText(layer: ImageEditLayer) {
  const params = recordValue(layer.params)
  if (layer.type === 'color-adjustment') {
    return [
      `亮度 ${params.brightness ?? 100}`,
      `对比 ${params.contrast ?? 100}`,
      `饱和 ${params.saturation ?? 100}`,
      `色温 ${params.warmth ?? 0}`,
    ].join('，')
  }
  if (layer.type === 'weather-overlay') return `${params.weatherType ?? 'rain'}，强度 ${params.intensity ?? 60}%`
  if (layer.type === 'light-overlay') return `${params.color ?? '#ffd28a'} 光源，强度 ${params.intensity ?? 68}%`
  if (layer.type === 'fog-overlay') return `密度 ${params.density ?? 42}%`
  return ''
}

export function summarizeImageEditLayers(layers: ImageEditLayer[]) {
  const normalized = normalizeImageEditLayers(layers)
  if (!normalized.length) return '当前节点还没有图片编辑层。'
  return normalized.map((layer, index) => {
    const params = paramText(layer)
    const marks = layer.marks?.length ? `，标记 ${layer.marks.length} 个` : ''
    return `${index + 1}. ${layer.name} / ${imageEditLayerLabel(layer.type)}${params ? `：${params}` : ''}${marks}`
  }).join('\n')
}

export function formatImageEditLayersForPrompt(layers: ImageEditLayer[]) {
  const visibleLayers = normalizeImageEditLayers(layers).filter((layer) => layer.visible)
  if (!visibleLayers.length) return ''
  return [
    '【图片可视化编辑层】',
    '请在保持原图主体、构图和世界观的基础上，根据以下图层和标记进行修改：',
    '',
    '图层：',
    ...visibleLayers.map((layer) => {
      const params = paramText(layer)
      return `- ${layer.name}：${imageEditLayerLabel(layer.type)}${params ? `，${params}` : ''}${layer.instruction ? `。${layer.instruction}` : ''}`
    }),
    '',
    '标记：',
    ...visibleLayers.flatMap((layer) => (layer.marks ?? []).map((mark) => (
      `- ${layer.name}：位置 x ${Math.round(mark.x * 100)}% / y ${Math.round(mark.y * 100)}%${mark.width && mark.height ? `，区域 ${Math.round(mark.width * 100)}% × ${Math.round(mark.height * 100)}%` : ''}。${mark.instruction || layer.instruction || ''}`
    ))),
    '',
    '要求：',
    '1. 不要破坏未标记区域。',
    '2. 保持角色、场景、色调一致性。',
    '3. 保持影视级构图。',
    '4. 输出适合图片生成/图片编辑模型的提示词。',
  ].join('\n')
}

function layerTypeToSceneTool(type: ImageEditLayerType): SceneEditTool {
  if (type === 'weather-overlay') return 'weather'
  if (type === 'color-adjustment') return 'color'
  if (type === 'light-overlay') return 'lighting'
  if (type === 'fog-overlay') return 'atmosphere'
  if (type === 'person-marker') return 'person'
  if (type === 'architecture-marker') return 'architecture'
  if (type === 'prop-marker') return 'prop'
  if (type === 'camera-guide') return 'camera'
  return 'mask'
}

export function imageEditLayersToSceneEdits(layers: ImageEditLayer[]): SceneEditMark[] {
  return normalizeImageEditLayers(layers)
    .filter((layer) => layer.type !== 'base')
    .flatMap((layer) => {
      const tool = layerTypeToSceneTool(layer.type)
      const marks = layer.marks?.length
        ? layer.marks
        : [{ id: createId('image-layer-mark'), x: 0.5, y: 0.5, label: layer.name, instruction: layer.instruction }]
      return marks.map((mark) => ({
        ...createSceneEditMark({
          tool,
          x: mark.x,
          y: mark.y,
          width: mark.width,
          height: mark.height,
          instruction: mark.instruction || layer.instruction || defaultImageEditInstruction(layer.type),
        }),
        id: mark.id,
        label: mark.label || layer.name,
      }))
    })
}
