export type CanvasSaveScheduleOptions = {
  snapshot: 'flush' | 'already-flushed'
}

export function completeLocalCanvasSaveSchedule(
  options: CanvasSaveScheduleOptions | undefined,
  effects: {
    flushSnapshot: () => void
    markLocalDraft: () => void
  },
) {
  if (options?.snapshot !== 'already-flushed') effects.flushSnapshot()
  effects.markLocalDraft()
}
