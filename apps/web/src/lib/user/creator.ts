import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Creator = {
  id:            string
  name:          string
  level:         number
  totalEarnings: number
  completedJobs: number
  successRate:   number
  rating:        number
  tags:          string[]
}

// ─── Level rules ──────────────────────────────────────────────────────────────

export function computeLevel(completedJobs: number): number {
  return Math.max(1, completedJobs + 1)
}

export function getLevelTitle(level: number): string {
  if (level <= 2)  return '新人创作者'
  if (level <= 5)  return '商业创作者'
  if (level <= 10) return '资深创作者'
  return '大师创作者'
}

export function getLevelColor(level: number): string {
  if (level <= 2)  return '#94a3b8'
  if (level <= 5)  return '#6366f1'
  if (level <= 10) return '#f59e0b'
  return '#f43f5e'
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_CREATORS: Creator[] = [
  {
    id:            'user-current',
    name:          'AI 导演',
    level:         1,
    totalEarnings: 0,
    completedJobs: 0,
    successRate:   100,
    rating:        0,
    tags:          ['分镜设计', '商业广告'],
  },
  {
    id:            'user-neondirector',
    name:          'NeonDirector',
    level:         4,
    totalEarnings: 12800,
    completedJobs: 3,
    successRate:   95,
    rating:        4.67,
    tags:          ['赛博朋克', '悬疑短片'],
  },
  {
    id:            'user-visionarc',
    name:          'VisionArc',
    level:         3,
    totalEarnings: 8500,
    completedJobs: 2,
    successRate:   100,
    rating:        5.0,
    tags:          ['动画分镜', '史诗叙事'],
  },
  {
    id:            'user-cinemaforge',
    name:          'CinemaForge',
    level:         3,
    totalEarnings: 7200,
    completedJobs: 2,
    successRate:   90,
    rating:        4.5,
    tags:          ['动作科幻', '预告片'],
  },
  {
    id:            'user-brandforge',
    name:          'BrandForge',
    level:         2,
    totalEarnings: 3600,
    completedJobs: 1,
    successRate:   100,
    rating:        5.0,
    tags:          ['品牌广告', '商业短片'],
  },
  {
    id:            'user-synthwave',
    name:          'SynthWave_Pro',
    level:         2,
    totalEarnings: 2900,
    completedJobs: 1,
    successRate:   100,
    rating:        5.0,
    tags:          ['音乐MV', 'Lo-fi'],
  },
  {
    id:            'user-scriptmaster',
    name:          'ScriptMaster_K',
    level:         1,
    totalEarnings: 0,
    completedJobs: 0,
    successRate:   100,
    rating:        0,
    tags:          ['科幻剧本', '惊悚叙事'],
  },
]

// ─── Store ────────────────────────────────────────────────────────────────────

interface CreatorStoreState {
  creators: Creator[]
  getCreator: (id: string) => Creator | undefined
  completeJob: (id: string, earnings: number) => void
  upsertCreator: (creator: Creator) => void
}

export const useCreatorStore = create<CreatorStoreState>()(
  persist(
    (set, get) => ({
      creators: SEED_CREATORS,

      getCreator: (id) => get().creators.find((c) => c.id === id),

      completeJob: (id, earnings) =>
        set((s) => ({
          creators: s.creators.map((c) => {
            if (c.id !== id) return c
            const completedJobs = c.completedJobs + 1
            return {
              ...c,
              completedJobs,
              level:         computeLevel(completedJobs),
              totalEarnings: c.totalEarnings + earnings,
            }
          }),
        })),

      upsertCreator: (creator) =>
        set((s) => ({
          creators: s.creators.some((c) => c.id === creator.id)
            ? s.creators.map((c) => (c.id === creator.id ? creator : c))
            : [...s.creators, creator],
        })),
    }),
    { name: 'cc:creators' },
  ),
)
