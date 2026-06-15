export interface LexiconTerm {
  id: string
  category: string
  zhLabel: string
  enLabel: string
  promptHint: string
  bestFor: 'image' | 'video' | 'both'
  icon?: string
}

export interface LexiconCategory {
  key: string
  zhTitle: string
  enTitle: string
  terms: LexiconTerm[]
}

export const LEXICON_CATEGORIES: LexiconCategory[] = [
  {
    key: 'shotSize',
    zhTitle: '景别',
    enTitle: 'Shot Size',
    terms: [
      { id: 'ecl', category: 'shotSize', zhLabel: '极近景', enLabel: 'Extreme Close-Up', promptHint: 'extreme close-up shot', bestFor: 'both', icon: '👁' },
      { id: 'cu', category: 'shotSize', zhLabel: '近景', enLabel: 'Close-Up', promptHint: 'close-up shot', bestFor: 'both', icon: '😊' },
      { id: 'mcu', category: 'shotSize', zhLabel: '中近景', enLabel: 'Medium CU', promptHint: 'medium close-up, chest up', bestFor: 'both', icon: '🙂' },
      { id: 'ms', category: 'shotSize', zhLabel: '中景', enLabel: 'Medium Shot', promptHint: 'medium shot, waist up', bestFor: 'both', icon: '👤' },
      { id: 'fs', category: 'shotSize', zhLabel: '全身景', enLabel: 'Full Shot', promptHint: 'full body shot', bestFor: 'both', icon: '🧍' },
      { id: 'ws', category: 'shotSize', zhLabel: '广角远景', enLabel: 'Wide Shot', promptHint: 'wide establishing shot', bestFor: 'both', icon: '🌄' },
      { id: 'aerial', category: 'shotSize', zhLabel: '航拍俯瞰', enLabel: 'Aerial', promptHint: "aerial drone shot, bird's eye view", bestFor: 'both', icon: '🚁' },
    ],
  },
  {
    key: 'movement',
    zhTitle: '运镜',
    enTitle: 'Camera Move',
    terms: [
      { id: 'static', category: 'movement', zhLabel: '静止', enLabel: 'Static', promptHint: 'static locked camera', bestFor: 'video', icon: '⬛' },
      { id: 'dolly-in', category: 'movement', zhLabel: '推镜', enLabel: 'Push In', promptHint: 'slow dolly push in toward subject', bestFor: 'video', icon: '➡' },
      { id: 'dolly-out', category: 'movement', zhLabel: '拉镜', enLabel: 'Pull Back', promptHint: 'slow dolly pull back away from subject', bestFor: 'video', icon: '⬅' },
      { id: 'pan', category: 'movement', zhLabel: '横摇', enLabel: 'Pan', promptHint: 'smooth camera pan', bestFor: 'video', icon: '↔' },
      { id: 'tilt', category: 'movement', zhLabel: '垂摇', enLabel: 'Tilt', promptHint: 'slow camera tilt up', bestFor: 'video', icon: '↕' },
      { id: 'orbit', category: 'movement', zhLabel: '环绕', enLabel: 'Orbit', promptHint: 'camera orbits around subject', bestFor: 'video', icon: '🔄' },
      { id: 'crane', category: 'movement', zhLabel: '升降摇臂', enLabel: 'Crane', promptHint: 'crane shot, rising camera movement', bestFor: 'video', icon: '⬆' },
      { id: 'handheld', category: 'movement', zhLabel: '手持抖动', enLabel: 'Handheld', promptHint: 'handheld camera, natural slight shake', bestFor: 'video', icon: '📷' },
    ],
  },
  {
    key: 'lighting',
    zhTitle: '光线',
    enTitle: 'Lighting',
    terms: [
      { id: 'golden-hour', category: 'lighting', zhLabel: '黄金时刻', enLabel: 'Golden Hour', promptHint: 'golden hour lighting, warm sunset light', bestFor: 'both', icon: '🌇' },
      { id: 'blue-hour', category: 'lighting', zhLabel: '蓝调时刻', enLabel: 'Blue Hour', promptHint: 'blue hour lighting, twilight atmosphere', bestFor: 'both', icon: '🌆' },
      { id: 'natural', category: 'lighting', zhLabel: '自然光', enLabel: 'Natural', promptHint: 'soft natural daylight', bestFor: 'both', icon: '☀' },
      { id: 'backlit', category: 'lighting', zhLabel: '逆光', enLabel: 'Backlit', promptHint: 'backlit, rim light silhouette', bestFor: 'both', icon: '🌘' },
      { id: 'rembrandt', category: 'lighting', zhLabel: '伦勃朗光', enLabel: 'Rembrandt', promptHint: 'Rembrandt lighting, dramatic side shadow triangle', bestFor: 'both', icon: '🎭' },
      { id: 'neon', category: 'lighting', zhLabel: '霓虹氛围', enLabel: 'Neon', promptHint: 'neon lights, colorful ambient glow', bestFor: 'both', icon: '🌈' },
      { id: 'hard', category: 'lighting', zhLabel: '硬光', enLabel: 'Hard Light', promptHint: 'hard directional light, sharp shadows', bestFor: 'both', icon: '💡' },
      { id: 'soft', category: 'lighting', zhLabel: '柔光', enLabel: 'Soft Light', promptHint: 'soft diffused lighting, gentle shadows', bestFor: 'both', icon: '🕯' },
    ],
  },
  {
    key: 'colorGrade',
    zhTitle: '色调',
    enTitle: 'Color Grade',
    terms: [
      { id: 'warm', category: 'colorGrade', zhLabel: '暖色调', enLabel: 'Warm', promptHint: 'warm color palette, amber and orange tones', bestFor: 'both', icon: '🟠' },
      { id: 'cool', category: 'colorGrade', zhLabel: '冷色调', enLabel: 'Cool', promptHint: 'cool color palette, blue and teal tones', bestFor: 'both', icon: '🔵' },
      { id: 'teal-orange', category: 'colorGrade', zhLabel: '青橙调', enLabel: 'Teal & Orange', promptHint: 'teal and orange color grading, cinematic blockbuster look', bestFor: 'both', icon: '🎨' },
      { id: 'desaturated', category: 'colorGrade', zhLabel: '低饱和', enLabel: 'Desaturated', promptHint: 'desaturated muted palette, washed-out look', bestFor: 'both', icon: '🩶' },
      { id: 'monochrome', category: 'colorGrade', zhLabel: '黑白', enLabel: 'Monochrome', promptHint: 'black and white, high-contrast monochrome', bestFor: 'both', icon: '◻' },
      { id: 'retro-film', category: 'colorGrade', zhLabel: '复古胶片', enLabel: 'Retro Film', promptHint: 'retro film look, Kodachrome vintage color grading', bestFor: 'both', icon: '📽' },
      { id: 'vibrant', category: 'colorGrade', zhLabel: '高饱和', enLabel: 'Vibrant', promptHint: 'vibrant saturated colors, punchy look', bestFor: 'both', icon: '✨' },
    ],
  },
  {
    key: 'texture',
    zhTitle: '质感',
    enTitle: 'Texture',
    terms: [
      { id: 'film-grain', category: 'texture', zhLabel: '胶片颗粒', enLabel: 'Film Grain', promptHint: 'visible film grain, analog texture', bestFor: 'both', icon: '🎞' },
      { id: 'hyperreal', category: 'texture', zhLabel: '超写实', enLabel: 'Hyperreal', promptHint: 'hyperrealistic, photorealistic fine detail', bestFor: 'image', icon: '🔬' },
      { id: 'painterly', category: 'texture', zhLabel: '绘画质感', enLabel: 'Painterly', promptHint: 'painterly style, visible brushwork', bestFor: 'image', icon: '🖌' },
      { id: 'cinematic-4k', category: 'texture', zhLabel: '电影4K', enLabel: 'Cinematic 4K', promptHint: 'cinematic 4K sharp professional quality', bestFor: 'both', icon: '🎬' },
      { id: 'documentary', category: 'texture', zhLabel: '纪录片风格', enLabel: 'Documentary', promptHint: 'documentary style, raw authentic look', bestFor: 'video', icon: '📹' },
      { id: 'clean-digital', category: 'texture', zhLabel: '干净数字', enLabel: 'Clean Digital', promptHint: 'clean crisp digital look, no noise', bestFor: 'both', icon: '💎' },
    ],
  },
]

export function buildLexiconFragment(selectedIds: string[]): string {
  if (selectedIds.length === 0) return ''
  const allTerms = LEXICON_CATEGORIES.flatMap((c) => c.terms)
  const terms = selectedIds
    .map((id) => allTerms.find((t) => t.id === id))
    .filter((t): t is LexiconTerm => t !== undefined)
  return terms.map((t) => t.promptHint).join(', ')
}
