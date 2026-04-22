import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StyleAsset = {
  id:             string
  name:           string
  description:    string
  colorProfile:   string
  lighting:       string
  mood:           string
  cameraStyle:    string
  promptTemplate: string
  accentColor:    string
  icon:           string
}

// ─── Built-in styles ──────────────────────────────────────────────────────────

export const BUILTIN_STYLES: StyleAsset[] = [
  {
    id:           'tech-premium',
    name:         '高端科技风',
    description:  '冷光蓝调·极简构图·未来感',
    colorProfile: 'teal-orange',
    lighting:     'neon-night',
    mood:         'clean',
    cameraStyle:  'steadicam + macro',
    promptTemplate:
      'futuristic tech aesthetic, cool blue tones, high contrast, ultra-clean composition, minimalist product shot, neon-lit surfaces, cinematic depth of field, premium commercial grade',
    accentColor: '#06b6d4',
    icon:        '⚡',
  },
  {
    id:           'cinematic',
    name:         '电影质感风',
    description:  '胶片颗粒·暖调黄昏·叙事感',
    colorProfile: 'cinematic',
    lighting:     'moody',
    mood:         'cinematic',
    cameraStyle:  'anamorphic dolly',
    promptTemplate:
      'cinematic film look, anamorphic lens flare, warm golden-hour tones, shallow depth of field, 35mm film grain, dramatic chiaroscuro lighting, narrative storytelling composition, epic wide-screen ratio',
    accentColor: '#f59e0b',
    icon:        '🎞',
  },
  {
    id:           'art-house',
    name:         '文艺冷感风',
    description:  '去饱和·留白·东亚美学',
    colorProfile: 'soft-pastel',
    lighting:     'soft',
    mood:         'tender',
    cameraStyle:  'static wide',
    promptTemplate:
      'art-house aesthetic, desaturated muted palette, negative space composition, slow cinema style, soft diffused light, minimalist zen framing, contemplative mood, East Asian visual language',
    accentColor: '#94a3b8',
    icon:        '🪷',
  },
]

// ─── Store ────────────────────────────────────────────────────────────────────

interface StyleStoreState {
  selectedStyleId: string | null
  selectStyle:     (id: string | null) => void
  getActiveStyle:  () => StyleAsset | null
}

export const useStyleStore = create<StyleStoreState>()(
  persist(
    (set, get) => ({
      selectedStyleId: null,

      selectStyle: (id) => set({ selectedStyleId: id }),

      getActiveStyle: () => {
        const { selectedStyleId } = get()
        if (!selectedStyleId) return null
        return BUILTIN_STYLES.find((s) => s.id === selectedStyleId) ?? null
      },
    }),
    { name: 'cc:style_asset' },
  ),
)
