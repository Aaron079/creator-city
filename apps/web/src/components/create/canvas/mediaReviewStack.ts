export const MEDIA_REVIEW_STACK_MAX_INDEX = 299

export type MediaReviewStackItem = {
  id: string
  zIndex: number
}

export function prioritizeMediaReview<T extends MediaReviewStackItem>(
  items: readonly T[],
  focusedId: string,
  requestedZIndex: number,
) {
  if (requestedZIndex <= MEDIA_REVIEW_STACK_MAX_INDEX) {
    return {
      items: items.map((item) => item.id === focusedId ? { ...item, zIndex: requestedZIndex } : item),
      nextZIndex: requestedZIndex,
    }
  }

  const ordered = items
    .filter((item) => item.id !== focusedId)
    .sort((left, right) => left.zIndex - right.zIndex)
  const focusZIndex = Math.min(ordered.length + 1, MEDIA_REVIEW_STACK_MAX_INDEX)
  const normalizedZIndices = new Map(
    ordered.map((item, index) => [item.id, (index % (MEDIA_REVIEW_STACK_MAX_INDEX - 1)) + 1]),
  )

  return {
    items: items.map((item) => ({
      ...item,
      zIndex: item.id === focusedId ? focusZIndex : normalizedZIndices.get(item.id) ?? item.zIndex,
    })),
    nextZIndex: focusZIndex,
  }
}
