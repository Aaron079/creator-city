import type { ShotPlanDraft } from '../../skills/shot-planning/types'
import type { RecipeReviewItem } from '../recipe/types'

export type StoryboardSketchComposition =
  | 'establishing'
  | 'two-shot'
  | 'single'
  | 'detail'

export type StoryboardSketchCameraAngle = 'eye-level' | 'high' | 'low'

export type StoryboardSketchSubjectAnchor =
  | 'lower-left'
  | 'lower-center'
  | 'lower-right'

export type StoryboardSketchActionLine =
  | 'none'
  | 'left-to-right'
  | 'right-to-left'
  | 'toward-camera'
  | 'away-camera'

export type StoryboardSketchMovement =
  | 'static'
  | 'pan'
  | 'tilt'
  | 'dolly'
  | 'zoom'
  | 'handheld'

export type StoryboardSketchFrame = {
  shotId: string
  renderKey: string
  status: 'ready' | 'needs-review' | 'stale'
  composition: StoryboardSketchComposition
  camera: {
    label: string
    angle: StoryboardSketchCameraAngle
  }
  subjects: Array<{
    label: string
    anchor: StoryboardSketchSubjectAnchor
  }>
  actionLine: StoryboardSketchActionLine
  movement: StoryboardSketchMovement
  notes: string[]
}

export type ApprovedStoryboardShot = RecipeReviewItem<ShotPlanDraft> & {
  decision: 'approved'
}
