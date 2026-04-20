// ─── Types ────────────────────────────────────────────────────────────────────

export type CommercialSegmentType = 'hook' | 'highlight' | 'emotion' | 'cta'

export interface CommercialSegment {
  type:        CommercialSegmentType
  description: string
}

export interface CommercialStructure {
  isCommercial: boolean
  category:     string
  segments:     CommercialSegment[]
}

// ─── Keyword detection ────────────────────────────────────────────────────────

interface CategoryRule {
  id:       string
  label:    string
  keywords: string[]
}

const CATEGORIES: CategoryRule[] = [
  {
    id:       'sport',
    label:    '运动品牌',
    keywords: ['运动', '跑步', '健身', '训练', '竞技', '体育', 'sport', 'run', 'fitness', 'training', 'athlete'],
  },
  {
    id:       'beauty',
    label:    '美妆护肤',
    keywords: ['美妆', '护肤', '口红', '眼影', '精华', '面霜', '彩妆', 'beauty', 'skincare', 'makeup', 'cosmetic'],
  },
  {
    id:       'food',
    label:    '食品饮料',
    keywords: ['食品', '饮料', '美食', '餐饮', '零食', '咖啡', '果汁', '轻食', 'food', 'drink', 'coffee', 'beverage'],
  },
  {
    id:       'tech',
    label:    '科技数码',
    keywords: ['手机', '耳机', '数码', '科技', '智能', 'app', '软件', '电子', 'tech', 'phone', 'device', 'digital'],
  },
  {
    id:       'fashion',
    label:    '时尚服饰',
    keywords: ['时尚', '服装', '穿搭', '潮牌', '设计师', '限定', 'fashion', 'style', 'outfit', 'luxury'],
  },
  {
    id:       'travel',
    label:    '旅行出行',
    keywords: ['旅行', '出行', '酒店', '目的地', '探索', '航空', 'travel', 'trip', 'hotel', 'destination'],
  },
  {
    id:       'brand',
    label:    '品牌形象',
    keywords: ['品牌', '广告', '商业', '发布', '形象', '代言', 'brand', 'ad', 'commercial', 'launch', 'campaign'],
  },
]

const COMMERCIAL_TRIGGER = [
  '品牌', '广告', '商业', '产品', '推广', '发布', '营销', '宣传',
  'brand', 'ad', 'commercial', 'product', 'launch', 'campaign', 'marketing',
]

// ─── Template library ─────────────────────────────────────────────────────────

type SegmentTemplate = Record<CommercialSegmentType, (idea: string) => string>

