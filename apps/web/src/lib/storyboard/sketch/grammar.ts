import type {
  ApprovedStoryboardShot,
  StoryboardSketchActionLine,
  StoryboardSketchCameraAngle,
  StoryboardSketchComposition,
  StoryboardSketchFrame,
  StoryboardSketchMovement,
  StoryboardSketchSubjectAnchor,
} from './types'

const SUBJECT_SEPARATOR = /\s*(?:、|，|,|和|与|及|以及|and)\s*/iu

function compositionFor(shot: ApprovedStoryboardShot, subjectCount: number): StoryboardSketchComposition {
  if (shot.suggestedShotSize === 'wide') return 'establishing'
  if (subjectCount > 1) return 'two-shot'
  if (shot.suggestedShotSize === 'close' || shot.suggestedShotSize === 'extreme-close') return 'detail'
  return 'single'
}

function cameraLabelFor(shot: ApprovedStoryboardShot): string {
  switch (shot.suggestedShotSize) {
    case 'wide': return '远景'
    case 'full': return '全景'
    case 'medium': return '中景'
    case 'close': return '近景'
    case 'extreme-close': return '特写'
  }
}

function cameraAngleFor(action: string): StoryboardSketchCameraAngle {
  if (/(?:俯拍|高机位|鸟瞰)/u.test(action)) return 'high'
  if (/(?:仰拍|低机位)/u.test(action)) return 'low'
  return 'eye-level'
}

function actionLineFor(action: string): StoryboardSketchActionLine {
  if (/(?:向右|往右|从左向右|左至右|左到右)/u.test(action)) return 'left-to-right'
  if (/(?:向左|往左|从右向左|右至左|右到左)/u.test(action)) return 'right-to-left'
  if (/(?:走近镜头|靠近镜头|朝镜头|向镜头)/u.test(action)) return 'toward-camera'
  if (/(?:远离镜头|背向镜头|离开镜头)/u.test(action)) return 'away-camera'
  return 'none'
}

function movementFor(action: string): StoryboardSketchMovement {
  if (/(?:推进|拉远|跟拍|跟随|轨道)/u.test(action)) return 'dolly'
  if (/(?:摇镜|横摇|pan)/iu.test(action)) return 'pan'
  if (/(?:俯仰|tilt)/iu.test(action)) return 'tilt'
  if (/(?:变焦|推近|zoom)/iu.test(action)) return 'zoom'
  if (/(?:手持|晃动)/u.test(action)) return 'handheld'
  return 'static'
}

function subjectAnchors(subjects: string[]): StoryboardSketchSubjectAnchor[] {
  if (subjects.length === 1) return ['lower-center']
  return subjects.map((_, index) => {
    const anchors: StoryboardSketchSubjectAnchor[] = ['lower-left', 'lower-right', 'lower-center']
    return anchors[index % anchors.length]!
  })
}

function createRenderKey(frame: Omit<StoryboardSketchFrame, 'renderKey'>): string {
  return `storyboard-sketch-v1:${JSON.stringify(frame)}`
}

export function deriveStoryboardSketchFrame(shot: ApprovedStoryboardShot): StoryboardSketchFrame {
  const subjectLabels = shot.subject
    .split(SUBJECT_SEPARATOR)
    .map((value) => value.trim())
    .filter(Boolean)
  const hasUnsupportedSubjectLayout = subjectLabels.length > 3
  const frameSubjects = hasUnsupportedSubjectLayout ? [] : subjectLabels
  const action = shot.action.trim()
  const anchors = subjectAnchors(frameSubjects)
  const notes: string[] = []

  if (shot.decision !== 'approved') notes.push('镜头尚未审核通过，需审核后再生成草图分镜。')
  if (subjectLabels.length === 0) notes.push('缺少主体，需审核后再生成草图分镜。')
  if (hasUnsupportedSubjectLayout) notes.push('主体超过当前草图布局上限，需审核后拆分镜头。')
  if (!action) notes.push('缺少动作，需审核后再生成草图分镜。')

  const frameWithoutKey = {
    shotId: shot.shotId,
    status: notes.length === 0 ? 'ready' as const : 'needs-review' as const,
    composition: compositionFor(shot, subjectLabels.length),
    camera: {
      label: cameraLabelFor(shot),
      angle: cameraAngleFor(action),
    },
    subjects: frameSubjects.map((label, index) => ({
      label,
      anchor: anchors[index]!,
    })),
    actionLine: actionLineFor(action),
    movement: movementFor(action),
    notes,
  }

  return { ...frameWithoutKey, renderKey: createRenderKey(frameWithoutKey) }
}
