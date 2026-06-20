import { getCameraPromptDescription } from './cameraModelDatabase'

export interface CameraSettings {
  cameraBody: string
  lens: string
  aperture: string
  focus: string
}

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  cameraBody: '',
  lens: '',
  aperture: '',
  focus: '',
}

export function hasCameraContext(settings: CameraSettings): boolean {
  return Boolean(settings.cameraBody || settings.lens || settings.aperture || settings.focus)
}

// Lens, aperture, focus prompt dictionaries (unchanged — no new dependency)
const LENS_PROMPT: Record<string, string> = {
  '18mm': '18mm ultra-wide lens, expansive environment, strong spatial perspective, immersive wide-angle',
  '24mm': '24mm wide angle, classic cinema establishing shot, slight environment emphasis',
  '35mm': '35mm, natural humanist storytelling perspective, slightly wider than eye-level',
  '50mm': '50mm standard lens, closest to human eye perception, neutral and unbiased framing',
  '85mm': '85mm portrait lens, subject isolation, gentle background compression, flattering perspective',
  '135mm': '135mm telephoto, strong background compression, cinematic voyeur feel, subject extracted from environment',
}

const APERTURE_PROMPT: Record<string, string> = {
  'f/1.4': 'f/1.4, extreme shallow depth of field, dreamlike bokeh, subject pops from blurred background',
  'f/2.0': 'f/2.0, shallow depth of field, subject isolation, soft cinematic background',
  'f/2.8': 'f/2.8, cinema sweet spot, subject sharp, pleasing background blur',
  'f/5.6': 'f/5.6, moderate depth of field, environment visible, balanced foreground and background',
  'f/8': 'f/8, deep focus, documentary clarity, everything sharp from foreground to horizon',
}

const FOCUS_PROMPT: Record<string, string> = {
  'Face Focus': 'autofocus locked on face, character-forward composition, face in crisp focus',
  'Eye Focus': 'eye-level precision focus, highly personal and direct, eyes pin-sharp',
  'Foreground Focus': 'foreground subject in sharp focus, background dreamy and out of focus',
  'Background Focus': 'background in sharp focus, foreground element blurred, depth and mystery',
  'Rack Focus': 'rack focus pull, focal plane shifts from foreground to background mid-shot',
  'Soft Focus': 'soft overall focus, ethereal and dreamlike, gentle halation throughout',
}

export function buildCameraPromptContext(settings: CameraSettings): string {
  if (!hasCameraContext(settings)) return ''

  const lines: string[] = []
  if (settings.cameraBody) {
    // getCameraPromptDescription handles both new ids and legacy display-name values
    lines.push(`Camera Body: ${getCameraPromptDescription(settings.cameraBody)}`)
  }
  if (settings.lens) lines.push(`Lens: ${LENS_PROMPT[settings.lens] ?? settings.lens}`)
  if (settings.aperture) lines.push(`Aperture: ${APERTURE_PROMPT[settings.aperture] ?? settings.aperture}`)
  if (settings.focus) lines.push(`Focus: ${FOCUS_PROMPT[settings.focus] ?? settings.focus}`)

  return (
    '\n\n[Creator City Camera Direction]\n' +
    lines.join('\n') +
    '\nRule: Apply this camera direction consistently to maintain cinematic coherence.'
  )
}

export function appendCameraContextToPrompt(prompt: string, cameraCtx: string): string {
  if (!cameraCtx.trim()) return prompt
  return prompt + cameraCtx
}

export function buildCameraSummaryText(settings: CameraSettings): string {
  return [settings.cameraBody, settings.lens, settings.aperture, settings.focus].filter(Boolean).join(' · ')
}
