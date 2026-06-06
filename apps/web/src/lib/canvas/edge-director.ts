export type EdgeDirectorType =
  | 'default'
  | 'story-to-visual'
  | 'image-to-video'
  | 'style-lock'
  | 'character-lock'
  | 'scene-continuity'
  | 'camera-motion'
  | 'variant'
  | 'reference'

export type EdgeDirectorConfig = {
  type: EdgeDirectorType
  inheritStory: boolean
  inheritCharacter: boolean
  inheritScene: boolean
  inheritColor: boolean
  inheritCamera: boolean
  lockStyle: boolean
  influenceWeight: number
  cameraMotion?: string
  customInstruction?: string
  negativeInstruction?: string
  updatedAt?: string
}

export type EdgeDirective = {
  sourceNodeId: string
  targetNodeId: string
  sourceKind: string
  targetKind: string
  config: EdgeDirectorConfig
  sourceSummary?: string
}

export type EdgeDirectorCanvasNode = {
  id: string
  kind?: string
  type?: string
  resultText?: string
  resultPreview?: string
  outputLabel?: string
  resultImageUrl?: string
  resultVideoUrl?: string
}

export type EdgeDirectorCanvasEdge = {
  id: string
  fromNodeId: string
  toNodeId: string
  metadataJson?: unknown
}

const EDGE_DIRECTOR_TYPES: EdgeDirectorType[] = [
  'default',
  'story-to-visual',
  'image-to-video',
  'style-lock',
  'character-lock',
  'scene-continuity',
  'camera-motion',
  'variant',
  'reference',
]

export const DEFAULT_EDGE_DIRECTOR_CONFIG: EdgeDirectorConfig = {
  type: 'default',
  inheritStory: true,
  inheritCharacter: true,
  inheritScene: true,
  inheritColor: true,
  inheritCamera: true,
  lockStyle: false,
  influenceWeight: 0.8,
  cameraMotion: '',
  customInstruction: '',
  negativeInstruction: '',
}

export const EDGE_DIRECTOR_LABELS: Record<EdgeDirectorType, string> = {
  default: '默认连接',
  'story-to-visual': '故事转视觉',
  'image-to-video': '图像转视频',
  'style-lock': '风格锁定',
  'character-lock': '角色锁定',
  'scene-continuity': '场景连续',
  'camera-motion': '镜头运动',
  variant: '变体生成',
  reference: '参考引用',
}

export const EDGE_DIRECTOR_COLORS: Record<EdgeDirectorType, { from: string; mid: string; to: string; dashed?: boolean }> = {
  default: { from: 'rgba(110,140,255,0.22)', mid: 'rgba(130,160,255,0.62)', to: 'rgba(110,140,255,0.16)' },
  'story-to-visual': { from: 'rgba(56,189,248,0.16)', mid: 'rgba(96,165,250,0.72)', to: 'rgba(56,189,248,0.12)' },
  'image-to-video': { from: 'rgba(168,85,247,0.16)', mid: 'rgba(192,132,252,0.76)', to: 'rgba(168,85,247,0.12)' },
  'style-lock': { from: 'rgba(217,70,239,0.16)', mid: 'rgba(232,121,249,0.78)', to: 'rgba(217,70,239,0.12)' },
  'character-lock': { from: 'rgba(248,113,113,0.16)', mid: 'rgba(248,113,113,0.78)', to: 'rgba(248,113,113,0.12)' },
  'scene-continuity': { from: 'rgba(45,212,191,0.16)', mid: 'rgba(94,234,212,0.76)', to: 'rgba(45,212,191,0.12)' },
  'camera-motion': { from: 'rgba(251,146,60,0.16)', mid: 'rgba(251,191,36,0.78)', to: 'rgba(251,146,60,0.12)' },
  variant: { from: 'rgba(74,222,128,0.16)', mid: 'rgba(134,239,172,0.76)', to: 'rgba(74,222,128,0.12)' },
  reference: { from: 'rgba(255,255,255,0.18)', mid: 'rgba(255,255,255,0.82)', to: 'rgba(255,255,255,0.14)', dashed: true },
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function weightValue(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_EDGE_DIRECTOR_CONFIG.influenceWeight
  return Math.min(1, Math.max(0, numeric))
}

export function normalizeEdgeDirectorConfig(input: unknown): EdgeDirectorConfig {
  const record = recordValue(input)
  const type = EDGE_DIRECTOR_TYPES.includes(record.type as EdgeDirectorType)
    ? record.type as EdgeDirectorType
    : DEFAULT_EDGE_DIRECTOR_CONFIG.type
  return {
    type,
    inheritStory: booleanValue(record.inheritStory, DEFAULT_EDGE_DIRECTOR_CONFIG.inheritStory),
    inheritCharacter: booleanValue(record.inheritCharacter, DEFAULT_EDGE_DIRECTOR_CONFIG.inheritCharacter),
    inheritScene: booleanValue(record.inheritScene, DEFAULT_EDGE_DIRECTOR_CONFIG.inheritScene),
    inheritColor: booleanValue(record.inheritColor, DEFAULT_EDGE_DIRECTOR_CONFIG.inheritColor),
    inheritCamera: booleanValue(record.inheritCamera, DEFAULT_EDGE_DIRECTOR_CONFIG.inheritCamera),
    lockStyle: booleanValue(record.lockStyle, DEFAULT_EDGE_DIRECTOR_CONFIG.lockStyle),
    influenceWeight: weightValue(record.influenceWeight),
    cameraMotion: stringValue(record.cameraMotion),
    customInstruction: stringValue(record.customInstruction),
    negativeInstruction: stringValue(record.negativeInstruction),
    updatedAt: stringValue(record.updatedAt) || undefined,
  }
}

export function getEdgeDirectorConfig(metadataJson: unknown) {
  const metadata = recordValue(metadataJson)
  if (!metadata.edgeDirector) return null
  return normalizeEdgeDirectorConfig(metadata.edgeDirector)
}

export function edgeDirectorMetadata(metadataJson: unknown, config: EdgeDirectorConfig) {
  return {
    ...recordValue(metadataJson),
    edgeDirector: {
      ...normalizeEdgeDirectorConfig(config),
      updatedAt: new Date().toISOString(),
    },
  }
}

function nodeKind(node?: EdgeDirectorCanvasNode) {
  return node?.kind || node?.type || ''
}

function sourceSummary(node?: EdgeDirectorCanvasNode) {
  if (!node) return ''
  return node.resultText || node.resultPreview || node.outputLabel || node.resultImageUrl || node.resultVideoUrl || ''
}

export function buildEdgeDirectivesForNode({
  targetNodeId,
  nodes,
  edges,
}: {
  targetNodeId: string
  nodes: EdgeDirectorCanvasNode[]
  edges: EdgeDirectorCanvasEdge[]
}): EdgeDirective[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const targetNode = nodesById.get(targetNodeId)
  return edges
    .filter((edge) => edge.toNodeId === targetNodeId)
    .flatMap((edge) => {
      const config = getEdgeDirectorConfig(edge.metadataJson)
      if (!config) return []
      const sourceNode = nodesById.get(edge.fromNodeId)
      return [{
        sourceNodeId: edge.fromNodeId,
        targetNodeId: edge.toNodeId,
        sourceKind: nodeKind(sourceNode),
        targetKind: nodeKind(targetNode),
        config,
        sourceSummary: sourceSummary(sourceNode),
      }]
    })
}
