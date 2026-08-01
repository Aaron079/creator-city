import { STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID } from '@/lib/canvas/storyboardReferenceExtract'
import type { StoryboardCropLineage } from './storyboard-grid-split-metadata'

type ReferenceSourceAsset = {
  ownerId: string
  projectId: string | null
}

type ReferenceSourceLookup = (sourceAssetId: string) => Promise<ReferenceSourceAsset | null>

export type StoryboardReferenceSourceAccessResult =
  | { ok: true }
  | {
      ok: false
      errorCode: 'INVALID_REFERENCE_SOURCE' | 'REFERENCE_SOURCE_CHECK_FAILED'
      message: string
      status: number
      cause?: unknown
    }

export async function verifyStoryboardReferenceSourceAccess(args: {
  lineage?: StoryboardCropLineage
  projectId: string | null
  userId: string
  lookupSourceAsset: ReferenceSourceLookup
}): Promise<StoryboardReferenceSourceAccessResult> {
  if (args.lineage?.toolId !== STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID) return { ok: true }

  const projectId = args.projectId?.trim() || null
  if (!projectId) {
    return {
      ok: false,
      errorCode: 'INVALID_REFERENCE_SOURCE',
      message: '参考图来源无效或无权访问。',
      status: 400,
    }
  }

  try {
    const sourceAsset = await args.lookupSourceAsset(args.lineage.sourceAssetId)
    if (!sourceAsset || sourceAsset.ownerId !== args.userId || sourceAsset.projectId !== projectId) {
      return {
        ok: false,
        errorCode: 'INVALID_REFERENCE_SOURCE',
        message: '参考图来源无效或无权访问。',
        status: 403,
      }
    }
    return { ok: true }
  } catch (cause) {
    return {
      ok: false,
      errorCode: 'REFERENCE_SOURCE_CHECK_FAILED',
      message: '参考图来源验证失败，请重试。',
      status: 500,
      cause,
    }
  }
}
