import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ShotExportData } from '@/lib/export'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeedProject {
  id:          string
  title:       string
  description: string
  shots:       ShotExportData[]
  coverImage?: string   // first shot imageUrl, if any
  author:      string
  authorId?:   string
  likes:       number
  likedByMe:   boolean
  tags:        string[]
  accent:      string   // card accent colour
  fromColor:   string   // card gradient from-colour
  createdAt:   string
}

interface FeedState {
  projects:       FeedProject[]
  publishProject: (draft: {
    title:       string
    description: string
    shots:       ShotExportData[]
    coverImage?: string
    author:      string
    authorId?:   string
    tags?:       string[]
  }) => FeedProject
  likeProject:   (id: string) => void
  unlikeProject: (id: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10) }

const ACCENT_POOL = [
  { accent: '#f43f5e', fromColor: '#1f0508' },
  { accent: '#f59e0b', fromColor: '#1a1200' },
  { accent: '#0ea5e9', fromColor: '#021320' },
  { accent: '#10b981', fromColor: '#041a0c' },
  { accent: '#818cf8', fromColor: '#0c0818' },
  { accent: '#a78bfa', fromColor: '#120a1a' },
  { accent: '#60a5fa', fromColor: '#0a1220' },
  { accent: '#22d3ee', fromColor: '#021215' },
]

