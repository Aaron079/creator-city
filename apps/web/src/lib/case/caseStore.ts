import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CaseStep = {
  phase:       'concept' | 'storyboard' | 'image' | 'video'
  title:       string
  description: string
  prompt:      string
}

export type Case = {
  id:          string
  title:       string
  description: string
  result:      string
  category:    string
  accentColor: string
  icon:        string
  createdAt:   number
  // detail fields
  beforeIdea:  string
  afterResult: string
  steps:       CaseStep[]
  views:       string
  conversion:  string
  clientQuote: string
  clientName:  string
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_CASES: Case[] = [
  {
    id:          'case-1',
    title:       '运动品牌 30s 爆款广告',
    description: '为头部运动品牌制作夏季主推广告片，AI 导演引擎一键生成 4 个商业分镜，48 小时内完成交付。',
    result:      '播放量破 800 万，品牌搜索量提升 37%',
    category:    '商业广告',
    accentColor: '#f43f5e',
    icon:        '🏃',
    createdAt:   Date.now() - 15 * 24 * 3600_000,

    beforeIdea:  '夏季主推广告，突出产品轻盈感，适合年轻人，要有运动感',
    afterResult: '30 秒高燃广告片，4 镜头叙事弧，48h 内交付上线',
    steps: [
      {
        phase:       'concept',
        title:       '创意提炼',
        description: 'AI 编剧分析「轻盈·速度·年轻」三个核心关键词，提炼品牌情绪主轴',
        prompt:      'athletic energy, lightweight motion, youth empowerment, golden hour ambiance, dynamic pacing',
      },
      {
        phase:       'storyboard',
        title:       '分镜规划',
        description: '自动生成 4 段式叙事结构：起势 → 冲刺 → 爆发 → 品牌落点',
        prompt:      'Shot 1: low-angle runner silhouette at dawn. Shot 2: extreme slow-mo shoe impact. Shot 3: crowd energy burst. Shot 4: product reveal with lens flare.',
      },
      {
        phase:       'image',
        title:       '图像生成',
        description: '每帧关键图像由 AI 导演独立渲染，高对比运动美学',
        prompt:      'hyperrealistic sports photography, motion blur trails, cinematic color grade, f/1.8 bokeh, 4K texture detail',
      },
      {
        phase:       'video',
        title:       '视频合成',
        description: '动效编辑器自动装配分镜，添加节奏切换与音效锚点',
        prompt:      'fast-cut editing rhythm 2s intervals, impact sound design, bass-drop sync, 24fps cinematic frame rate',
      },
    ],
    views:       '820 万',
    conversion:  '37%',
    clientQuote: '48小时拿到成片，品质完全超出预期，这是我们有史以来ROI最高的一支广告。',
    clientName:  '— Nike China 品牌部门',
  },
  {
    id:          'case-2',
    title:       '科技产品发布 MV',
    description: '新款耳机发布会主视频，电影级镜头语言 + 赛博朋克风格，全流程由 AI 剧组自动完成分镜规划。',
    result:      '发布当日播放 240 万，ROI 提升 2.8×',
    category:    '品牌创意',
    accentColor: '#6366f1',
    icon:        '🎧',
    createdAt:   Date.now() - 30 * 24 * 3600_000,

    beforeIdea:  '新品耳机发布视频，要有科技感，赛博朋克，高端，让人想立刻购买',
    afterResult: '90 秒电影级产品 MV，赛博朋克美学，发布当日播放 240 万',
    steps: [
      {
        phase:       'concept',
        title:       '品牌情绪定调',
        description: 'AI 分析产品卖点与目标受众，锁定「沉浸·精密·未来感」情感主轴',
        prompt:      'cyberpunk aesthetic, neon-lit precision engineering, audiophile lifestyle, urban night culture',
      },
      {
        phase:       'storyboard',
        title:       '镜头序列',
        description: '3 幕结构：产品觉醒 → 城市穿越 → 声音可视化',
        prompt:      'Shot 1: product close-up in rain, neon reflections. Shot 2: first-person city rooftop walk. Shot 3: abstract sound wave visualization morphing into product form.',
      },
      {
        phase:       'image',
        title:       '视觉渲染',
        description: '赛博朋克霓虹光源，每帧精密布光，产品质感最大化',
        prompt:      'cyberpunk city rain, neon-lit product hero shot, volumetric fog, blue-purple chroma, hyperdetail material rendering',
      },
      {
        phase:       'video',
        title:       '音画同步',
        description: 'AI 剪辑师自动校准音乐节拍与视觉切换，声画高度融合',
        prompt:      'electronic music sync, bass frequency visual pulse, 4K 60fps smooth motion, dolby atmos audio markers',
      },
    ],
    views:       '240 万',
    conversion:  '2.8×',
    clientQuote: '从创意到发布只花了3天，视频在发布当天就冲上了微博热搜，这是我们没有想到的。',
    clientName:  '— 某头部耳机品牌市场负责人',
  },
  {
    id:          'case-3',
    title:       '餐饮品牌城市快闪',
    description: '连锁咖啡品牌 5 城联动快闪活动主视频，文艺冷感风格，旅途中完成全部创作工作流。',
    result:      '社交媒体自然传播 450 万次曝光',
    category:    '短视频',
    accentColor: '#f59e0b',
    icon:        '☕',
    createdAt:   Date.now() - 45 * 24 * 3600_000,

    beforeIdea:  '5 个城市快闪活动，咖啡品牌，文艺感，需要让年轻人主动分享',
    afterResult: '单条短视频自然扩散 450 万次曝光，获客成本降低 60%',
    steps: [
      {
        phase:       'concept',
        title:       '城市叙事设定',
        description: 'AI 为每座城市提炼独特气质：上海弄堂、成都慢生活、北京胡同、杭州茶山、广州夜市',
        prompt:      'art-house coffee culture, city-specific texture, slow cinema aesthetic, golden ratio composition, film grain',
      },
      {
        phase:       'storyboard',
        title:       '五城分镜',
        description: '每城 3 个镜头，统一视觉语言中保留城市个性',
        prompt:      'warm tungsten lighting, shallow depth-of-field, spontaneous street moments, barista close-up hands, steam texture',
      },
      {
        phase:       'image',
        title:       '胶片质感渲染',
        description: 'AI 图像引擎模拟 35mm 胶片色调，文艺冷感一致性',
        prompt:      '35mm film simulation, kodak portra 400 color tone, lens vignette, warm shadows, muted highlight roll-off',
      },
      {
        phase:       'video',
        title:       '竖版剪辑',
        description: '针对竖屏平台优化构图与节奏，9:16 全屏沉浸体验',
        prompt:      '9:16 vertical crop optimization, slow zoom drift, ambient city soundscape, 18fps film look timing',
      },
    ],
    views:       '450 万',
    conversion:  '60%↓',
    clientQuote: '在手机上做完了整支视频，路上喝着咖啡，下了高铁视频已经渲染好了。太魔幻了。',
    clientName:  '— Manner Coffee 创意总监',
  },
  {
    id:          'case-4',
    title:       '独立短片全流程创作',
    description: '8 分钟剧情短片从剧本到分镜全程使用 AI 导演工作台，传统制作周期压缩 60%。',
    result:      '入围三个独立电影节，融资谈判进行中',
    category:    '剧情短片',
    accentColor: '#a78bfa',
    icon:        '🎞',
    createdAt:   Date.now() - 60 * 24 * 3600_000,

    beforeIdea:  '讲一个关于城中村拆迁的短片，有诗意，有留白，8分钟，要入围电影节',
    afterResult: '8 分钟剧情短片，入围三个独立电影节，引发融资洽谈',
    steps: [
      {
        phase:       'concept',
        title:       '剧本结构',
        description: 'AI 编剧协作完成三幕式结构，保留导演个人情感与社会观察视角',
        prompt:      'contemplative drama, urban displacement theme, poetic realism, non-linear memory structure, three-act arc',
      },
      {
        phase:       'storyboard',
        title:       '分镜脚本',
        description: '28 个镜头完整分镜，AI 建议景别与轴线，导演逐帧确认',
        prompt:      'long take philosophy, wide establishing shots, intimate close-up contrast, golden hour natural light, handheld realism',
      },
      {
        phase:       'image',
        title:       '参考图预可视化',
        description: '每个关键镜头生成参考图，实拍前完整视觉预演',
        prompt:      'art-house photography reference, documentary naturalism, desaturated palette, window light silhouette, texture-rich environments',
      },
      {
        phase:       'video',
        title:       '粗剪装配',
        description: 'AI 剪辑助手根据脚本节奏自动排列素材，导演精修',
        prompt:      'rhythm-based assembly cut, silence as punctuation, ambient sound design, minimal score, 24fps 2.39:1 aspect ratio',
      },
    ],
    views:       '电影节展映',
    conversion:  '3 个入围',
    clientQuote: '过去我需要2个月完成这个剧本+分镜阶段，用这个工具只花了4天，而且创作感觉完全没有被剥夺。',
    clientName:  '— 独立导演 陈磊',
  },
]

// ─── Store ────────────────────────────────────────────────────────────────────

interface CaseStoreState {
  cases:      Case[]
  addCase:    (draft: Omit<Case, 'id' | 'createdAt'>) => void
  removeCase: (id: string) => void
}

function uid() {
  return `case-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export const useCaseStore = create<CaseStoreState>()(
  persist(
    (set) => ({
      cases: SEED_CASES,

      addCase: (draft) =>
        set((s) => ({
          cases: [{ ...draft, id: uid(), createdAt: Date.now() }, ...s.cases],
        })),

      removeCase: (id) =>
        set((s) => ({ cases: s.cases.filter((c) => c.id !== id) })),
    }),
    {
      name:    'cc:cases-v2',
      version: 2,
    },
  ),
)
