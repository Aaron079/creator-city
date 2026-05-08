export type StoryboardMissingKind = 'text' | 'image' | 'video'

export type StoryboardShot = {
  id: string
  order: number
  nodeIds: string[]
  textNodeId?: string
  imageNodeId?: string
  videoNodeId?: string
  text?: string
  imageUrl?: string
  videoUrl?: string
  prompt?: string
  providerId?: string
  model?: string
  status?: string
  compiledPromptPreview?: string
  missing: StoryboardMissingKind[]
  notes?: string
  hidden?: boolean
}

export type StoryboardCanvasNode = {
  id: string
  type?: string
  kind?: string
  title?: string
  prompt?: string
  providerId?: string
  model?: string
  status?: string
  resultText?: string
  resultImageUrl?: string
  resultVideoUrl?: string
  resultPreview?: string
  outputLabel?: string
  errorMessage?: string
  metadataJson?: unknown
  x?: number
  createdAt?: number | string
  updatedAt?: number | string
}

export type StoryboardCanvasEdge = {
  id?: string
  fromNodeId?: string
  toNodeId?: string
  source?: string
  target?: string
}
