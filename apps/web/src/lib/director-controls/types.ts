export type ShotType = 'wide' | 'medium' | 'close' | 'extreme-close'
export type CameraMovement = 'push-in' | 'pull-out' | 'pan' | 'dolly' | 'tracking' | 'overhead'
export type DirectorStyle = 'cinematic' | 'commercial' | 'short-drama' | 'manhua' | 'realistic' | 'fantasy'
export type Lighting = 'backlight' | 'rembrandt' | 'neon' | 'natural'
export type Color = 'cool' | 'warm' | 'high-contrast' | 'low-saturation'
export type Rhythm = 'slow-motion' | 'fast-paced' | 'stable-shot'
export type CameraBody = 'cinema' | 'handheld' | 'drone' | 'studio'
export type LensType = 'wide-angle' | 'standard' | 'telephoto' | 'macro'
export type FocalLength = '14mm' | '24mm' | '35mm' | '50mm' | '85mm' | '135mm'
export type Aperture = 'f1.4' | 'f2.8' | 'f4' | 'f8' | 'f11'

export type AssetPreviewConfig = {
  filter?: string
  transform?: string
  animation?: string
  playbackRate?: number
  overlayGradient?: string
}

export type DirectorControlInput = {
  basePrompt: string
  shotType?: ShotType
  cameraMovement?: CameraMovement
  style?: DirectorStyle
  lighting?: Lighting
  color?: Color
  rhythm?: Rhythm
  cameraBody?: CameraBody
  lensType?: LensType
  focalLength?: FocalLength
  aperture?: Aperture
  target?: 'image' | 'video'
}

export type DirectorControlMetadata = {
  shotTypeLabel: string
  cameraMovementLabel: string
  styleLabel: string
  lightingLabel: string
  colorLabel: string
  rhythmLabel: string
  cameraBodyLabel: string
  lensTypeLabel: string
  focalLengthLabel: string
  apertureLabel: string
  summarySentence: string
}

export type DirectorControlOutput = {
  finalPrompt: string
  positiveDirectives: string[]
  negativeDirectives: string[]
  metadata: DirectorControlMetadata
}

export type DirectorControlParams = Omit<DirectorControlInput, 'basePrompt'>
