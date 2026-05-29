export type ShotType = 'wide' | 'medium' | 'close' | 'extreme-close'
export type CameraMovement = 'push-in' | 'pull-out' | 'pan' | 'dolly' | 'tracking' | 'overhead'
export type DirectorStyle = 'cinematic' | 'commercial' | 'short-drama' | 'manhua' | 'realistic' | 'fantasy'
export type Lighting = 'backlight' | 'rembrandt' | 'neon' | 'natural'
export type Color = 'cool' | 'warm' | 'high-contrast' | 'low-saturation'
export type Rhythm = 'slow-motion' | 'fast-paced' | 'stable-shot'

export type DirectorControlInput = {
  basePrompt: string
  shotType?: ShotType
  cameraMovement?: CameraMovement
  style?: DirectorStyle
  lighting?: Lighting
  color?: Color
  rhythm?: Rhythm
  target?: 'image' | 'video'
}

export type DirectorControlMetadata = {
  shotTypeLabel: string
  cameraMovementLabel: string
  styleLabel: string
  lightingLabel: string
  colorLabel: string
  rhythmLabel: string
  summarySentence: string
}

export type DirectorControlOutput = {
  finalPrompt: string
  positiveDirectives: string[]
  negativeDirectives: string[]
  metadata: DirectorControlMetadata
}

export type DirectorControlParams = Omit<DirectorControlInput, 'basePrompt'>
