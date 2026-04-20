import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id:           string
  name:         string
  avatar?:      string   // emoji or URL
  bio?:         string
  skills?:      string[]
  accentColor:  string
  joinedAt:     string
  rating?:      number
  reviewCount?: number
}

interface ProfileState {
  profiles:         UserProfile[]
  currentUserId:    string
  upsertProfile:    (profile: UserProfile) => void
  setCurrentUserId: (id: string) => void
  updateRating:     (userId: string, avg: number, count: number) => void
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_PROFILES: UserProfile[] = [
  {
    id:          'user-current',
    name:        'AI 导演',
    avatar:      '🎬',
    bio:         '用 AI 工具创作短片和品牌视频的独立创作者，专注分镜设计与商业广告方向。',
    skills:      ['分镜设计', '商业广告', '短片创作', 'AI 创作'],
    accentColor: '#6366f1',
    joinedAt:    new Date(Date.now() - 30 * 24 * 3600_000).toISOString(),
  },
  {
    id:          'user-neondirector',
    name:        'NeonDirector',
    avatar:      '🌃',
    bio:         '专注赛博朋克与黑色电影风格的新锐导演，擅长非线性叙事与视觉符号构建。',
    skills:      ['赛博朋克', '悬疑短片', '视觉符号', '非线性叙事'],
    accentColor: '#f43f5e',
    joinedAt:    new Date(Date.now() - 90 * 24 * 3600_000).toISOString(),
    rating:      4.67,
    reviewCount: 3,
  },
  {
    id:          'user-synthwave',
    name:        'SynthWave_Pro',
    avatar:      '🎹',
    bio:         'Lo-fi 音乐 MV 创作者，音画一体化设计师。城市孤独感是我的创作母题。',
    skills:      ['音乐MV', 'Lo-fi', '情绪短片'],
    accentColor: '#f59e0b',
    joinedAt:    new Date(Date.now() - 120 * 24 * 3600_000).toISOString(),
    rating:      5.0,
    reviewCount: 1,
  },
  {
    id:          'user-visionarc',
    name:        'VisionArc',
    avatar:      '🌅',
    bio:         '影视动画导演，痴迷于史诗级的视觉叙事。宫崎骏与《攻壳机动队》是我永远的灵感来源。',
    skills:      ['动画分镜', '史诗叙事', '角色设计', '世界观构建'],
    accentColor: '#a78bfa',
    joinedAt:    new Date(Date.now() - 180 * 24 * 3600_000).toISOString(),
    rating:      5.0,
    reviewCount: 2,
  },
  {
    id:          'user-cinemaforge',
    name:        'CinemaForge',
    avatar:      '🚀',
    bio:         '动作科幻片导演，擅长高密度剪辑与大场面调度。预告片是我的专长。',
    skills:      ['动作科幻', '预告片', '高密度剪辑', '大场面'],
    accentColor: '#60a5fa',
    joinedAt:    new Date(Date.now() - 200 * 24 * 3600_000).toISOString(),
    rating:      4.5,
    reviewCount: 2,
  },
  {
    id:          'user-scriptmaster',
    name:        'ScriptMaster_K',
    avatar:      '📜',
    bio:         '科幻惊悚编剧，非线性结构爱好者。每一个故事都藏着一个关于时间的谎言。',
    skills:      ['科幻剧本', '惊悚叙事', '非线性结构'],
    accentColor: '#818cf8',
    joinedAt:    new Date(Date.now() - 150 * 24 * 3600_000).toISOString(),
  },
  {
    id:          'user-brandforge',
    name:        'BrandForge',
    avatar:      '⚡',
    bio:         '商业广告导演 + 品牌视频策划，服务过多个运动、科技、快消品牌。',
    skills:      ['品牌广告', 'MV', '商业短片', '运动品牌'],
    accentColor: '#22d3ee',
    joinedAt:    new Date(Date.now() - 250 * 24 * 3600_000).toISOString(),
    rating:      5.0,
    reviewCount: 1,
  },
]

// ─── Store ────────────────────────────────────────────────────────────────────

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profiles:      SEED_PROFILES,
      currentUserId: 'user-current',

      upsertProfile: (profile) =>
        set((s) => ({
          profiles: s.profiles.some((p) => p.id === profile.id)
            ? s.profiles.map((p) => (p.id === profile.id ? profile : p))
            : [...s.profiles, profile],
        })),

      setCurrentUserId: (id) => set({ currentUserId: id }),

      updateRating: (userId, avg, count) =>
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === userId
              ? { ...p, rating: Math.round(avg * 100) / 100, reviewCount: count }
              : p,
          ),
        })),
    }),
    { name: 'creator-city-profiles' },
  ),
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}