const TEMPLATES: Record<string, SegmentTemplate> = {
  sport: {
    hook:      (idea) => `极速特写开场：运动员在巅峰时刻的一瞬——汗水、心跳、边界。画面以「${idea.slice(0, 20)}」为爆发点，0.5 秒抓住眼球。`,
    highlight: (idea) => `产品性能展示：装备在极端环境下的表现特写——材质、科技感、实战效果，呼应「${idea.slice(0, 20)}」的核心卖点。`,
    emotion:   (_idea) => `情绪弧线：从挣扎到突破的内心独白，镜头跟随身体极限，传递「突破自我」的情感共鸣。`,
    cta:       (_idea) => `品牌收尾：Logo 浮现，Slogan 落版，留下「不止于此」的余韵，引导扫码或搜索。`,
  },
  beauty: {
    hook:      (idea) => `美丽悬念开场：肌肤在柔光下的极致特写，一滴精华缓缓落下——以「${idea.slice(0, 20)}」唤醒感官欲望。`,
    highlight: (idea) => `成分与质感展示：原料故事、配方可视化、使用前后对比，传达「${idea.slice(0, 20)}」的科学美肤理念。`,
    emotion:   (_idea) => `情绪升华：镜头捕捉使用者脸上自信浮现的瞬间——美不是表面，是由内而外的力量。`,
    cta:       (_idea) => `收尾：产品特写 + 限定优惠信息，引导立即体验，强化「美丽从这一刻开始」的行动召唤。`,
  },
  food: {
    hook:      (idea) => `食欲冲击开场：食材特写在光影中旋转——色泽、蒸气、质感。以「${idea.slice(0, 20)}」触发观众的味觉联想。`,
    highlight: (idea) => `产品差异化呈现：食材溯源、制作工艺、口感场景化演绎，传达「${idea.slice(0, 20)}」的品质主张。`,
    emotion:   (_idea) => `情感共鸣：一个简单的进食瞬间——闭眼、满足、会心一笑，传递「简单的幸福」主题。`,
    cta:       (_idea) => `收尾：产品铺满画面，购买渠道信息浮现，驱动立即下单或到店体验。`,
  },
  tech: {
    hook:      (idea) => `科技炸场开场：设备在极端条件下的高速镜头——光影流动、数据粒子、未来感爆棚，切入「${idea.slice(0, 20)}」。`,
    highlight: (idea) => `功能亮点拆解：核心功能可视化演示——处理速度、续航、音质、屏幕，以场景驱动展示「${idea.slice(0, 20)}」的技术优势。`,
    emotion:   (_idea) => `人机共鸣：用户在生活关键时刻依赖产品的真实场景——「科技让重要时刻更美好」。`,
    cta:       (_idea) => `收尾：产品浮现于纯净背景，配色高级感收尾，引导预约/购买，传递「属于你的未来」。`,
  },
  fashion: {
    hook:      (idea) => `时装大片开场：模特走向镜头，服饰轮廓在逆光中剪裁分明——以「${idea.slice(0, 20)}」定义一种态度。`,
    highlight: (idea) => `细节放大：面料纹理、工艺细节、版型走线——「${idea.slice(0, 20)}」的品质在每一针每一线中呈现。`,
    emotion:   (_idea) => `身份认同：穿着者在城市中自信穿行，镜头语言传递「穿上即拥有某种人格」的精神归属感。`,
    cta:       (_idea) => `收尾：品牌符号浮现，限量信息或新季预告，驱动探店或线上下单。`,
  },
  travel: {
    hook:      (idea) => `异域震撼开场：航拍宏观地貌 + 旅人剪影，以「${idea.slice(0, 20)}」瞬间唤起出走的渴望。`,
    highlight: (idea) => `目的地卖点：独特体验场景展示——景色、人文、服务细节，传递「${idea.slice(0, 20)}」的差异化价值。`,
    emotion:   (_idea) => `情绪释放：旅人在目的地真实情绪流露——惊叹、宁静、自由，触发「我也要去」的内心冲动。`,
    cta:       (_idea) => `收尾：联系方式或预订入口清晰呈现，配合限时优惠信息，驱动即时行动。`,
  },
  brand: {
    hook:      (idea) => `品牌宣言开场：强烈视觉符号 + 一句话核心主张，在前 3 秒建立「${idea.slice(0, 20)}」的品牌识别感。`,
    highlight: (idea) => `品牌价值展示：产品矩阵或用户证言，系统化呈现「${idea.slice(0, 20)}」的核心优势与市场地位。`,
    emotion:   (_idea) => `情感连结：真实用户故事或品牌创始故事，建立品牌与消费者之间的价值观共鸣。`,
    cta:       (_idea) => `收尾：品牌 Logo + Slogan 强势收尾，引导关注、搜索或访问，留下持久的品牌印记。`,
  },
  default: {
    hook:      (idea) => `视觉冲击开场：用最强烈的画面瞬间抓住「${idea.slice(0, 20)}」——让观众无法移开目光。`,
    highlight: (idea) => `核心内容呈现：清晰展示「${idea.slice(0, 20)}」的最大亮点，以具象场景替代抽象描述。`,
    emotion:   (idea) => `情绪共鸣：找到与目标观众最深的情感连结点，让「${idea.slice(0, 20)}」从信息变成感受。`,
    cta:       (_idea) => `行动收尾：明确的行动指令 + 视觉焦点收束，驱动观众完成下一步。`,
  },
}

// ─── Engine ───────────────────────────────────────────────────────────────────

function detectCategory(idea: string): CategoryRule | null {
  const lower = idea.toLowerCase()
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((kw) => lower.includes(kw))) return cat
  }
  return null
}

function isCommercialIdea(idea: string): boolean {
  const lower = idea.toLowerCase()
  if (COMMERCIAL_TRIGGER.some((kw) => lower.includes(kw))) return true
  if (detectCategory(idea) !== null) return true
  return false
}

/**
 * Analyze an idea string and return a commercial structure.
 * Pure mock — no network calls. Safe to call synchronously.
 */
export function analyzeCommercial(idea: string): CommercialStructure {
  const trimmed    = idea.trim() || '品牌创意'
  const commercial = isCommercialIdea(trimmed)
  const category   = detectCategory(trimmed)
  const catId      = category?.id ?? 'default'
  const tpl        = TEMPLATES[catId] ?? TEMPLATES['default']!

  const segments: CommercialSegment[] = [
    { type: 'hook',      description: tpl.hook(trimmed)      },
    { type: 'highlight', description: tpl.highlight(trimmed)  },
    { type: 'emotion',   description: tpl.emotion(trimmed)    },
    { type: 'cta',       description: tpl.cta(trimmed)        },
  ]

  return {
    isCommercial: commercial,
    category:     category?.label ?? '通用创意',
    segments,
  }
}

/**
 * Map CommercialSegment[] to the shot-definition format expected by
 * useShotsStore.resetShots() and the Director Engine.
 * Each segment type maps to a shot label + description.
 */
export function commercialToShotDefs(
  segments: CommercialSegment[],
  _style:   string,
): Array<{ idea: string; label: string }> {
  const LABEL: Record<CommercialSegmentType, string> = {
    hook:      '钩子·开场',
    highlight: '亮点·产品',
    emotion:   '情绪·共鸣',
    cta:       '行动·收尾',
  }
  return segments.map((seg) => ({
    label: LABEL[seg.type],
    idea:  seg.description,
  }))
}
