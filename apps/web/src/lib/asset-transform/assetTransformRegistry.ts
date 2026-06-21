/**
 * Asset Transform Registry — maps transform kinds to executor metadata.
 *
 * The registry does NOT instantiate adapters; it only provides static metadata.
 * Capability discovery (health check, actual supported kinds) happens at the
 * API layer via the executor adapter's getCapability() call.
 *
 * This registry is importable from both server (route.ts) and client (panels).
 */

import type { AssetTransformKind } from './assetTransformTypes'

export interface TransformKindMeta {
  kind: AssetTransformKind
  /** Product-facing label shown in panel header and toolbar. */
  displayName: string
  /** Single-character or emoji icon used in toolbar and edge labels. */
  icon: string
  /** Short description shown under the panel header. */
  description: string
  /** Edge label created on the derived node. */
  edgeLabel: string
  /** What kind of output node this transform creates. */
  outputNodeKind: 'image' | 'video'
  /** Is this kind available in V1? If false, must not appear in toolbar. */
  v1Available: boolean
  /** The registered executor IDs that can handle this kind (in priority order). */
  preferredExecutors: string[]
}

export const ASSET_TRANSFORM_REGISTRY: TransformKindMeta[] = [
  {
    kind: 'remove-background',
    displayName: '主体抠图',
    icon: '✂',
    description: '移除图片背景，隔离主体为透明 PNG。源资产不变。V1 只支持自动识别模式。',
    edgeLabel: '✂ 主体抠图',
    outputNodeKind: 'image',
    v1Available: true,
    preferredExecutors: ['asset-transform-executor'],
  },
  {
    kind: 'upscale',
    displayName: '高清重建',
    icon: '⬆',
    description: '2× 或 4× 分辨率重建。不保证恢复不存在的真实细节。源资产不变。',
    edgeLabel: '⬆ 高清重建',
    outputNodeKind: 'image',
    v1Available: true,
    preferredExecutors: ['asset-transform-executor'],
  },
  {
    kind: 'segment',
    displayName: '对象分割',
    icon: '◉',
    description: '点击或文本指定对象，精确分割。',
    edgeLabel: '◉ 对象分割',
    outputNodeKind: 'image',
    v1Available: false,
    preferredExecutors: ['asset-transform-executor'],
  },
  {
    kind: 'inpaint',
    displayName: '局部重绘',
    icon: '✏',
    description: '在遮罩区域内重新绘制内容。',
    edgeLabel: '✏ 局部重绘',
    outputNodeKind: 'image',
    v1Available: false,
    preferredExecutors: ['asset-transform-executor'],
  },
  {
    kind: 'outpaint',
    displayName: '扩图',
    icon: '⤢',
    description: '向外延伸画布边界，生成新内容填充。',
    edgeLabel: '⤢ 扩图',
    outputNodeKind: 'image',
    v1Available: false,
    preferredExecutors: ['asset-transform-executor'],
  },
  {
    kind: 'variation',
    displayName: '参考图变体',
    icon: '◈',
    description: '基于原图生成风格一致的变体。',
    edgeLabel: '◈ 变体',
    outputNodeKind: 'image',
    v1Available: false,
    preferredExecutors: ['asset-transform-executor'],
  },
  {
    kind: 'extract-control-map',
    displayName: '结构提取',
    icon: '⊞',
    description: '提取深度图、Canny 边缘或人体骨骼 ControlNet 引导图。',
    edgeLabel: '⊞ 结构提取',
    outputNodeKind: 'image',
    v1Available: false,
    preferredExecutors: ['asset-transform-executor'],
  },
  {
    kind: 'interrogate',
    displayName: '反推 Prompt',
    icon: '🔍',
    description: '从图片反向推导生成 prompt 描述。',
    edgeLabel: '🔍 反推',
    outputNodeKind: 'image',
    v1Available: false,
    preferredExecutors: ['asset-transform-executor'],
  },
]

export function getTransformMeta(kind: AssetTransformKind): TransformKindMeta | null {
  return ASSET_TRANSFORM_REGISTRY.find((m) => m.kind === kind) ?? null
}

export function getV1TransformKinds(): TransformKindMeta[] {
  return ASSET_TRANSFORM_REGISTRY.filter((m) => m.v1Available)
}
