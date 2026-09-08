export const SECONDARY_CLICK_INTERVAL_MS = 320

export type SecondaryClickSequence = {
  target: string
  occurredAt: number
}

export function registerSecondaryClick(
  previous: SecondaryClickSequence | null,
  next: SecondaryClickSequence,
): {
  shouldOpenPicker: boolean
  next: SecondaryClickSequence | null
} {
  const elapsed = previous ? next.occurredAt - previous.occurredAt : Number.POSITIVE_INFINITY
  const isMatchingSecondClick = previous?.target === next.target
    && elapsed >= 0
    && elapsed <= SECONDARY_CLICK_INTERVAL_MS

  return isMatchingSecondClick
    ? { shouldOpenPicker: true, next: null }
    : { shouldOpenPicker: false, next }
}
