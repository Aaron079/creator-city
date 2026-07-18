export type PlannedShotSize = 'wide' | 'full' | 'medium' | 'close' | 'extreme-close'

export type ShotOutputKind = 'image' | 'video'

export type ShotPlanningOptions = {
  requestedShotCount: number
  outputMode: 'image' | 'video' | 'mixed'
  pacing: 'slow_cinematic' | 'standard' | 'fast_social'
  shotSizeStrategy: 'auto' | 'wide_to_close' | 'close_heavy' | 'wide_heavy'
  userInstruction: string
}

export type ShotPlanDraft = {
  shotId: string
  sceneId: string
  beatId?: string
  order: number
  objective: string
  subject: string
  action: string
  suggestedShotSize: PlannedShotSize
  sourceText: string
  lineStart: number
  lineEnd: number
  outputKind: ShotOutputKind
  duration: 5 | 10
  reviewStatus: 'pending'
  needsReviewReason?: string
}

export type ShotPlanPayload = {
  scenes: Array<{
    sceneId: string
    order: number
    heading: string
    shots: ShotPlanDraft[]
  }>
}

export type ShotSourceUnit = {
  sceneId: string
  sceneOrder: number
  heading: string
  beatId?: string
  beatType?: string
  text: string
  lineStart: number
  lineEnd: number
}
