export type NarrativeBeatType =
  | 'setup'
  | 'goal'
  | 'action'
  | 'reaction'
  | 'turn'
  | 'closure'
  | 'unclassified'

export type NarrativeBeatDraft = {
  beatId: string
  sceneId: string
  order: number
  type: NarrativeBeatType
  sourceText: string
  summary: string
  lineStart: number
  lineEnd: number
  reviewStatus: 'pending'
  needsReviewReason?: string
}

export type NarrativeBeatMapPayload = {
  scenes: Array<{
    sceneId: string
    order: number
    heading: string
    beats: NarrativeBeatDraft[]
  }>
}
