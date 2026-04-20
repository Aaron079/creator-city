import type { ProParams } from './prompts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DirectorShot {
  id:          string
  shotType:    string
  description: string
  mood:        string
  presetParams: Partial<ProParams>
}

// ─── Keyword tables ───────────────────────────────────────────────────────────

const MOOD_RULES: Array<{
  keywords: string[]
  mood:     string
  colorGrade: ProParams['colorGrade']
  lighting:   ProParams['lighting']
}> = [
  { keywords: ['夜', 'night', '霓虹', 'neon', '赛博', 'cyber', '都市', 'city'],
    mood: 'neon-night', colorGrade: 'teal-orange', lighting: 'neon-night' },
  { keywords: ['旅行', 'travel', '风景', 'landscape', '自然', 'nature', '山', '海'],
    mood: 'wanderlust', colorGrade: 'natural', lighting: 'daylight' },
  { keywords: ['爱', 'love', '情', 'romance', '温柔', 'gentle', '梦', 'dream'],
    mood: 'tender', colorGrade: 'soft-pastel', lighting: 'soft' },
  { keywords: ['动作', 'action', '运动', 'sport', '力量', 'power', '竞技', '激烈'],
    mood: 'intense', colorGrade: 'commercial-clean', lighting: 'hard' },
  { keywords: ['悬疑', 'mystery', '黑暗', 'dark', '恐怖', 'horror', '惊悚', 'thriller'],
    mood: 'ominous', colorGrade: 'noir', lighting: 'moody' },
  { keywords: ['品牌', 'brand', '广告', 'ad', '商业', 'commercial', '产品', 'product'],
    mood: 'clean', colorGrade: 'commercial-clean', lighting: 'soft' },
]

const DEFAULT_MOOD = { mood: 'cinematic', colorGrade: 'cinematic' as ProParams['colorGrade'], lighting: 'soft' as ProParams['lighting'] }

// ─── Sequence templates ────────────────────────────────────────────────────────
// Each template is a list of [role, shotType, framing, movement, descriptionFn]

type ShotDef = [
  label:       string,
  shotType:    ProParams['shotType'],
  framing:     ProParams['framing'],
  movement:    ProParams['movement'],
  descFn:      (idea: string) => string,
]

const SEQUENCE: ShotDef[] = [
  ['开场', 'wide', 'EWS', 'dolly',
    (idea) => `大场景建立镜头：${idea.slice(0, 40)} — 宏观视角，交代世界观与氛围`],
  ['引入', 'medium', 'MS', 'steadicam',
    (idea) => `人物或主体引入：跟随镜头带出核心对象，呼应主题"${idea.slice(0, 30)}"`],
  ['情绪高潮', 'close-up', 'CU', 'static',
    (idea) => `情绪特写：放大细节与情感冲击，将"${idea.slice(0, 30)}"推向视觉高峰`],
  ['收尾', 'wide', 'WS', 'pan',
    (idea) => `回归全景，镜头缓缓拉开，情绪沉淀，为"${idea.slice(0, 30)}"留下余韵`],
]

// Extended sequences for longer ideas (≥8 Chinese chars or ≥ some threshold)
const EXTRA_SHOT: ShotDef = [
  '发展', 'medium', 'MCU', 'handheld',
  (idea) => `手持中近景：节奏加快，矛盾或张力浮现，推进"${idea.slice(0, 30)}"叙事核心`,
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 8)
}

function detectMood(idea: string) {
  const lower = idea.toLowerCase()
  for (const rule of MOOD_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule
    }
  }
  return DEFAULT_MOOD
}

function shouldExpand(idea: string): boolean {
  // Add the "发展" middle shot for richer ideas
  const chinese = (idea.match(/[\u4e00-\u9fff]/g) ?? []).length
  return chinese >= 8 || idea.split(/\s+/).length >= 6
}

// ─── Director Engine ──────────────────────────────────────────────────────────

/**
 * Pure mock implementation — no network calls.
 * Returns a 3–5 shot sequence derived from the idea string.
 * Swap the body of this function for a real AI call when ready.
 */
