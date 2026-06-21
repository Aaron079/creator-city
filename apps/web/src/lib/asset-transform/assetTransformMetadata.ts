/**
 * Asset Transform Metadata helpers — build and parse assetTransform lineage
 * written into canvasNode.metadataJson.assetTransform.
 *
 * Stored alongside existing metadataJson fields (generationDraft, toolSummaryText,
 * derivedToolChannel, assetId) — no schema change needed.
 */

import type { AssetTransformLineage } from './assetTransformTypes'

export function buildTransformLineage(
  input: Omit<AssetTransformLineage, 'createdAt'>,
): AssetTransformLineage {
  return {
    ...input,
    createdAt: new Date().toISOString(),
  }
}

export function parseTransformLineage(metadataJson: unknown): AssetTransformLineage | null {
  if (!metadataJson || typeof metadataJson !== 'object' || Array.isArray(metadataJson)) return null
  const meta = metadataJson as Record<string, unknown>
  const t = meta.assetTransform
  if (!t || typeof t !== 'object' || Array.isArray(t)) return null
  const lineage = t as Record<string, unknown>
  if (
    typeof lineage.transformKind !== 'string' ||
    typeof lineage.transformId !== 'string' ||
    typeof lineage.sourceNodeId !== 'string'
  ) return null
  return lineage as unknown as AssetTransformLineage
}

/** Build the toolSummaryText shown in the derived node badge. */
export function buildTransformSummaryText(lineage: AssetTransformLineage): string {
  switch (lineage.transformKind) {
    case 'remove-background': return '主体抠图 · 主体已提取'
    case 'upscale': {
      const scale = typeof lineage.params.scale === 'number' ? `${lineage.params.scale}×` : ''
      return `高清重建${scale ? ' · ' + scale : ''}`
    }
    case 'segment': return '对象分割'
    case 'inpaint': return '局部重绘'
    case 'outpaint': return '扩图'
    case 'variation': return '参考图变体'
    case 'extract-control-map': return '结构提取'
    case 'interrogate': return '反推 Prompt'
    default: return '资产变换'
  }
}
