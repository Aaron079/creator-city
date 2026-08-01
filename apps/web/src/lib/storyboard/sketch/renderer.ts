import { createCreatorSkillFingerprint } from '../../skills'
import type {
  StoryboardSketchFrame,
  StoryboardSketchSubjectAnchor,
} from './types'

type RenderableFrame = Omit<StoryboardSketchFrame, 'renderKey'>

function renderableFrame(frame: StoryboardSketchFrame): RenderableFrame {
  return {
    shotId: frame.shotId,
    status: frame.status,
    composition: frame.composition,
    camera: {
      label: frame.camera.label,
      angle: frame.camera.angle,
    },
    subjects: frame.subjects.map((subject) => ({
      label: subject.label,
      anchor: subject.anchor,
    })),
    actionLine: frame.actionLine,
    movement: frame.movement,
    notes: frame.notes.slice(),
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function positionFor(anchor: StoryboardSketchSubjectAnchor) {
  if (anchor === 'lower-left') return { x: 48, y: 102 }
  if (anchor === 'lower-right') return { x: 152, y: 102 }
  return { x: 100, y: 102 }
}

function actionArrow(frame: StoryboardSketchFrame) {
  if (frame.actionLine === 'none') return ''
  const coordinates = {
    'left-to-right': { x1: 66, y1: 75, x2: 132, y2: 75 },
    'right-to-left': { x1: 134, y1: 75, x2: 68, y2: 75 },
    'toward-camera': { x1: 100, y1: 42, x2: 100, y2: 90 },
    'away-camera': { x1: 100, y1: 90, x2: 100, y2: 42 },
  }[frame.actionLine]
  const deltaX = coordinates.x2 - coordinates.x1
  const deltaY = coordinates.y2 - coordinates.y1
  const length = Math.hypot(deltaX, deltaY)
  const unitX = deltaX / length
  const unitY = deltaY / length
  const baseX = coordinates.x2 - unitX * 7
  const baseY = coordinates.y2 - unitY * 7
  const leftX = baseX - unitY * 3
  const leftY = baseY + unitX * 3
  const rightX = baseX + unitY * 3
  const rightY = baseY - unitX * 3
  return `<path d="M${coordinates.x1} ${coordinates.y1} L${coordinates.x2} ${coordinates.y2}" fill="none" stroke="#171717" stroke-width="2" /><path d="M${leftX} ${leftY} L${coordinates.x2} ${coordinates.y2} L${rightX} ${rightY}" fill="none" stroke="#171717" stroke-width="2" />`
}

export function createStoryboardSketchRenderKey(frame: StoryboardSketchFrame) {
  return createCreatorSkillFingerprint('storyboard-sketch-frame', '1.0.0', {
    sourceNodes: [{
      id: frame.shotId,
      kind: 'text',
      title: '',
      prompt: JSON.stringify(renderableFrame(frame)),
    }],
  })
}

export function renderStoryboardSketchSvg(frame: StoryboardSketchFrame) {
  const cameraText = escapeXml(`${frame.camera.label} · ${frame.camera.angle}`)
  const statusText = frame.status === 'ready' ? '草图' : '需审核'
  const subjectMarks = frame.subjects.map((subject) => {
    const position = positionFor(subject.anchor)
    return `<g data-subject="true"><circle cx="${position.x}" cy="${position.y - 26}" r="8" fill="none" stroke="#171717" stroke-width="2" /><path d="M${position.x} ${position.y - 18} L${position.x} ${position.y + 12} M${position.x - 13} ${position.y - 3} L${position.x + 13} ${position.y - 3} M${position.x} ${position.y + 12} L${position.x - 11} ${position.y + 29} M${position.x} ${position.y + 12} L${position.x + 11} ${position.y + 29}" fill="none" stroke="#171717" stroke-width="2" /><text x="${position.x}" y="${position.y + 42}" text-anchor="middle" font-size="7" fill="#171717">${escapeXml(subject.label)}</text></g>`
  }).join('')
  const notes = frame.notes.map((note, index) => (
    `<text x="10" y="${144 + index * 9}" font-size="7" fill="#8a3126">${escapeXml(note)}</text>`
  )).join('')
  const footerY = 160 + frame.notes.length * 7
  const viewBoxHeight = Math.max(170, footerY + 10)

  return `<svg viewBox="0 0 200 ${viewBoxHeight}" role="img" aria-label="${escapeXml(`${statusText} ${frame.shotId}`)}"><rect x="1" y="1" width="198" height="${viewBoxHeight - 2}" fill="#f8f8f4" stroke="#171717" /><path d="M0 85 H200 M100 18 V128" stroke="#c6c6bf" stroke-dasharray="3 3" /><path d="M10 128 H190" stroke="#6c6c67" stroke-width="1.5" />${subjectMarks}${actionArrow(frame)}<text x="10" y="14" font-size="8" font-weight="700" fill="#171717">${escapeXml(statusText)}</text><text x="190" y="14" text-anchor="end" font-size="7" fill="#454541">${cameraText}</text><text x="10" y="${footerY}" font-size="7" fill="#454541">运镜: ${escapeXml(frame.movement)}</text>${notes}</svg>`
}
