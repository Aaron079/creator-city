import type { DirectorControlInput, DirectorControlOutput } from './types'
import {
  SHOT_TYPE_PRESETS,
  CAMERA_MOVEMENT_PRESETS,
  STYLE_PRESETS,
  LIGHTING_PRESETS,
  COLOR_PRESETS,
  RHYTHM_PRESETS,
} from './presets'

export function compileDirectorPrompt(input: DirectorControlInput): DirectorControlOutput {
  const { basePrompt, shotType, cameraMovement, style, lighting, color, rhythm, target = 'image' } = input

  const positives: string[] = []
  const negatives: string[] = []
  const metadata = {
    shotTypeLabel: '',
    cameraMovementLabel: '',
    styleLabel: '',
    lightingLabel: '',
    colorLabel: '',
    rhythmLabel: '',
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
    metadata.shotTypeLabel,
    metadata.cameraMovementLabel,
    metadata.styleLabel,
    metadata.lightingLabel,
    metadata.colorLabel,
    metadata.rhythmLabel,
  ].filter(Boolean)
  metadata.summarySentence = labels.join(' · ')

  return { finalPrompt, positiveDirectives: deduped, negativeDirectives: [...new Set(negatives)], metadata }
}

export function hasDirectorControls(params: Omit<DirectorControlInput, 'basePrompt'>): boolean {
  return Boolean(params.shotType || params.cameraMovement || params.style || params.lighting || params.color || params.rhythm)
}
