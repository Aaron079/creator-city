// ─── Camera System: full professional cinema parameter definitions ────────────

export const SHOT_FRAMES = [
  'ECU', 'CU', 'MCU', 'MS', 'MWS', 'WS', 'EWS', 'OTS', 'POV', 'Insert',
] as const
export type ShotFrame = typeof SHOT_FRAMES[number]

export const ANGLES = [
  'Eye Level', 'Low Angle', 'High Angle', "Bird's Eye",
  'Dutch Angle', "Worm's Eye", 'Overhead',
] as const
export type CameraAngle = typeof ANGLES[number]

// ─── Movements ────────────────────────────────────────────────────────────────

export const MOVEMENTS_BASIC = ['Static', 'Pan L', 'Pan R', 'Tilt Up', 'Tilt Down'] as const
export const MOVEMENTS_ADVANCED = ['Dolly In', 'Dolly Out', 'Track L', 'Track R', 'Crane Up', 'Crane Down', 'Handheld', 'Steadicam', 'Push In', 'Pull Out', 'Arc L', 'Arc R', 'Whip Pan', 'Roll'] as const
export const MOVEMENTS_FX = ['Bullet Time', 'Vertigo', 'Time Lapse', 'Rack Focus', 'Snap Zoom', 'Reverse'] as const

export const ALL_MOVEMENTS = [...MOVEMENTS_BASIC, ...MOVEMENTS_ADVANCED, ...MOVEMENTS_FX]
export type Movement = typeof ALL_MOVEMENTS[number]

export const MOVEMENT_GROUPS: { label: string; options: readonly string[] }[] = [
  { label: '基础运镜', options: MOVEMENTS_BASIC },
  { label: '高级运镜', options: MOVEMENTS_ADVANCED },
  { label: '特效镜头', options: MOVEMENTS_FX },
]

// ─── Optics ───────────────────────────────────────────────────────────────────

export const FOCAL_LENGTHS = [14, 18, 24, 28, 35, 50, 85, 100, 135, 200] as const
export type FocalLength = typeof FOCAL_LENGTHS[number]

export const FOCAL_LENS_CHARS: Record<number, string> = {
  14:  '超广角 · 畸变感强',
  18:  '广角 · 环境交代',
  24:  '广角 · 新闻感',
  28:  '准广角 · 叙事自然',
  35:  '人文焦段 · 接近人眼',
  50:  '标准 · 最真实感知',
  85:  '人像首选 · 压缩背景',
  100: '中长焦 · 细节捕捉',
  135: '长焦 · 浅景深',
  200: '超长焦 · 极致压缩',
}

export const APERTURES = ['f/1.2', 'f/1.4', 'f/1.8', 'f/2.0', 'f/2.8', 'f/4', 'f/5.6', 'f/8', 'f/11', 'f/16'] as const
export type Aperture = typeof APERTURES[number]

export const SPEEDS = ['0.1×', '0.25×', '0.5×', '1×', '2×', '4×', 'Reverse'] as const
export type Speed = typeof SPEEDS[number]

// ─── Lighting ─────────────────────────────────────────────────────────────────

export const LIGHTING_TYPES = [
  'Natural', 'Key Light', 'Three Point', 'Silhouette',
  'Chiaroscuro', 'Neon', 'Golden Hour', 'Blue Hour', 'Practical', 'Backlight',
] as const
export type LightingType = typeof LIGHTING_TYPES[number]

export const LIGHTING_POSITIONS = [
  'Front', '45° Side', 'Side', 'Backlight', 'Overhead', 'Underlight', 'Rim',
] as const
export type LightingPosition = typeof LIGHTING_POSITIONS[number]

// ─── Color ────────────────────────────────────────────────────────────────────

export const COLOR_LUTS = [
  'Rec.709', 'Kodak Vision3', 'Fuji Provia', 'Teal & Orange',
  'Bleach Bypass', 'Cross Process', 'Cyberpunk Neon',
  'Warm Vintage', 'Cold Steel', 'Moody Noir',
] as const
export type ColorLUT = typeof COLOR_LUTS[number]

// ─── Extended camera params ────────────────────────────────────────────────────

export interface CameraParams {
  // Shot geometry
  framing:           string   // ShotFrame
  angle:             string   // CameraAngle
  movement:          string   // Movement
  // Optics
  focalLength:       number   // mm: 14–200
  aperture:          string   // Aperture
  speed:             string   // Speed
  // Lighting
  lightingType:      string   // LightingType
  lightingPosition:  string   // LightingPosition
  lightingIntensity: number   // 0–100
  // Color
  colorLUT:          string   // ColorLUT
  colorTemp:         number   // 2000–8000 K
  contrast:          number   // 0–100
  saturation:        number   // 0–100
  highlights:        number   // 0–100
  shadows:           number   // 0–100
}

// ─── Presets ──────────────────────────────────────────────────────────────────

export interface CameraPreset {
  id:     string
  label:  string
  desc:   string
  accent: string
  icon:   string
  params: CameraParams
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'cinematic', label: 'Cinematic', desc: '电影级叙事', accent: '#a5b4fc', icon: '🎬',
    params: {
      framing: 'WS', angle: 'Low Angle', movement: 'Dolly In',
      focalLength: 35, aperture: 'f/1.8', speed: '1×',
      lightingType: 'Chiaroscuro', lightingPosition: '45° Side', lightingIntensity: 70,
      colorLUT: 'Kodak Vision3', colorTemp: 4200,
      contrast: 65, saturation: 45, highlights: 40, shadows: 30,
    },
  },
  {
    id: 'commercial', label: 'Commercial', desc: '商业广告级', accent: '#fbbf24', icon: '📢',
    params: {
      framing: 'MCU', angle: 'Eye Level', movement: 'Static',
      focalLength: 85, aperture: 'f/2.8', speed: '1×',
      lightingType: 'Three Point', lightingPosition: 'Front', lightingIntensity: 88,
      colorLUT: 'Rec.709', colorTemp: 5500,
      contrast: 50, saturation: 62, highlights: 55, shadows: 48,
    },
  },
  {
    id: 'documentary', label: 'Documentary', desc: '纪录写实风', accent: '#34d399', icon: '📹',
    params: {
      framing: 'MS', angle: 'Eye Level', movement: 'Handheld',
      focalLength: 28, aperture: 'f/4', speed: '1×',
      lightingType: 'Natural', lightingPosition: '45° Side', lightingIntensity: 60,
      colorLUT: 'Fuji Provia', colorTemp: 5600,
      contrast: 45, saturation: 50, highlights: 52, shadows: 52,
    },
  },
  {
    id: 'cyberpunk', label: 'Cyberpunk', desc: '赛博霓虹感', accent: '#f43f5e', icon: '🌆',
    params: {
      framing: 'ECU', angle: 'Low Angle', movement: 'Handheld',
      focalLength: 14, aperture: 'f/2.8', speed: '1×',
      lightingType: 'Neon', lightingPosition: 'Rim', lightingIntensity: 92,
      colorLUT: 'Cyberpunk Neon', colorTemp: 3200,
      contrast: 80, saturation: 85, highlights: 60, shadows: 18,
    },
  },
]

export const DEFAULT_CAMERA_PARAMS: CameraParams = CAMERA_PRESETS[0]!.params
