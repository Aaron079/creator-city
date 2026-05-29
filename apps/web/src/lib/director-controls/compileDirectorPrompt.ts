import type { DirectorControlInput, DirectorControlOutput, DirectorControlParams, AssetPreviewConfig } from './types'
import {
  SHOT_TYPE_PRESETS,
  CAMERA_MOVEMENT_PRESETS,
  STYLE_PRESETS,
  LIGHTING_PRESETS,
  COLOR_PRESETS,
  RHYTHM_PRESETS,
  CAMERA_BODY_PRESETS,
  LENS_TYPE_PRESETS,
  FOCAL_LENGTH_PRESETS,
  APERTURE_PRESETS,
} from './presets'

export function compileDirectorPrompt(input: DirectorControlInput): DirectorControlOutput {
  const {
    basePrompt, shotType, cameraMovement, style, lighting, color, rhythm,
    cameraBody, lensType, focalLength, aperture, target = 'image',
  } = input

  const positives: string[] = []
  const negatives: string[] = []
  const metadata = {
    shotTypeLabel: '',
    cameraMovementLabel: '',
    styleLabel: '',
    lightingLabel: '',
    colorLabel: '',
    rhythmLabel: '',
    cameraBodyLabel: '',
    lensTypeLabel: '',
    focalLengthLabel: '',
    apertureLabel: '',
    summarySentence: '',
  }

  if (shotType && SHOT_TYPE_PRESETS[shotType]) {
    const p = SHOT_TYPE_PRESETS[shotType]
    positives.push(...p.positives)
    negatives.push(...p.negatives)
    metadata.shotTypeLabel = p.label
  }

  if (cameraMovement && CAMERA_MOVEMENT_PRESETS[cameraMovement]) {
    const p = CAMERA_MOVEMENT_PRESETS[cameraMovement]
    positives.push(...p.positives)
    negatives.push(...p.negatives)
    metadata.cameraMovementLabel = p.label
  }

  if (style && STYLE_PRESETS[style]) {
    const p = STYLE_PRESETS[style]
    positives.push(...p.positives)
    negatives.push(...p.negatives)
    metadata.styleLabel = p.label
  }

  if (lighting && LIGHTING_PRESETS[lighting]) {
    const p = LIGHTING_PRESETS[lighting]
    positives.push(...p.positives)
    negatives.push(...p.negatives)
    metadata.lightingLabel = p.label
  }

  if (color && COLOR_PRESETS[color]) {
    const p = COLOR_PRESETS[color]
    positives.push(...p.positives)
    negatives.push(...p.negatives)
    metadata.colorLabel = p.label
  }

  if (rhythm && RHYTHM_PRESETS[rhythm]) {
    const p = RHYTHM_PRESETS[rhythm]
    positives.push(...p.positives)
    negatives.push(...p.negatives)
    metadata.rhythmLabel = p.label
  }

  if (cameraBody && CAMERA_BODY_PRESETS[cameraBody]) {
    const p = CAMERA_BODY_PRESETS[cameraBody]
    positives.push(...p.positives)
    negatives.push(...p.negatives)
    metadata.cameraBodyLabel = p.label
  }

  if (lensType && LENS_TYPE_PRESETS[lensType]) {
    const p = LENS_TYPE_PRESETS[lensType]
    positives.push(...p.positives)
    negatives.push(...p.negatives)
    metadata.lensTypeLabel = p.label
  }

  if (focalLength && FOCAL_LENGTH_PRESETS[focalLength]) {
    const p = FOCAL_LENGTH_PRESETS[focalLength]
    positives.push(...p.positives)
    negatives.push(...p.negatives)
    metadata.focalLengthLabel = p.label
  }

  if (aperture && APERTURE_PRESETS[aperture]) {
    const p = APERTURE_PRESETS[aperture]
    positives.push(...p.positives)
    negatives.push(...p.negatives)
    metadata.apertureLabel = p.label
  }

  const deduped = [...new Set(positives)]

  // For video, directives appear after the base prompt — better for Chinese video models like Seedance.
  // For image, they are appended inline.
  const directiveStr = deduped.join(', ')
  const trimmedBase = basePrompt.trim()

  let finalPrompt: string
  if (!trimmedBase && !directiveStr) {
    finalPrompt = ''
  } else if (!trimmedBase) {
    finalPrompt = directiveStr
  } else if (!directiveStr) {
    finalPrompt = trimmedBase
  } else {
    finalPrompt = target === 'video'
      ? `${trimmedBase}，${directiveStr}`
      : `${trimmedBase}, ${directiveStr}`
  }

  const labels = [
    metadata.cameraBodyLabel,
    metadata.shotTypeLabel,
    metadata.cameraMovementLabel,
    metadata.styleLabel,
    metadata.lightingLabel,
    metadata.colorLabel,
    metadata.rhythmLabel,
    metadata.lensTypeLabel,
    metadata.focalLengthLabel,
    metadata.apertureLabel,
  ].filter(Boolean)
  metadata.summarySentence = labels.join(' · ')

  return { finalPrompt, positiveDirectives: deduped, negativeDirectives: [...new Set(negatives)], metadata }
}

