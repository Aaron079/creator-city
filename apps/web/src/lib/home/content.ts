export interface HomeFeaturedItem {
  id: string
  title: string
  category: string
  summary: string
  href: string
  cta: string
  gradient: string
}

export interface HomeFeatureEntry {
  id: string
  title: string
  description: string
  href: string
  eyebrow: string
}

export interface HomeContentCardItem {
  id: string
  type: 'featured' | 'template' | 'project' | 'case' | 'tutorial' | 'community'
  title: string
  meta: string
  href: string
  metric: string
  tags: string[]
  gradient: string
}

export interface HomeContentRail {
  id: string
  title: string
  description: string
  href: string
  items: HomeContentCardItem[]
}

export const HOME_FEATURED_ITEMS: HomeFeaturedItem[] = [
  {
    id: 'featured-brand-film',
    title: '品牌短片启动台',
    category: '精选项目',
    summary: '把脚本、画面和交付拆成清晰入口，不让项目一开始就淹没在复杂流程里。',
    href: '/projects',
    cta: '查看项目',
    gradient: 'from-[#2a1a46] via-[#101a34] to-[#050505]',
  },
  {
    id: 'featured-canvas',
    title: '自由 AI Canvas',
    category: '精选画布',
    summary: '从文本、图片、视频或上传开始，让节点跟着你的创作顺序出现。',
    href: '/create',
    cta: '进入画布',
    gradient: 'from-[#21314d] via-[#121721] to-[#050505]',
  },
  {
    id: 'featured-template',
    title: '广告片模板库',
    category: '推荐模板',
    summary: '先看适合场景、推荐角色和流程建议，再决定是否进入创作。',
    href: '/templates',
    cta: '进入模板',
    gradient: 'from-[#3a2418] via-[#131820] to-[#050505]',
  },
]

export const HOME_FEATURE_ENTRIES: HomeFeatureEntry[] = [
  {
    id: 'new-project',
    title: '创建新项目',
    description: '从项目视角组织任务、协作与交付节奏。',
    href: '/projects',
    eyebrow: 'Project',
  },
  {
    id: 'text-to-video',
    title: '文本生视频',
    description: '先写一句话，再决定是出图还是直接推视频节点。',
    href: '/create',
    eyebrow: 'Canvas',
  },
  {
    id: 'image-generation',
    title: '图片生成',
    description: '先做关键画面、风格板和视觉参考。',
    href: '/create',
    eyebrow: 'Image',
  },
  {
    id: 'storyboard',
    title: '分镜策划',
    description: '用模板和案例把镜头结构先想清楚。',
    href: '/templates',
    eyebrow: 'Planning',
  },
  {
    id: 'character-control',
    title: '角色 / 姿势控制',
    description: '浏览创作者案例与角色方向，再进入具体创作。',
    href: '/explore',
    eyebrow: 'Explore',
  },
  {
    id: 'inspiration',
    title: '找灵感',
    description: '从案例、模板和社区动态里收集起点。',
    href: '/community',
    eyebrow: 'Discover',
  },
  {
    id: 'moodboard',
    title: '情绪板策划',
    description: '把视觉语气先说清楚，再回到画布细化。',
    href: '/templates',
    eyebrow: 'Moodboard',
  },
  {
    id: 'review-delivery',
    title: '审片与交付',
    description: '客户反馈、版本准备与导出入口集中在独立区域。',
    href: '/tools',
    eyebrow: 'Delivery',
  },
]

export const HOME_RECOMMENDATIONS: HomeContentCardItem[] = [
  {
    id: 'recommend-case-1',
    type: 'case',
    title: '赛博城市饮料广告案例',
    meta: '案例复盘 · Creator Case',
    href: '/explore',
    metric: '2.4k 收藏',
    tags: ['广告片', '霓虹', '镜头节奏'],
    gradient: 'from-[#381f45] via-[#111827] to-[#050505]',
  },
  {
    id: 'recommend-template-1',
    type: 'template',
    title: '品牌短片三段式模板',
    meta: '模板库 · Brand Film',
    href: '/templates',
    metric: '12 个项目在用',
    tags: ['模板', '品牌故事'],
    gradient: 'from-[#23344d] via-[#15222c] to-[#050505]',
  },
  {
    id: 'recommend-project-1',
    type: 'project',
    title: '正在推进中的汽车概念片',
    meta: '项目 · Producer Workspace',
    href: '/projects',
    metric: '6 位成员协作',
    tags: ['项目', '汽车', '交付'],
    gradient: 'from-[#3b291e] via-[#171a22] to-[#050505]',
  },
  {
    id: 'recommend-tutorial-1',
    type: 'tutorial',
    title: '怎样从一句 prompt 开始组织整支短片',
    meta: '教程 · Workflow Notes',
    href: '/community',
    metric: '18 分钟阅读',
    tags: ['教程', '创作方法'],
    gradient: 'from-[#1d3a35] via-[#101820] to-[#050505]',
  },
]

const buildRailItems = (prefix: string, type: HomeContentCardItem['type'], href: string, baseTitle: string): HomeContentCardItem[] => [
  {
    id: `${prefix}-1`,
    type,
    title: `${baseTitle} 01`,
    meta: `${baseTitle} · 精选`,
    href,
    metric: '推荐',
    tags: ['精选'],
    gradient: 'from-[#2b1f3b] via-[#111827] to-[#050505]',
  },
  {
    id: `${prefix}-2`,
    type,
    title: `${baseTitle} 02`,
    meta: `${baseTitle} · 热门`,
    href,
    metric: '更新中',
    tags: ['热门'],
    gradient: 'from-[#1d3148] via-[#14181f] to-[#050505]',
  },
  {
    id: `${prefix}-3`,
    type,
    title: `${baseTitle} 03`,
    meta: `${baseTitle} · 推荐`,
    href,
    metric: '更多内容',
    tags: ['推荐'],
    gradient: 'from-[#3f2c1f] via-[#181920] to-[#050505]',
  },
]

export const HOME_CONTENT_RAILS: HomeContentRail[] = [
  {
    id: 'featured-canvas',
    title: '精选画布',
    description: '从自由 AI Canvas 出发的精选创作方向。',
    href: '/create',
    items: buildRailItems('canvas', 'featured', '/create', '精选画布'),
  },
  {
    id: 'tv-commercial',
    title: '电视广告',
    description: '适合高效率出图、节奏明确的广告片方向。',
    href: '/templates',
    items: buildRailItems('tv', 'template', '/templates', '电视广告'),
  },
  {
    id: 'animation',
    title: '动画',
    description: '风格化世界、角色运动与叙事节奏的内容入口。',
    href: '/explore',
    items: buildRailItems('animation', 'case', '/explore', '动画案例'),
  },
  {
    id: 'narrative-short',
    title: '叙事短片',
    description: '先找人物和情绪，再进入自由画布细化。',
    href: '/community',
    items: buildRailItems('narrative', 'community', '/community', '叙事短片'),
  },
  {
    id: 'mv',
    title: 'MV',
    description: '更适合从氛围、运动和声音开始组织的创作。',
    href: '/templates',
    items: buildRailItems('mv', 'template', '/templates', 'MV 模板'),
  },
  {
    id: 'tutorial',
    title: '教程',
    description: '从模板、案例和社区方法论快速入门。',
    href: '/community',
    items: buildRailItems('tutorial', 'tutorial', '/community', '教程'),
  },
  {
    id: 'other',
    title: '其他',
    description: '更多创作方向与跨模块入口。',
    href: '/explore',
    items: buildRailItems('other', 'project', '/explore', '其他内容'),
  },
]
