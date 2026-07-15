export const CANVAS_SAVE_SERVER_DEADLINE_MS = 45_000
export const CANVAS_SAVE_CLIENT_TIMEOUT_MS = 55_000

export type CanvasSaveResponseData = {
  success?: boolean
  message?: string
  partialSave?: boolean
  failedNodeIds?: string[]
  failedEdgeIds?: string[]
  savedAt?: string
  serverUpdatedAt?: string
  details?: { serverUpdatedAt?: string }
}

export function canvasSaveFailure(
  responseOk: boolean,
  data: CanvasSaveResponseData,
): string | null {
  if (!responseOk || data.success === false) {
    return data.message ?? '保存画布失败。'
  }
  if (
    data.partialSave === true
    || (data.failedNodeIds?.length ?? 0) > 0
    || (data.failedEdgeIds?.length ?? 0) > 0
  ) {
    return '画布仅部分保存，请重试。'
  }
  return null
}

export function consumePendingCanvasSave(
  pendingRef: { current: boolean },
): boolean {
  const shouldRun = pendingRef.current
  pendingRef.current = false
  return shouldRun
}
