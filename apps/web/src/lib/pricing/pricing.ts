// ─── Types ────────────────────────────────────────────────────────────────────

export type PricingStyle      = '广告' | '短视频' | '电影感' | '剧情' | '默认'
export type PricingComplexity = 'low' | 'mid' | 'high'

export interface PricingInput {
  style:      string
  complexity: PricingComplexity
  duration:   number  // seconds
}

export interface PricingResult {
  base:           number
  complexityRate: number
  durationFactor: number
  total:          number
  breakdown:      string
}

export interface MarketRange {
  label:    string   // display name for this market segment
  min:      number
  max:      number | null  // null = open-ended (20000+)
  advice:   string   // advisory tag shown on card
}

export type BudgetAssessment = 'in_range' | 'above_range' | 'below_range'

export interface DealAssessment {
  range:       MarketRange
  assessment:  BudgetAssessment
  message:     string
  warning:     string | null  // non-null only when below range
}

// ─── Market ranges (high-end creative market) ─────────────────────────────────

const MARKET_RANGES: Record<PricingStyle, MarketRange> = {
  广告: {
    label:  '商业广告',
    min:    5000,
    max:    15000,
    advice: '符合行业制作区间',
  },
  短视频: {
    label:  '短视频制作',
    min:    2000,
    max:    8000,
    advice: '具备高性价比优势',
  },
  电影感: {
    label:  '剧情短片',
    min:    8000,
    max:    30000,
    advice: '建议优先沟通细节',
  },
  剧情: {
    label:  '剧情短片',
    min:    8000,
    max:    30000,
    advice: '建议优先沟通细节',
  },
  默认: {
    label:  '品牌创意',
    min:    20000,
    max:    null,
    advice: '建议优先沟通细节',
  },
}

// ─── Style detection ──────────────────────────────────────────────────────────

const STYLE_KEYWORDS: Array<{ style: PricingStyle; keywords: string[] }> = [
  { style: '广告',   keywords: ['广告', '品牌', '商业', '形象', 'ad', 'brand', 'commercial'] },
  { style: '电影感', keywords: ['电影', '短片', '电影感', '胶片', 'cinematic', 'film'] },
  { style: '剧情',   keywords: ['剧情', '故事', '短剧', '叙事', 'story', 'drama'] },
  { style: '短视频', keywords: ['短视频', 'vlog', '开箱', 'mv', '旅行', '日常'] },
]

export function detectStyle(text: string): PricingStyle {
  const lower = text.toLowerCase()
  for (const { style, keywords } of STYLE_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return style
  }
  return '默认'
}

// ─── Budget assessment ────────────────────────────────────────────────────────

export function getMarketRange(style: PricingStyle): MarketRange {
  return MARKET_RANGES[style]
}

export function parseBudgetMax(budgetRange: string): number {
  const nums = budgetRange.match(/\d[\d,]*/g)?.map((n) => parseInt(n.replace(/,/g, ''), 10)) ?? []
  return Math.max(...nums, 0)
}

export function assessDeal(budgetRange: string, styleText: string): DealAssessment {
  const style   = detectStyle(styleText)
  const range   = getMarketRange(style)
  const budgetMax = parseBudgetMax(budgetRange)

  let assessment: BudgetAssessment
  let message: string
  let warning: string | null = null

  const rangeMax = range.max ?? range.min * 3  // open-ended → treat as 3× min

  if (budgetMax < range.min) {
    assessment = 'below_range'
    message    = '建议优先沟通细节'
    warning    = '报价明显低于行业区间，需注意质量风险'
  } else if (budgetMax > rangeMax) {
    assessment = 'above_range'
    message    = '具备高性价比优势'
  } else {
    assessment = 'in_range'
    message    = range.advice
  }

  return { range, assessment, message, warning }
}

// ─── Legacy price calculation (kept for backwards compatibility) ───────────────

const BASE_PRICE: Record<PricingStyle, number> = {
  广告:   5000,
  短视频: 2000,
  电影感: 8000,
  剧情:   8000,
  默认:   20000,
}

const COMPLEXITY_RATE: Record<PricingComplexity, number> = {
  low:  1.0,
  mid:  1.5,
  high: 2.0,
}

const COMPLEXITY_LABEL: Record<PricingComplexity, string> = {
  low:  '简单',
  mid:  '中等',
  high: '复杂',
}

function durationFactor(seconds: number): number {
  if (seconds < 15)  return 1.0
  if (seconds <= 30) return 1.2
  return 1.5
}

function durationLabel(seconds: number): string {
  if (seconds < 15)  return `${seconds}s（短）`
  if (seconds <= 30) return `${seconds}s（中）`
  return `${seconds}s（长）`
}

export function calculatePrice(input: PricingInput): PricingResult {
  const styleMapped    = detectStyle(input.style)
  const base           = BASE_PRICE[styleMapped]
  const complexityRate = COMPLEXITY_RATE[input.complexity]
  const df             = durationFactor(input.duration)
  const total          = Math.round(base * complexityRate * df)

  const breakdown = [
    `基准价 ¥${base.toLocaleString()}（${styleMapped}）`,
    `× ${complexityRate} 复杂度（${COMPLEXITY_LABEL[input.complexity]}）`,
    `× ${df} 时长（${durationLabel(input.duration)}）`,
    `= ¥${total.toLocaleString()}`,
  ].join(' ')

  return { base, complexityRate, durationFactor: df, total, breakdown }
}

// ─── Job field derivation helpers ─────────────────────────────────────────────

export function derivePricingComplexity(budgetRange: string): PricingComplexity {
  const max = parseBudgetMax(budgetRange)
  if (max >= 10000) return 'high'
  if (max >= 3000)  return 'mid'
  return 'low'
}

export function deriveDuration(shotCount: number | undefined, description: string): number {
  if (shotCount) return shotCount * 5
  if (description.includes('90')) return 90
  if (description.includes('30')) return 30
  if (description.includes('15')) return 15
  if (description.includes('8 分')) return 480
  return 20
}