function pickAccent(idx: number): { accent: string; fromColor: string } {
  return ACCENT_POOL[idx % ACCENT_POOL.length] ?? { accent: '#6366f1', fromColor: '#0c0818' }
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED: FeedProject[] = [
  {
    id:          'fp-seed-1',
    title:       '《暗流》赛博悬疑短片',
    description: '三幕结构赛博朋克悬疑脚本，主角是一名记忆黑市的地下交易员，镜头语言偏冷峻写实。',
    shots: [
      { label: 'Shot 1 · 开场', idea: '霓虹雨夜，主角在废弃地铁站等候', style: '电影感',
        shotType: 'close-up', framing: 'CU', movement: 'static', colorGrade: 'teal-orange',
        lighting: 'neon-night', keyframePrompt: 'close-up, neon-lit abandoned subway station, rain, cyberpunk, teal-orange grade', isDone: true },
      { label: 'Shot 2 · 交易', idea: '记忆芯片在两双手间传递', style: '电影感',
        shotType: 'close-up', framing: 'ECU', movement: 'dolly', colorGrade: 'noir',
        lighting: 'moody', keyframePrompt: 'extreme close-up, memory chip exchange, hands, noir, moody blue lighting', isDone: true },
    ],
    coverImage:  undefined,
    author:      'NeonDirector',
    authorId:    'user-neondirector',
    likes:       4812,
    likedByMe:   false,
    tags:        ['悬疑', '赛博朋克', '短片'],
    ...ACCENT_POOL[0]!,
    createdAt:   new Date(Date.now() - 5 * 3600_000).toISOString(),
  },
  {
    id:          'fp-seed-2',
    title:       '城市低语 MV 方案',
    description: 'Lo-fi 电子音乐 MV 分镜，城市夜景 + 孤独感，主视觉偏温暖琥珀色调。',
    shots: [
      { label: 'Shot 1 · 城市远眺', idea: '高楼俯瞰夜间城市灯海', style: 'MV',
        shotType: 'aerial', framing: 'EWS', movement: 'pan', colorGrade: 'soft-pastel',
        lighting: 'neon-night', keyframePrompt: 'aerial city at night, warm amber lights, soft pastel grade, lo-fi mood', isDone: true },
    ],
    coverImage:  undefined,
    author:      'SynthWave_Pro',
    authorId:    'user-synthwave',
    likes:       3241,
    likedByMe:   false,
    tags:        ['音乐', 'Lo-fi', 'MV'],
    ...ACCENT_POOL[1]!,
    createdAt:   new Date(Date.now() - 9 * 3600_000).toISOString(),
  },
  {
    id:          'fp-seed-3',
    title:       '《霓虹黎明》动画分镜',
    description: '史诗级剧情动画的完整分镜方案，五幕结构，主视觉借鉴宫崎骏光影风格。',
    shots: [
      { label: 'Shot 1 · 序章', idea: '晨雾中的古城远景', style: '电影感',
        shotType: 'wide', framing: 'EWS', movement: 'dolly', colorGrade: 'soft-pastel',
        lighting: 'daylight', keyframePrompt: 'wide epic establishing shot, ancient city in morning mist, Studio Ghibli inspired, soft pastel', isDone: true },
      { label: 'Shot 2 · 主角登场', idea: '少女站在悬崖边，风吹裙摆', style: '电影感',
        shotType: 'medium', framing: 'MS', movement: 'static', colorGrade: 'cinematic',
        lighting: 'daylight', keyframePrompt: 'medium shot, girl on cliff edge, wind in hair, cinematic, golden hour', isDone: true },
      { label: 'Shot 3 · 高潮', idea: '巨龙破云而出，逆光飞翔', style: '电影感',
        shotType: 'wide', framing: 'WS', movement: 'tilt', colorGrade: 'cinematic',
        lighting: 'hard', keyframePrompt: 'wide dragon emerging from clouds, backlit, epic tilt, cinematic color grade', isDone: true },
    ],
    coverImage:  undefined,
    author:      'VisionArc',
    authorId:    'user-visionarc',
    likes:       5438,
    likedByMe:   false,
    tags:        ['动画', '史诗', '分镜'],
    ...ACCENT_POOL[5]!,
    createdAt:   new Date(Date.now() - 18 * 3600_000).toISOString(),
  },
  {
    id:          'fp-seed-4',
    title:       '《末日协议》预告片方案',
    description: '动作科幻长片预告分镜，高密度剪辑节奏，视觉冲击力优先。',
    shots: [
      { label: 'Shot 1 · 爆炸', idea: '城市废墟中的大规模爆炸', style: '商业广告',
        shotType: 'wide', framing: 'WS', movement: 'handheld', colorGrade: 'teal-orange',
        lighting: 'hard', keyframePrompt: 'wide shot city ruins explosion, handheld, teal-orange grade, action blockbuster', isDone: true },
      { label: 'Shot 2 · 英雄', idea: '主角逆光奔跑，慢动作', style: '商业广告',
        shotType: 'medium', framing: 'MS', movement: 'dolly', colorGrade: 'cinematic',
        lighting: 'hard', keyframePrompt: 'hero running in silhouette, backlit, slow motion, dolly, cinematic blockbuster', isDone: true },
    ],
    coverImage:  undefined,
    author:      'CinemaForge',
    authorId:    'user-cinemaforge',
    likes:       8214,
    likedByMe:   false,
    tags:        ['动作', '科幻', '预告片'],
    ...ACCENT_POOL[6]!,
    createdAt:   new Date(Date.now() - 32 * 3600_000).toISOString(),
  },
  {
    id:          'fp-seed-5',
    title:       '《记忆碎片》科幻惊悚剧本',
    description: '非线性叙事科幻惊悚短片脚本，时间线交织，视觉符号反复出现。',
    shots: [
      { label: 'Shot 1', idea: '模糊的走廊，脚步声由远及近', style: '电影感',
        shotType: 'wide', framing: 'WS', movement: 'steadicam', colorGrade: 'noir',
        lighting: 'moody', keyframePrompt: 'wide blurred corridor, steadicam, noir, moody high contrast', isDone: true },
    ],
    coverImage:  undefined,
    author:      'ScriptMaster_K',
    authorId:    'user-scriptmaster',
    likes:       1742,
    likedByMe:   false,
    tags:        ['科幻', '惊悚', '剧本'],
    ...ACCENT_POOL[4]!,
    createdAt:   new Date(Date.now() - 48 * 3600_000).toISOString(),
  },
  {
    id:          'fp-seed-6',
    title:       '品牌 MV 商业提案',
    description: '运动品牌年度 MV 完整提案，3 分钟，城市马拉松主题，激励向。',
    shots: [
      { label: 'Shot 1 · 清晨起跑', idea: '破晓时分，跑者踏上城市街道', style: '商业广告',
        shotType: 'wide', framing: 'WS', movement: 'dolly', colorGrade: 'commercial-clean',
        lighting: 'daylight', keyframePrompt: 'wide shot city marathon at dawn, clean commercial grade, dolly, energetic', isDone: true },
      { label: 'Shot 2 · 终点冲刺', idea: '彩带飘落，选手冲过终点', style: '商业广告',
        shotType: 'medium', framing: 'MS', movement: 'handheld', colorGrade: 'commercial-clean',
        lighting: 'daylight', keyframePrompt: 'medium shot athlete crossing finish line, confetti, handheld, commercial clean', isDone: true },
    ],
    coverImage:  undefined,
    author:      'BrandForge',
    authorId:    'user-brandforge',
    likes:       2867,
    likedByMe:   false,
    tags:        ['品牌', 'MV', '商业'],
    ...pickAccent(7),
    createdAt:   new Date(Date.now() - 60 * 3600_000).toISOString(),
  },
]

// ─── Store ────────────────────────────────────────────────────────────────────

export const useFeedStore = create<FeedState>()(
  persist(
    (set, get) => ({
      projects: SEED,

      publishProject: (draft) => {
        const existing = get().projects
        const { accent, fromColor } = pickAccent(existing.length)
        const proj: FeedProject = {
          id:          `fp-${uid()}`,
          title:       draft.title,
          description: draft.description,
          shots:       draft.shots,
          coverImage:  draft.coverImage,
          author:      draft.author,
          authorId:    draft.authorId,
          likes:       0,
          likedByMe:   false,
          tags:        draft.tags ?? [],
          accent,
          fromColor,
          createdAt:   new Date().toISOString(),
        }
        set((s) => ({ projects: [proj, ...s.projects] }))
        return proj
      },

      likeProject: (id) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id && !p.likedByMe
              ? { ...p, likes: p.likes + 1, likedByMe: true }
              : p
          ),
        })),

      unlikeProject: (id) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id && p.likedByMe
              ? { ...p, likes: p.likes - 1, likedByMe: false }
              : p
          ),
        })),
    }),
    { name: 'creator-city-feed' },
  ),
)