export function hasDirectorControls(params: Omit<DirectorControlInput, 'basePrompt'>): boolean {
  return Boolean(
    params.shotType || params.cameraMovement || params.style || params.lighting ||
    params.color || params.rhythm || params.cameraBody || params.lensType ||
    params.focalLength || params.aperture,
  )
}

/**
 * Computes CSS-level preview effects from director controls.
 * These affect the visual appearance of existing media nodes in real time
 * without triggering re-generation.
 */
export function compileAssetPreview(params: DirectorControlParams): AssetPreviewConfig {
  const config: AssetPreviewConfig = {}

  // Color → CSS filter
  if (params.color) {
    switch (params.color) {
      case 'cool':
        config.filter = 'saturate(0.8) hue-rotate(15deg) brightness(0.97)'
        break
      case 'warm':
        config.filter = 'saturate(1.15) sepia(0.18) brightness(1.03)'
        break
      case 'high-contrast':
        config.filter = 'contrast(1.35) brightness(0.95)'
        break
      case 'low-saturation':
        config.filter = 'saturate(0.35) brightness(1.04)'
        break
    }
  }

  // Lighting → overlay gradient
  if (params.lighting) {
    switch (params.lighting) {
      case 'backlight':
        config.overlayGradient = 'radial-gradient(ellipse at center, transparent 40%, rgba(255,200,100,0.18) 100%)'
        break
      case 'rembrandt':
        config.overlayGradient = 'linear-gradient(to right, rgba(0,0,0,0.32) 0%, transparent 55%)'
        break
      case 'neon':
        config.overlayGradient = 'linear-gradient(135deg, rgba(0,200,255,0.10) 0%, rgba(255,0,200,0.10) 100%)'
        break
      case 'natural':
        config.overlayGradient = 'linear-gradient(to bottom, rgba(255,220,150,0.07) 0%, transparent 50%)'
        break
    }
  }

  // CameraMovement → CSS animation name (keyframes defined in canvas.module.css)
  if (params.cameraMovement) {
    switch (params.cameraMovement) {
      case 'push-in':
        config.animation = 'dc-push-in 3s ease-in-out forwards'
        break
      case 'pull-out':
        config.animation = 'dc-pull-out 3s ease-in-out forwards'
        break
      case 'pan':
        config.animation = 'dc-pan 4s ease-in-out infinite alternate'
        break
      case 'dolly':
        config.animation = 'dc-dolly 4s ease-in-out infinite alternate'
        break
      default:
        break
    }
  }

  // Rhythm → video playback rate
  if (params.rhythm) {
    switch (params.rhythm) {
      case 'slow-motion':
        config.playbackRate = 0.5
        break
      case 'fast-paced':
        config.playbackRate = 1.5
        break
      case 'stable-shot':
        config.playbackRate = 1.0
        break
    }
  }

  return config
}
