'use client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PresetCombo {
  id: string
  title: string
  sub: string
  writerId: string
  dirId: string
  actorId: string
  cameraId: string
  tags: string[]
  score: number
}

interface AgentChip { id: string; icon: string; name: string }

// ─── Static data (display-only subset) ───────────────────────────────────────

const WRITERS: AgentChip[] = [
  { id: 'classic',    icon: '📖', name: '经典编剧' },
  { id: 'commercial', icon: '⚡', name: '商业编剧' },
  { id: 'art',        icon: '🎨', name: '艺术编剧' },
  { id: 'pro_noir',   icon: '🌑', name: '暗夜编剧 PRO' },
  { id: 'pro_epic',   icon: '👑', name: '史诗编剧 PRO' },
]
const DIRECTORS: AgentChip[] = [
  { id: 'commercial', icon: '🔥', name: '商业导演' },
  { id: 'auteur',     icon: '🌫️', name: '作者导演' },
  { id: 'control',    icon: '📐', name: '控制型导演' },
]
const ACTORS: AgentChip[] = [
  { id: 'hero',     icon: '🦸', name: '主角型' },
  { id: 'antihero', icon: '🌑', name: '反英雄' },
  { id: 'ensemble', icon: '👥', name: '群像' },
  { id: 'minimal',  icon: '🧍', name: '极简角色' },
]
const CAMERAS: AgentChip[] = [
  { id: 'cinematic', icon: '🎥', name: '电影感' },
  { id: 'handheld',  icon: '📸', name: '手持纪实' },
  { id: 'drone',     icon: '🚁', name: '无人机' },
  { id: 'film',      icon: '🎞️', name: '胶片质感' },
]

const COMBOS: PresetCombo[] = [
  {
    id: 'blockbuster', title: '商业大片', sub: '院线爆款 · 强节奏 · 高燃',
    writerId: 'commercial', dirId: 'commercial', actorId: 'hero', cameraId: 'drone',
    tags: ['🔥爆款流', '⚡快节奏'], score: 94,
  },
  {
    id: 'arthouse', title: '文艺电影', sub: '影展级 · 情绪留白 · 诗意',
    writerId: 'art', dirId: 'auteur', actorId: 'minimal', cameraId: 'film',
    tags: ['🎨影展级', '🌫️情绪流'], score: 96,
  },
  {
    id: 'viral', title: '抖音爆款', sub: '短视频 · 密集反转 · 秒吸引',
    writerId: 'commercial', dirId: 'control', actorId: 'antihero', cameraId: 'handheld',
    tags: ['📱短视频', '🔄密集反转'], score: 91,
  },
]

const CARD_STYLES = [
  {
    border: 'border-city-gold/25',
    bg: 'from-amber-950/60 to-city-surface',
    accent: 'text-city-gold',
    scoreCls: 'bg-city-gold/20 text-city-gold border-city-gold/30',
  },
  {
    border: 'border-city-accent/25',
    bg: 'from-indigo-950/60 to-city-surface',
    accent: 'text-city-accent-glow',
    scoreCls: 'bg-city-accent/20 text-city-accent-glow border-city-accent/30',
  },
  {
    border: 'border-city-rose/25',
    bg: 'from-rose-950/60 to-city-surface',
    accent: 'text-city-rose',
    scoreCls: 'bg-city-rose/20 text-city-rose border-city-rose/30',
  },
]
const FALLBACK_STYLE = {
  border: 'border-city-border',
  bg: 'from-city-surface to-city-surface',
  accent: 'text-white',
  scoreCls: 'bg-gray-800 text-gray-400 border-gray-700',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onApply: (combo: PresetCombo) => void
}

export function RecommendedCombos({ onApply }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500 font-semibold">⚡ 精选组合 — 点击立即生成</p>
        <span className="text-xs text-gray-600">AI 推荐 · 已验证</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {COMBOS.map((c, i) => {
          const s = CARD_STYLES[i] ?? FALLBACK_STYLE
          const w   = WRITERS.find(x => x.id === c.writerId)
          const d   = DIRECTORS.find(x => x.id === c.dirId)
          const ac  = ACTORS.find(x => x.id === c.actorId)
          const cam = CAMERAS.find(x => x.id === c.cameraId)

          const chips: [string, AgentChip | undefined][] = [
            ['编剧', w], ['导演', d], ['演员', ac], ['摄影', cam],
          ]

          return (
            <div
              key={c.id}
              className={`rounded-2xl border ${s.border} bg-gradient-to-br ${s.bg} p-4 space-y-3 card-lift`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`text-sm font-bold ${s.accent}`}>{c.title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{c.sub}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${s.scoreCls}`}>
                  {c.score}
                </span>
              </div>

              {/* 4-chip grid */}
              <div className="grid grid-cols-2 gap-1">
                {chips.map(([label, agent]) => (
                  <div key={label} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-black/20">
                    <span className="text-sm leading-none">{agent?.icon}</span>
                    <div>
                      <p className="text-gray-600" style={{ fontSize: '9px' }}>{label}</p>
                      <p className="text-xs text-gray-300 truncate">{agent?.name}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tags */}
              <div className="flex gap-1 flex-wrap">
                {c.tags.map(t => (
                  <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                    {t}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => onApply(c)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/30 text-white text-xs font-semibold transition-all duration-200 glow-hover"
              >
                一键生成 →
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
