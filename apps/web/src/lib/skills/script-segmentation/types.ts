export type ScriptSceneDraft = {
  sceneId: string
  order: number
  heading: string
  location?: string
  timeOfDay?: string
  characters: string[]
  actionSummary: string
  sourceText: string
  lineStart: number
  lineEnd: number
  reviewStatus: 'pending'
}

export type SceneBreakdownPayload = {
  format: 'headed-script' | 'paragraph-fallback'
  scenes: ScriptSceneDraft[]
}
