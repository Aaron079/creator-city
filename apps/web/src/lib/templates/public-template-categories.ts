export const PUBLIC_TEMPLATE_CATEGORIES = [
  '商业广告',
  '品牌短片',
  '产品展示',
  '社媒短视频',
  '短剧片段',
  '概念短片',
  'MV',
  '动画',
  '旅游 Vlog',
  '美食广告',
  '汽车广告',
  '房产展示',
  '游戏宣传',
  '教育课程',
  '企业宣传',
  '活动快剪',
  '访谈',
  '纪录片',
  '电商图',
  '角色设定',
  '情绪板',
  '分镜脚本',
  '预告片',
  '音乐视觉',
  '科技发布',
  '美妆广告',
  '服装 Lookbook',
  '运动赛事',
  '招募宣传',
  '城市宣传',
] as const

export type PublicTemplateCategory = (typeof PUBLIC_TEMPLATE_CATEGORIES)[number]

export const PUBLIC_TEMPLATE_NODE_TYPES = ['text', 'image', 'video', 'audio', 'mixed'] as const

export type PublicTemplateNodeType = (typeof PUBLIC_TEMPLATE_NODE_TYPES)[number]

export const PUBLIC_TEMPLATE_NODE_TYPE_LABELS: Record<PublicTemplateNodeType, string> = {
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
  mixed: '混合',
}