export function runDirector(idea: string, _style: string = '电影感'): DirectorShot[] {
  const trimmed = idea.trim() || '创意短片'
  const { mood, colorGrade, lighting } = detectMood(trimmed)

  const sequence = shouldExpand(trimmed)
    ? [SEQUENCE[0]!, SEQUENCE[1]!, EXTRA_SHOT, SEQUENCE[2]!, SEQUENCE[3]!]
    : [SEQUENCE[0]!, SEQUENCE[1]!, SEQUENCE[2]!, SEQUENCE[3]!]

  return sequence.map(([_label, shotType, framing, movement, descFn]) => ({
    id:          `dir-${uid()}`,
    shotType,
    description: descFn(trimmed),
    mood,
    presetParams: {
      shotType,
      framing,
      movement,
      colorGrade,
      lighting,
    },
  }))
}

// ─── Task generation ─────────────────────────────────────────────────────────

export interface DirectorTask {
  title: string
  role:  string
}

const TASK_RULES: Array<{ keywords: string[]; tasks: DirectorTask[] }> = [
  {
    keywords: ['广告', '商业', '品牌', 'ad', 'commercial', 'brand', '产品'],
    tasks: [
      { title: '分镜方案设计',      role: '导演'   },
      { title: 'AI 关键帧生成',     role: '导演'   },
      { title: '产品视觉拍摄',      role: '摄影师' },
      { title: '商业剪辑与调色',    role: '剪辑师' },
    ],
  },
  {
    keywords: ['短片', '剧情', '故事', '情节', 'story', 'film', '电影'],
    tasks: [
      { title: '撰写故事大纲',      role: '导演'   },
      { title: '分镜脚本设计',      role: '导演'   },
      { title: '场景勘察与拍摄',    role: '摄影师' },
      { title: '剪辑初版',          role: '剪辑师' },
      { title: '配乐选曲',          role: '配乐'   },
    ],
  },
  {
    keywords: ['MV', '音乐', 'music', '歌曲', '演唱', '乐队'],
    tasks: [
      { title: '音乐节奏分析',      role: '导演'   },
      { title: '视觉概念设计',      role: '导演'   },
      { title: '现场拍摄与指导',    role: '摄影师' },
      { title: 'MV剪辑节奏处理',   role: '剪辑师' },
      { title: '后期调色',          role: '剪辑师' },
    ],
  },
  {
    keywords: ['纪录片', '纪实', 'documentary', '访谈', '人物'],
    tasks: [
      { title: '调研与脚本策划',    role: '导演'   },
      { title: '现场纪实拍摄',      role: '摄影师' },
      { title: '素材整理与粗剪',    role: '剪辑师' },
      { title: '旁白与音效处理',    role: '配乐'   },
    ],
  },
  {
    keywords: ['vlog', 'Vlog', '旅行', 'travel', '生活', 'lifestyle'],
    tasks: [
      { title: '拍摄计划规划',      role: '导演'   },
      { title: '旅行现场拍摄',      role: '摄影师' },
      { title: 'Vlog 剪辑',         role: '剪辑师' },
      { title: '背景音乐选曲',      role: '配乐'   },
    ],
  },
]

const DEFAULT_TASKS: DirectorTask[] = [
  { title: '项目概念梳理',          role: '导演'   },
  { title: '分镜脚本设计',          role: '导演'   },
  { title: '拍摄执行',              role: '摄影师' },
  { title: '后期剪辑',              role: '剪辑师' },
]

/**
 * Returns a production task list based on keywords detected in the idea.
 * Mock: keyword-rule matching, no real AI call.
 */
export function generateTasksFromIdea(idea: string): DirectorTask[] {
  const lower = idea.toLowerCase()
  for (const rule of TASK_RULES) {
    if (rule.keywords.some((k) => lower.includes(k.toLowerCase()))) {
      return rule.tasks
    }
  }
  return DEFAULT_TASKS
}

/**
 * Convert DirectorShot[] to the format expected by useShotsStore.resetShots().
 */
export function directorShotsToResetDefs(
  shots: DirectorShot[],
): Array<{ idea: string; label: string; presetParams?: Partial<ProParams> }> {
  return shots.map((s, i) => ({
    label:       `Shot ${i + 1} · ${s.shotType}`,
    idea:        s.description,
    presetParams: s.presetParams,
  }))
}
