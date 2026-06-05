export interface CinematicOption {
  id: string
  zhLabel: string
  promptHint: string
}

export interface CinematicGroup {
  key: string
  zhTitle: string
  options: CinematicOption[]
}

export const CINEMATIC_GROUPS: CinematicGroup[] = [
  {
    key: 'shotSize',
    zhTitle: '景别',
    options: [
      { id: 'extreme-close-up', zhLabel: '极近景', promptHint: 'extreme close-up shot' },
      { id: 'close-up', zhLabel: '近景', promptHint: 'close-up shot' },
      { id: 'medium', zhLabel: '中景', promptHint: 'medium shot' },
      { id: 'full-body', zhLabel: '全身', promptHint: 'full body shot' },
      { id: 'wide', zhLabel: '广角', promptHint: 'wide shot' },
      { id: 'aerial', zhLabel: '俯瞰全景', promptHint: 'aerial wide shot' },
    ],
  },
  {
    key: 'cameraAngle',
    zhTitle: '摄影角度',
    options: [
      { id: 'eye-level', zhLabel: '平视', promptHint: 'eye-level angle' },
      { id: 'low-angle', zhLabel: '仰角', promptHint: 'low angle' },
      { id: 'high-angle', zhLabel: '俯角', promptHint: 'high angle' },
      { id: 'dutch', zhLabel: '荷兰角', promptHint: 'Dutch angle' },
      { id: 'birds-eye', zhLabel: '鸟瞰', promptHint: "bird's eye view" },
      { id: 'worms-eye', zhLabel: '虫视', promptHint: "worm's eye view" },
    ],
  },
  {
    key: 'cameraMovement',
    zhTitle: '运镜',
    options: [
      { id: 'static', zhLabel: '静止', promptHint: 'static camera' },
      { id: 'pan', zhLabel: '横摇', promptHint: 'camera pan' },
      { id: 'tilt', zhLabel: '垂摇', promptHint: 'camera tilt' },
      { id: 'dolly', zhLabel: '移镜', promptHint: 'dolly shot' },
      { id: 'zoom-in', zhLabel: '推镜', promptHint: 'slow zoom in' },
      { id: 'zoom-out', zhLabel: '拉镜', promptHint: 'slow zoom out' },
      { id: 'handheld', zhLabel: '手持抖动', promptHint: 'handheld camera movement' },
    ],
  },
  {
    key: 'lens',
    zhTitle: '镜头',
    options: [
      { id: 'wide-angle', zhLabel: '广角', promptHint: 'wide-angle lens' },
      { id: 'normal', zhLabel: '标准', promptHint: 'normal lens' },
      { id: 'telephoto', zhLabel: '长焦', promptHint: 'telephoto lens' },
      { id: 'macro', zhLabel: '微距', promptHint: 'macro lens' },
      { id: 'fisheye', zhLabel: '鱼眼', promptHint: 'fisheye lens' },
      { id: 'tilt-shift', zhLabel: '移轴', promptHint: 'tilt-shift lens' },
    ],
  },
  {
    key: 'lighting',
    zhTitle: '打光',
    options: [
      { id: 'golden-hour', zhLabel: '黄金时刻', promptHint: 'golden hour lighting' },
      { id: 'blue-hour', zhLabel: '蓝调时刻', promptHint: 'blue hour lighting' },
      { id: 'natural', zhLabel: '自然光', promptHint: 'natural lighting' },
      { id: 'studio', zhLabel: '棚拍灯光', promptHint: 'studio lighting' },
      { id: 'rembrandt', zhLabel: '伦勃朗光', promptHint: 'Rembrandt lighting' },
      { id: 'backlit', zhLabel: '逆光', promptHint: 'backlit' },
      { id: 'neon', zhLabel: '霓虹灯', promptHint: 'neon lighting' },
    ],
  },
  {
    key: 'colorPalette',
    zhTitle: '色调',
    options: [
      { id: 'warm', zhLabel: '暖色', promptHint: 'warm color palette' },
      { id: 'cool', zhLabel: '冷色', promptHint: 'cool color palette' },
      { id: 'desaturated', zhLabel: '低饱和', promptHint: 'desaturated tones' },
      { id: 'vibrant', zhLabel: '高饱和', promptHint: 'vibrant colors' },
      { id: 'monochrome', zhLabel: '黑白', promptHint: 'monochrome' },
      { id: 'retro', zhLabel: '复古胶片', promptHint: 'retro film look' },
      { id: 'teal-orange', zhLabel: '青橙调', promptHint: 'teal and orange color grading' },
    ],
  },
  {
    key: 'composition',
    zhTitle: '构图',
    options: [
      { id: 'rule-of-thirds', zhLabel: '三分法', promptHint: 'rule of thirds composition' },
      { id: 'center', zhLabel: '中心对称', promptHint: 'centered symmetrical composition' },
      { id: 'leading-lines', zhLabel: '引导线', promptHint: 'leading lines composition' },
      { id: 'frame-in-frame', zhLabel: '框中框', promptHint: 'frame within a frame' },
      { id: 'negative-space', zhLabel: '留白', promptHint: 'negative space composition' },
    ],
  },
  {
    key: 'mood',
    zhTitle: '氛围',
    options: [
      { id: 'epic', zhLabel: '史诗感', promptHint: 'epic atmosphere' },
      { id: 'intimate', zhLabel: '亲密感', promptHint: 'intimate mood' },
      { id: 'dramatic', zhLabel: '戏剧张力', promptHint: 'dramatic tension' },
      { id: 'serene', zhLabel: '宁静', promptHint: 'serene mood' },
      { id: 'mysterious', zhLabel: '神秘感', promptHint: 'mysterious atmosphere' },
      { id: 'melancholic', zhLabel: '忧郁', promptHint: 'melancholic mood' },
      { id: 'energetic', zhLabel: '活力', promptHint: 'energetic vibe' },
    ],
  },
  {
    key: 'textureStyle',
    zhTitle: '质感',
    options: [
      { id: 'film-grain', zhLabel: '胶片颗粒', promptHint: 'film grain texture' },
      { id: 'hyper-real', zhLabel: '超写实', promptHint: 'hyperrealistic' },
      { id: 'painterly', zhLabel: '绘画质感', promptHint: 'painterly style' },
      { id: 'cinematic-4k', zhLabel: '电影4K', promptHint: 'cinematic 4K quality' },
      { id: 'vintage', zhLabel: '老照片', promptHint: 'vintage photo texture' },
      { id: 'clean-digital', zhLabel: '干净数字', promptHint: 'clean digital look' },
    ],
  },
]

export function buildCinematicFragment(selected: Record<string, string>): string {
  const hints = CINEMATIC_GROUPS.map((g) => selected[g.key]).filter((h): h is string => Boolean(h))
  if (hints.length === 0) return ''
  return `镜头参数：${hints.join(', ')}.`
}
