import {
  PUBLIC_TEMPLATE_CATEGORIES,
  type PublicTemplateCategory,
  type PublicTemplateNodeType,
} from './public-template-categories'
import {
  ORIGINAL_TEMPLATE_LICENSE,
  REFERENCE_ONLY_TEMPLATE_LICENSE,
  buildTemplateNodeGraph,
  type PublicTemplateLicense,
  type PublicTemplateNodeGraph,
  type PublicTemplatePreview,
  type PublicTemplateSourceType,
  type PublicTemplateThumbnail,
} from './template-workflow'

export interface PublicTemplate {
  id: string
  title: string
  category: PublicTemplateCategory
  description: string
  promptStarter: string
  workflowSteps: string[]
  nodeType: PublicTemplateNodeType
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '21:9'
  styleTags: string[]
  useCases: string[]
  mediaQuery: string
  sourceType: PublicTemplateSourceType
  sourceUrl?: string
  license: PublicTemplateLicense
  licenseNote: string
  thumbnail: PublicTemplateThumbnail
  preview: PublicTemplatePreview
  nodeGraph: PublicTemplateNodeGraph
  isUsable: boolean
}

interface TemplateVariant {
  title: string
  description: string
  promptStarter: string
  workflowSteps: string[]
  nodeType?: PublicTemplateNodeType
  aspectRatio?: PublicTemplate['aspectRatio']
  styleTags?: string[]
  useCases?: string[]
  mediaQuery?: string
}

interface CategoryPlan {
  category: PublicTemplateCategory
  sourceUrl?: string
  sourceType?: PublicTemplateSourceType
  nodeType: PublicTemplateNodeType
  aspectRatio: PublicTemplate['aspectRatio']
  gradientFrom: string
  gradientTo: string
  styleTags: string[]
  useCases: string[]
  mediaQuery?: string
  variants: TemplateVariant[]
}

export const PUBLIC_TEMPLATE_LICENSE_NOTE =
  '模板结构为 Creator City 可编辑起点；外部来源仅作参考，请自行确认素材授权。'

const SOURCE_URLS = {
  canvaVideos: 'https://www.canva.com/create/videos/',
  canvaAds: 'https://www.canva.com/create/advertising-videos/',
  canvaProduct: 'https://www.canva.com/create/product-videos/',
  adobeVideo: 'https://www.adobe.com/express/create/video',
  adobeSocial: 'https://www.adobe.com/express/create/video/social',
  adobeMusic: 'https://www.adobe.com/express/create/video/music',
  adobeAnimation: 'https://www.adobe.com/express/create/video/animation',
  flexclipTemplates: 'https://www.flexclip.com/template/',
} as const

const CATEGORY_MEDIA_QUERY: Record<PublicTemplateCategory, string> = {
  商业广告: 'premium product commercial studio lighting',
  品牌短片: 'brand story cinematic people workspace',
  产品展示: 'product showcase macro studio',
  社媒短视频: 'vertical social video lifestyle creator',
  短剧片段: 'cinematic drama dialogue scene',
  概念短片: 'concept film futuristic atmosphere',
  MV: 'music video performance stage lights',
  动画: 'animation character design colorful',
  '旅游 Vlog': 'travel vlog city street landmark',
  美食广告: 'food commercial restaurant macro',
  汽车广告: 'car commercial night road motion',
  房产展示: 'real estate interior architecture tour',
  游戏宣传: 'game trailer esports neon',
  教育课程: 'online course classroom learning',
  企业宣传: 'corporate brand office team',
  活动快剪: 'event highlight crowd stage',
  访谈: 'interview podcast studio portrait',
  纪录片: 'documentary people real life',
  电商图: 'ecommerce product photography clean background',
  角色设定: 'character design portrait concept art',
  情绪板: 'moodboard texture color lifestyle',
  分镜脚本: 'storyboard film frames planning',
  预告片: 'movie trailer cinematic suspense',
  音乐视觉: 'music visualizer abstract light',
  科技发布: 'technology launch keynote product',
  美妆广告: 'beauty skincare cosmetics macro',
  '服装 Lookbook': 'fashion lookbook model studio',
  运动赛事: 'sports event action stadium',
  招募宣传: 'recruitment campaign team volunteers',
  城市宣传: 'city promotion skyline culture travel',
}

function buildTemplateMediaQuery(plan: CategoryPlan, variant: TemplateVariant) {
  return variant.mediaQuery
    ?? `${plan.mediaQuery ?? CATEGORY_MEDIA_QUERY[plan.category]} ${variant.title} ${variant.styleTags?.join(' ') ?? plan.styleTags.join(' ')}`
}

const CATEGORY_PLANS: CategoryPlan[] = [
  {
    category: '商业广告',
    sourceUrl: SOURCE_URLS.canvaAds,
    nodeType: 'video',
    aspectRatio: '16:9',
    gradientFrom: '#111827',
    gradientTo: '#16a34a',
    styleTags: ['hook', 'cta', 'commercial', 'conversion'],
    useCases: ['新品投放', '品牌曝光', '效果广告'],
    variants: [
      { title: '15秒产品卖点短片', description: '三秒钩子、痛点、卖点和行动号召的标准广告起点。', promptStarter: '生成一支15秒商业广告：开场用强视觉钩子引出用户痛点，中段展示产品核心卖点，结尾给出清晰CTA。品牌语气高级、克制、可信。', workflowSteps: ['定义受众和痛点', '写三秒钩子', '拆解产品卖点', '生成关键镜头', '添加CTA结尾'] },
      { title: '科技产品发布广告', description: '面向发布会和官网首屏的高质感产品短片结构。', promptStarter: '为一款科技产品创建发布广告：黑色玻璃空间、产品悬浮特写、功能亮点字幕、冷暖对比光线、结尾品牌标语。', workflowSteps: ['确认产品定位', '建立发布场景', '生成产品特写', '组织功能字幕', '输出发布版节奏'] },
      { title: '美妆前后对比广告', description: '以对比、质感和肤感细节推动转化。', promptStarter: '创建一支美妆前后对比广告：用自然光人像开场，展示使用前状态，切入质地和上脸细节，再呈现精致但真实的使用后效果。', workflowSteps: ['明确功效诉求', '设计前后对比', '生成质地镜头', '安排人物反馈', '收束购买理由'] },
      { title: '节日促销快闪广告', description: '适合电商大促、节庆活动和限时优惠。', promptStarter: '生成一支节日促销快闪广告：快速展示优惠信息、产品组合、倒计时氛围和强CTA，整体明亮、有速度感但不廉价。', workflowSteps: ['整理活动信息', '设计倒计时节奏', '生成产品组合', '加入价格/权益节点', '创建收尾CTA'] },
    ],
  },
  {
    category: '品牌短片',
    sourceUrl: SOURCE_URLS.canvaVideos,
    nodeType: 'mixed',
    aspectRatio: '16:9',
    gradientFrom: '#111827',
    gradientTo: '#7c3aed',
    styleTags: ['brand', 'story', 'emotion', 'cinematic'],
    useCases: ['品牌升级', '创始人故事', '价值观表达'],
    variants: [
      { title: '30秒品牌情绪片', description: '用人物、空间和一句核心主张建立品牌记忆。', promptStarter: '创作一支30秒品牌情绪片：从真实人物微表情切入，连接品牌使命、使用场景和结尾主张，镜头语言克制、电影感、留白充足。', workflowSteps: ['提炼品牌主张', '选择人物视角', '建立情绪板', '生成关键镜头', '整理旁白与结尾'] },
      { title: '品牌创始人故事', description: '以创始人的选择和转折讲清品牌为什么存在。', promptStarter: '生成品牌创始人故事短片：从一次真实问题开始，讲述创始人的判断、挫折、产品理念和今天的品牌承诺。', workflowSteps: ['梳理人物弧光', '写关键旁白', '生成工作场景', '加入产品证明点', '收束品牌承诺'] },
      { title: '品牌空间形象片', description: '适合门店、展厅、办公空间的品牌气质表达。', promptStarter: '创建品牌空间形象片：用慢推镜头展示空间材质、光线、人群状态和品牌符号，让观众感到可靠、专业、值得接近。', workflowSteps: ['拆解空间动线', '定义材质关键词', '生成环境镜头', '加入人物互动', '输出品牌落版'] },
      { title: '品牌年度主题片', description: '年度主题、Campaign Launch 和品牌升级发布结构。', promptStarter: '制作品牌年度主题片：以一句年度主题为中心，串联用户、团队、产品和未来愿景，节奏从平静到有力量。', workflowSteps: ['确定年度主题', '划分四个章节', '生成代表镜头', '设计字幕层级', '完成愿景收尾'] },
    ],
  },
  {
    category: '产品展示',
    sourceUrl: SOURCE_URLS.canvaProduct,
    nodeType: 'video',
    aspectRatio: '16:9',
    gradientFrom: '#082f49',
    gradientTo: '#14b8a6',
    styleTags: ['product', 'feature', 'demo', 'macro'],
    useCases: ['产品页', '发布会', '销售演示'],
    variants: [
      { title: '核心功能三连展示', description: '把复杂产品压缩成三段清晰的功能演示。', promptStarter: '生成产品展示视频：按“发现问题、功能演示、结果收益”三段组织，用干净背景和微距特写突出三个核心功能。', workflowSteps: ['列出三项功能', '写演示场景', '生成微距镜头', '加入收益字幕', '整理CTA'] },
      { title: '电商主图转视频', description: '把静态卖点拆成可编辑的短视频起点。', promptStarter: '将电商主图信息改写为短视频结构：开场展示产品全貌，中段逐一拆解卖点和使用场景，结尾保留价格/权益占位。', workflowSteps: ['提取主图卖点', '生成产品全貌', '安排细节特写', '增加使用场景', '输出电商结尾'] },
      { title: '服装 Lookbook', description: '适合服装、配饰、鞋包的系列展示。', promptStarter: '创建服装Lookbook视频：同一人物在三个场景切换造型，突出面料、廓形、搭配和行走动态，整体简洁高级。', workflowSteps: ['定义系列主题', '规划造型切换', '生成走动镜头', '补充面料特写', '输出品牌版式'] },
      { title: '包装开箱展示', description: '用开箱、触感和细节制造产品期待。', promptStarter: '生成包装开箱展示：从盒身外观、开盒动作、内衬细节到产品首次露出，强调质感、仪式感和品牌细节。', workflowSteps: ['拆解包装层级', '设计开箱动作', '生成材质特写', '加入品牌细节', '形成结尾定格'] },
    ],
  },
  {
    category: '社媒短视频',
    sourceUrl: SOURCE_URLS.adobeSocial,
    nodeType: 'video',
    aspectRatio: '9:16',
    gradientFrom: '#312e81',
    gradientTo: '#ec4899',
    styleTags: ['vertical', 'social', 'short-form', 'hook'],
    useCases: ['抖音/Reels', '小红书', '信息流投放'],
    variants: [
      { title: '前三秒反差钩子', description: '短视频信息流里用反差开场带动停留。', promptStarter: '生成9:16社媒短视频：第一秒给出反差画面或问题，中段快速解释原因，结尾给出一个可执行建议或产品动作。', workflowSteps: ['写反差开场', '压缩信息点', '生成竖屏镜头', '设计字幕节奏', '添加互动结尾'] },
      { title: '教程型一分钟脚本', description: '适合知识、工具和生活方式账号。', promptStarter: '创建一分钟教程短视频：开头说明结果，中段用3个步骤讲清方法，每步配一个画面动作，结尾提示保存或继续创作。', workflowSteps: ['定义教程结果', '拆成三步', '生成动作镜头', '安排字幕重点', '收尾互动'] },
      { title: '种草清单短片', description: '用清单结构降低观看负担并增强收藏率。', promptStarter: '生成一支种草清单短片：以“我会反复使用的3个细节”为主题，逐条展示场景、理由和适用人群。', workflowSteps: ['确定清单主题', '写三条理由', '生成场景镜头', '插入标签字幕', '输出收藏提示'] },
      { title: '热点跟拍模板', description: '适合品牌快速响应热点但保持可控表达。', promptStarter: '创建热点跟拍短视频结构：保留可替换的热点开场、品牌观点、产品连接和轻量结尾，不使用任何第三方热点素材本体。', workflowSteps: ['写热点占位', '定义品牌态度', '生成替代画面', '连接产品/服务', '输出可复用版本'] },
    ],
  },
  {
    category: '短剧片段',
    nodeType: 'mixed',
    aspectRatio: '9:16',
    gradientFrom: '#1f2937',
    gradientTo: '#ef4444',
    styleTags: ['drama', 'vertical', 'conflict', 'dialogue'],
    useCases: ['短剧开场', '剧情广告', '角色试拍'],
    variants: [
      { title: '短剧冲突开场', description: '用强冲突建立人物关系和继续观看理由。', promptStarter: '生成短剧冲突开场：两个人物在狭小空间对峙，第一句台词制造误会，中段升级冲突，结尾留下反转悬念。', workflowSteps: ['设定人物关系', '写冲突台词', '生成竖屏场景', '安排反应镜头', '留下悬念'] },
      { title: '误会反转片段', description: '适合剧情号和剧情化广告的反转结构。', promptStarter: '创建一段误会反转短剧：开场让观众误判角色动机，中段提供关键线索，最后用一个动作完成反转。', workflowSteps: ['定义误会点', '埋入线索', '设计关键道具', '生成反应镜头', '输出反转结尾'] },
      { title: '职场高压对话', description: '会议室、走廊和电梯等高张力短场景。', promptStarter: '生成职场高压对话片段：上级提出不合理要求，主角短暂停顿后给出反击，镜头强调眼神、手部动作和空间压迫。', workflowSteps: ['设定职场场景', '写双方目标', '生成压迫构图', '安排沉默节奏', '制作反击句'] },
      { title: '情感关系试拍', description: '用少量台词测试人物化学反应。', promptStarter: '创建情感关系试拍：两位角色在夜晚街边重逢，台词简短但有潜台词，结尾停在未说出口的选择。', workflowSteps: ['定义关系前史', '写潜台词', '生成夜景镜头', '安排表情特写', '留下未完成感'] },
    ],
  },
  {
    category: '概念短片',
    sourceUrl: SOURCE_URLS.adobeVideo,
    nodeType: 'mixed',
    aspectRatio: '16:9',
    gradientFrom: '#020617',
    gradientTo: '#0ea5e9',
    styleTags: ['concept', 'worldbuilding', 'lookdev', 'atmosphere'],
    useCases: ['概念提案', '视觉开发', '导演阐述'],
    variants: [
      { title: '未来城市概念片', description: '建立世界观、空间尺度和情绪基调。', promptStarter: '生成未来城市概念短片：清晨雾气、巨构建筑、人群流动和微弱霓虹，强调空间层次和一种安静的未来感。', workflowSteps: ['定义世界观规则', '生成城市远景', '加入人物尺度', '设计声音氛围', '输出概念说明'] },
      { title: '孤独机器人片段', description: '适合科幻、动画和实验短片提案。', promptStarter: '创建孤独机器人概念片：废弃仓库里一个小型机器人修复旧物，镜头温柔，主题关于记忆和陪伴。', workflowSteps: ['设定角色功能', '生成空间氛围', '安排动作细节', '加入情绪转折', '完成主题句'] },
      { title: '自然异象短片', description: '用一个异常现象驱动视觉探索。', promptStarter: '生成自然异象概念片：平静湖面上出现反向流动的光，人物远观，镜头逐步从写实转向超现实。', workflowSteps: ['定义异象规则', '生成写实环境', '设计异常变化', '建立人物反应', '输出视觉关键词'] },
      { title: '黑盒实验视觉', description: '适合舞美、装置、AI 实验影像。', promptStarter: '创建黑盒实验视觉短片：黑色空间中光线、烟雾、人体动作和投影符号互相响应，节奏从极简到爆发。', workflowSteps: ['定义舞台限制', '生成光线动作', '加入人体运动', '安排节奏爆点', '形成提案画面'] },
    ],
  },
  {
    category: 'MV',
    sourceUrl: SOURCE_URLS.adobeMusic,
    nodeType: 'video',
    aspectRatio: '16:9',
    gradientFrom: '#3b0764',
    gradientTo: '#f97316',
    styleTags: ['music-video', 'rhythm', 'performance', 'mood'],
    useCases: ['MV提案', '歌曲视觉', '舞台背景'],
    variants: [
      { title: 'MV 情绪视觉', description: '先建立歌曲情绪，再组织表演和意象。', promptStarter: '为一首中速歌曲生成MV情绪视觉：夜色、公路、背光人物和缓慢推镜，画面跟随鼓点切换但保留呼吸感。', workflowSteps: ['提取歌曲情绪', '建立视觉母题', '生成表演镜头', '插入意象画面', '按段落整理节奏'] },
      { title: '舞台表演版 MV', description: '适合乐队、歌手和现场风格视觉。', promptStarter: '创建舞台表演版MV：主唱、乐手、灯光和观众反应交替出现，强调现场能量和可剪辑镜头覆盖。', workflowSteps: ['确定舞台风格', '生成表演分镜', '安排灯光变化', '补充观众反应', '输出剪辑节奏'] },
      { title: '叙事型歌曲短片', description: '用人物关系承载歌词核心。', promptStarter: '生成叙事型MV短片：一对角色在城市中错过与重逢，镜头对应歌词情绪，不直接解释歌词而用动作表达。', workflowSteps: ['找出歌词主题', '设定人物关系', '生成城市动线', '安排错过/重逢', '输出高潮段落'] },
      { title: '竖屏音乐片段', description: '适合歌曲宣发、片段传播和歌词视频。', promptStarter: '创建9:16竖屏音乐片段：用大字幕、人物动作和节拍切换突出副歌，视觉简洁但记忆点强。', workflowSteps: ['选择副歌段落', '设计字幕版式', '生成竖屏镜头', '匹配节拍切点', '输出传播片段'], aspectRatio: '9:16' },
    ],
  },
  {
    category: '动画',
    sourceUrl: SOURCE_URLS.adobeAnimation,
    nodeType: 'mixed',
    aspectRatio: '16:9',
    gradientFrom: '#164e63',
    gradientTo: '#a3e635',
    styleTags: ['animation', 'character', 'motion', 'explainer'],
    useCases: ['动画短片', '解释视频', '角色试拍'],
    variants: [
      { title: '动画角色设定', description: '从角色性格、外形和动作习惯开始。', promptStarter: '生成动画角色设定：一个乐观但笨拙的年轻发明家，包含外形轮廓、表情范围、标志动作和一段试拍动作。', workflowSteps: ['写角色关键词', '生成外形草案', '定义表情范围', '设计标志动作', '输出试拍镜头'] },
      { title: '二维解释动画', description: '把抽象概念转成简单图形和动作。', promptStarter: '创建二维解释动画：用几何图形说明一个复杂服务流程，步骤清晰、配色克制、转场流畅。', workflowSteps: ['拆解概念步骤', '定义图形语言', '生成关键画面', '设计转场动作', '输出旁白节点'] },
      { title: '定格质感小短片', description: '模拟手工材质和小尺度空间。', promptStarter: '生成定格质感动画短片：纸张、黏土和小道具构成桌面世界，一个小角色完成一次简单任务。', workflowSteps: ['设定桌面世界', '选择材质语言', '生成角色动作', '安排道具变化', '输出定格节奏'] },
      { title: '卡通品牌 Mascot', description: '为品牌吉祥物建立首个出场模板。', promptStarter: '创建品牌Mascot出场动画：吉祥物从品牌符号中出现，做一个简单互动动作，最后指向产品或活动信息。', workflowSteps: ['提炼品牌符号', '生成Mascot外形', '设计入场动作', '连接产品信息', '完成落版'] },
    ],
  },
  {
    category: '旅游 Vlog',
    nodeType: 'video',
    aspectRatio: '9:16',
    gradientFrom: '#0f766e',
    gradientTo: '#facc15',
    styleTags: ['travel', 'vlog', 'city', 'diary'],
    useCases: ['城市开场', '路线推荐', '旅行日记'],
    variants: [
      { title: '旅游城市 Vlog 开场', description: '用城市地标、街道和人物进入感开场。', promptStarter: '生成旅游城市Vlog开场：清晨抵达、街道细节、地标远景和第一人称步行镜头，文字轻量，不使用第三方素材。', workflowSteps: ['确定城市气质', '规划到达镜头', '生成街道细节', '加入地标远景', '输出开场字幕'] },
      { title: '一天路线快剪', description: '适合小红书、抖音和旅行攻略。', promptStarter: '创建一天路线快剪：早餐、交通、景点、咖啡、夜景五段，每段保留可替换地点和时间标签。', workflowSteps: ['列出路线节点', '生成段落镜头', '加入地点标签', '设计快切节奏', '输出攻略结尾'] },
      { title: '酒店入住体验', description: '从到达、房间、细节到窗外景观。', promptStarter: '生成酒店入住体验短片：前台、房间门打开、床品细节、浴室材质、窗外景色和一句体验总结。', workflowSteps: ['拆分入住动线', '生成房间全景', '补充材质细节', '安排窗景镜头', '输出体验评价'] },
      { title: '慢旅行情绪片', description: '弱攻略、强氛围的旅行影像起点。', promptStarter: '创建慢旅行情绪片：雨后街道、手持咖啡、陌生人背影、车窗反光和低饱和色彩，节奏舒缓。', workflowSteps: ['提炼情绪词', '生成慢镜头', '加入生活细节', '设计色彩基调', '完成旁白草稿'] },
    ],
  },
  {
    category: '美食广告',
    nodeType: 'video',
    aspectRatio: '16:9',
    gradientFrom: '#7f1d1d',
    gradientTo: '#f59e0b',
    styleTags: ['food', 'macro', 'restaurant', 'appetite'],
    useCases: ['餐厅新品', '外卖广告', '菜单推广'],
    variants: [
      { title: '餐厅新品发布', description: '用食材、出餐和顾客反应建立食欲。', promptStarter: '生成餐厅新品发布广告：食材新鲜特写、厨师动作、热气、摆盘和顾客第一口反应，画面有食欲但不过度夸张。', workflowSteps: ['定义菜品卖点', '生成食材特写', '安排烹饪动作', '展示摆盘细节', '加入顾客反馈'] },
      { title: '咖啡馆早晨短片', description: '适合门店账号和生活方式品牌。', promptStarter: '创建咖啡馆早晨短片：磨豆、萃取、窗边光线、第一位客人和一杯咖啡的特写，气氛安静温暖。', workflowSteps: ['设定门店氛围', '生成制作流程', '加入空间细节', '安排人物动作', '输出品牌字幕'] },
      { title: '外卖套餐促销', description: '信息清晰、节奏快的转化型美食广告。', promptStarter: '生成外卖套餐促销视频：用俯拍展示套餐组合，突出价格/权益占位和下单便利，结尾给出限时CTA。', workflowSteps: ['列出套餐内容', '生成俯拍组合', '插入权益字幕', '展示配送场景', '完成CTA'] },
      { title: '甜品治愈视觉', description: '强调质地、切面和情绪价值。', promptStarter: '创建甜品治愈视觉短片：蛋糕切面、奶油纹理、叉子入口和柔和光线，适合新品预热或品牌日常。', workflowSteps: ['定义甜品质感', '生成切面特写', '安排入口镜头', '加入情绪字幕', '输出封面帧'] },
    ],
  },
  {
    category: '汽车广告',
    nodeType: 'video',
    aspectRatio: '16:9',
    gradientFrom: '#111827',
    gradientTo: '#dc2626',
    styleTags: ['auto', 'motion', 'night', 'premium'],
    useCases: ['车型发布', '试驾短片', '经销商广告'],
    variants: [
      { title: '汽车夜景广告', description: '城市夜景、反光和行驶动势的车型片。', promptStarter: '生成汽车夜景广告：车辆穿过城市灯光，低机位跟拍，轮毂、车灯、内饰和车身反光依次出现，质感高级。', workflowSteps: ['定义车型气质', '生成城市夜景', '安排低机位跟拍', '补充内外饰特写', '输出品牌结尾'] },
      { title: '新能源科技展示', description: '突出智能座舱、续航和科技体验。', promptStarter: '创建新能源车型科技展示：智能座舱屏幕、充电场景、静音行驶和家庭出行，用简洁字幕说明功能收益。', workflowSteps: ['列出科技卖点', '生成座舱镜头', '安排充电场景', '展示出行收益', '完成CTA'] },
      { title: '越野户外短片', description: '山路、泥地和生活方式场景。', promptStarter: '生成越野户外短片：车辆从城市驶向山野，经过碎石路、营地和日落，强调通过性与自由感。', workflowSteps: ['规划路线变化', '生成越野动作', '加入营地场景', '安排日落镜头', '收束生活方式'] },
      { title: '内饰豪华细节', description: '适合经销商展厅和车型卖点页。', promptStarter: '创建汽车内饰豪华细节视频：座椅缝线、中控材质、氛围灯、旋钮和空间感，节奏慢、光线精致。', workflowSteps: ['列出内饰亮点', '生成材质特写', '安排空间镜头', '加入功能字幕', '输出展厅版本'] },
    ],
  },
  {
    category: '房产展示',
    nodeType: 'video',
    aspectRatio: '16:9',
    gradientFrom: '#0f172a',
    gradientTo: '#84cc16',
    styleTags: ['real-estate', 'interior', 'walkthrough', 'premium'],
    useCases: ['楼盘视频', '民宿展示', '空间设计'],
    variants: [
      { title: '房产空间走览', description: '用动线展示户型、采光和关键空间。', promptStarter: '生成房产空间走览：从入户门进入，依次展示客厅、厨房、卧室、窗景和社区配套，镜头平稳、空间真实。', workflowSteps: ['梳理空间动线', '生成入户镜头', '展示关键房间', '补充采光窗景', '输出卖点总结'] },
      { title: '设计师样板间', description: '强调材质、灯光和软装逻辑。', promptStarter: '创建设计师样板间短片：用慢镜头展示石材、木纹、灯光、家具比例和生活细节，语气专业。', workflowSteps: ['确定设计风格', '生成材质细节', '安排软装镜头', '补充生活场景', '输出设计说明'] },
      { title: '民宿房源展示', description: '适合短租平台和社媒推广。', promptStarter: '生成民宿房源展示：抵达、房间、公共区、窗外景色和附近体验，画面温暖，保留价格和预订入口占位。', workflowSteps: ['拆分入住体验', '生成房间镜头', '展示公共空间', '加入周边场景', '完成预订CTA'] },
      { title: '商业空间招商片', description: '适合写字楼、园区和商业街区。', promptStarter: '创建商业空间招商片：外立面、人流、办公空间、交通位置和商业氛围，突出效率、形象和成长空间。', workflowSteps: ['定义招商对象', '生成外立面', '展示空间配套', '加入区位信息', '输出招商结尾'] },
    ],
  },
  {
    category: '游戏宣传',
    nodeType: 'video',
    aspectRatio: '16:9',
    gradientFrom: '#18181b',
    gradientTo: '#8b5cf6',
    styleTags: ['game', 'trailer', 'character', 'combat'],
    useCases: ['游戏PV', '角色预告', '版本更新'],
    variants: [
      { title: '游戏角色登场', description: '角色身份、能力和高光动作的出场结构。', promptStarter: '生成游戏角色登场预告：黑场中出现角色剪影，展示武器/能力、战斗动作和一句角色宣言，最后定格角色名。', workflowSteps: ['定义角色身份', '生成剪影开场', '设计能力展示', '安排战斗高光', '输出角色名定格'] },
      { title: '版本更新 PV', description: '新地图、新角色、新机制的版本宣传。', promptStarter: '创建游戏版本更新PV：以新地图远景开场，依次展示角色、机制、Boss和活动奖励，节奏强、有发布感。', workflowSteps: ['列出更新内容', '生成地图远景', '展示新机制', '安排Boss镜头', '完成上线信息'] },
      { title: '玩法机制演示', description: '让玩家快速理解核心玩法循环。', promptStarter: '生成玩法机制演示短片：用清晰镜头展示操作、反馈、奖励和下一步目标，避免过度电影化。', workflowSteps: ['拆解玩法循环', '生成操作画面', '展示反馈结果', '加入奖励节点', '输出说明字幕'] },
      { title: '移动游戏竖屏广告', description: '适合买量广告和社媒投放。', promptStarter: '创建9:16移动游戏广告：第一秒展示失败/危机，中段给出简单操作和爽点反馈，结尾出现下载CTA占位。', workflowSteps: ['写失败钩子', '展示简单操作', '生成爽点反馈', '加入奖励画面', '输出下载CTA'], aspectRatio: '9:16' },
    ],
  },
  {
    category: '教育课程',
    sourceUrl: SOURCE_URLS.adobeVideo,
    nodeType: 'mixed',
    aspectRatio: '16:9',
    gradientFrom: '#1e3a8a',
    gradientTo: '#06b6d4',
    styleTags: ['education', 'course', 'explainer', 'knowledge'],
    useCases: ['课程开场', '知识讲解', '训练营招生'],
    variants: [
      { title: '教育课程开场', description: '明确课程对象、学习结果和可信度。', promptStarter: '生成教育课程开场：先提出学习痛点，再展示课程将带来的结果、讲师场景和三项学习收获，语气专业清晰。', workflowSteps: ['定义学习对象', '写痛点开场', '列出学习结果', '生成讲师画面', '输出课程CTA'] },
      { title: '三步知识解释', description: '适合短知识、公开课和训练营内容。', promptStarter: '创建三步知识解释视频：用一个问题开场，分三步说明概念，每步配图形化画面和一句总结。', workflowSteps: ['确定核心问题', '拆成三步', '生成图形画面', '安排总结字幕', '输出复习卡片'] },
      { title: '训练营招生短片', description: '面向报名转化的课程营销结构。', promptStarter: '生成训练营招生短片：展示学员问题、训练营方法、作业反馈和结业成果，保留报名时间/价格占位。', workflowSteps: ['描述学员问题', '说明训练方法', '加入反馈场景', '展示成果样例', '完成报名CTA'] },
      { title: '课堂片头包装', description: '适合系列课程统一片头。', promptStarter: '创建课堂片头包装：课程名、章节号、关键词和简洁动效，整体现代、清爽、便于系列复用。', workflowSteps: ['设定系列视觉', '生成片头版式', '加入章节信息', '设计关键词动效', '输出模板规范'] },
    ],
  },
  {
    category: '企业宣传',
    nodeType: 'mixed',
    aspectRatio: '16:9',
    gradientFrom: '#0f172a',
    gradientTo: '#64748b',
    styleTags: ['corporate', 'team', 'annual', 'b2b'],
    useCases: ['官网视频', '招聘宣传', '年度回顾'],
    variants: [
      { title: '企业年度回顾', description: '把关键数据、团队和里程碑整理成短片。', promptStarter: '生成企业年度回顾短片：用时间线串联关键数据、团队协作、客户现场和下一年愿景，语气可信、有温度。', workflowSteps: ['整理年度节点', '生成团队场景', '加入数据画面', '展示客户价值', '输出愿景结尾'] },
      { title: 'B2B 服务介绍', description: '用问题、方案和客户收益讲清复杂服务。', promptStarter: '创建B2B服务介绍视频：从客户常见挑战切入，展示服务流程、团队能力、交付结果和合作CTA。', workflowSteps: ['定义客户挑战', '拆解服务流程', '生成团队画面', '展示结果证明', '完成合作CTA'] },
      { title: '招聘雇主品牌片', description: '展示团队文化、办公状态和成长机会。', promptStarter: '生成招聘雇主品牌片：用员工真实工作瞬间、团队协作、学习成长和办公空间建立吸引力。', workflowSteps: ['提炼雇主卖点', '生成员工镜头', '展示协作场景', '加入成长信息', '输出招聘入口'] },
      { title: '企业展会形象片', description: '适合展台大屏和商务会议开场。', promptStarter: '创建企业展会形象片：品牌标语开场，快速展示产品线、行业场景、客户价值和展台邀请。', workflowSteps: ['确定展会主题', '生成产品线画面', '展示行业场景', '加入邀请信息', '输出大屏版本'] },
    ],
  },
  {
    category: '活动快剪',
    sourceUrl: SOURCE_URLS.flexclipTemplates,
    nodeType: 'video',
    aspectRatio: '16:9',
    gradientFrom: '#581c87',
    gradientTo: '#f43f5e',
    styleTags: ['event', 'recap', 'highlight', 'fast-cut'],
    useCases: ['发布会', '音乐节', '沙龙复盘'],
    variants: [
      { title: '活动现场快剪', description: '把签到、演讲、互动和合影压成高能回顾。', promptStarter: '生成活动现场快剪：签到、人群、主讲人、互动、掌声和合影快速穿插，节奏明快但画面有秩序。', workflowSteps: ['列出活动段落', '生成现场镜头', '安排高能瞬间', '加入标题字幕', '输出回顾结尾'] },
      { title: '发布会开场回顾', description: '适合产品发布后的社媒复盘。', promptStarter: '创建发布会开场回顾：舞台灯光、观众入场、产品揭晓、嘉宾交流和媒体采访，占位素材可替换。', workflowSteps: ['定义发布主题', '生成舞台镜头', '展示产品揭晓', '加入交流场景', '完成社媒版本'] },
      { title: '音乐节高光片', description: '舞台、人群和灯光节奏的活动模板。', promptStarter: '生成音乐节高光片：舞台灯光、观众挥手、DJ/乐队动作、夜色和烟火，整体有能量。', workflowSteps: ['设定音乐风格', '生成舞台画面', '安排人群反应', '加入灯光爆点', '输出主视觉'] },
      { title: '会议精华摘要', description: '商务活动复盘，信息清晰不浮夸。', promptStarter: '创建会议精华摘要：嘉宾观点、观众听讲、圆桌讨论和关键金句字幕，适合会后传播。', workflowSteps: ['提取会议主题', '生成嘉宾镜头', '设计金句字幕', '加入讨论画面', '输出摘要结尾'] },
    ],
  },
  {
    category: '访谈',
    nodeType: 'mixed',
    aspectRatio: '16:9',
    gradientFrom: '#27272a',
    gradientTo: '#d97706',
    styleTags: ['interview', 'talking-head', 'preview', 'documentary'],
    useCases: ['人物访谈', '播客预告', '客户案例'],
    variants: [
      { title: '访谈预热视频', description: '用金句、人物状态和问题制造期待。', promptStarter: '生成访谈预热视频：开场给出一句金句，中段展示人物特写和提问瞬间，结尾抛出核心问题。', workflowSteps: ['选择核心金句', '生成访谈场景', '安排人物特写', '插入问题字幕', '输出上线信息'] },
      { title: '播客竖屏切条', description: '把长访谈切成高密度社媒片段。', promptStarter: '创建播客竖屏切条：一段观点清晰的讲话，配大字幕、轻量B-roll和节目名占位。', workflowSteps: ['确定观点片段', '生成竖屏构图', '设计字幕层级', '加入B-roll', '输出节目CTA'], aspectRatio: '9:16' },
      { title: '客户案例访谈', description: 'B2B 客户证明与使用故事模板。', promptStarter: '生成客户案例访谈：客户先描述原问题，再讲使用过程和量化变化，穿插产品/团队服务画面。', workflowSteps: ['写客户背景', '提取原问题', '生成访谈镜头', '加入服务画面', '输出结果证明'] },
      { title: '创作者自述短片', description: '适合个人品牌、作品集和纪录式介绍。', promptStarter: '创建创作者自述短片：创作者在工作空间讲述动机、方法和代表作品，镜头真实、温和、有细节。', workflowSteps: ['提炼个人主题', '生成工作空间', '安排自述段落', '插入作品占位', '输出个人签名'] },
    ],
  },
  {
    category: '纪录片',
    nodeType: 'mixed',
    aspectRatio: '16:9',
    gradientFrom: '#1c1917',
    gradientTo: '#78716c',
    styleTags: ['documentary', 'human', 'observational', 'truth'],
    useCases: ['人物纪录', '城市议题', '品牌纪录'],
    variants: [
      { title: '纪录片人物开场', description: '用环境、动作和一句话建立人物。', promptStarter: '生成纪录片人物开场：清晨环境、人物手部动作、生活细节和一句旁白，强调真实感和观察感。', workflowSteps: ['定义人物处境', '生成生活环境', '安排动作细节', '写开场旁白', '形成主题问题'] },
      { title: '城市议题短片', description: '适合公共议题、空间变化和社区故事。', promptStarter: '创建城市议题纪录短片：街道、人群、旧物、新建设施和受访者声音共同呈现一个城市变化问题。', workflowSteps: ['确定议题角度', '生成街道观察', '加入受访者线索', '展示变化细节', '输出观点收束'] },
      { title: '手艺人一天', description: '人物动作与工艺细节驱动的纪录结构。', promptStarter: '生成手艺人一天纪录片：从开门准备、材料处理、制作细节到一天结束，镜头尊重劳动节奏。', workflowSteps: ['梳理一天流程', '生成工艺细节', '安排人物采访', '加入环境声音', '完成日落结尾'] },
      { title: '品牌纪录短章', description: '不硬广，用真实工作证明品牌价值。', promptStarter: '创建品牌纪录短章：跟随团队解决一个真实客户问题，展示判断、协作和结果，不夸张宣传。', workflowSteps: ['选择真实问题', '生成团队协作', '展示过程节点', '加入客户反馈', '输出价值总结'] },
    ],
  },
  {
    category: '电商图',
    nodeType: 'image',
    aspectRatio: '1:1',
    gradientFrom: '#064e3b',
    gradientTo: '#22c55e',
    styleTags: ['ecommerce', 'hero-image', 'banner', 'conversion'],
    useCases: ['主图', '详情页', '社媒封面'],
    variants: [
      { title: '电商主图视觉', description: '产品主体、卖点标签和干净背景。', promptStarter: '生成电商主图：产品居中，背景干净，保留卖点标签和价格权益占位，整体专业且不侵犯第三方素材。', workflowSteps: ['确认主体产品', '设计主图构图', '加入卖点标签', '预留权益信息', '输出1:1封面'] },
      { title: '套装组合图', description: '适合多SKU、礼盒和套餐组合。', promptStarter: '创建套装组合电商图：多个产品按层级摆放，突出主品、赠品和组合价值，背景有轻微渐变。', workflowSteps: ['列出SKU层级', '安排组合构图', '生成主品高光', '加入赠品占位', '输出详情页图'] },
      { title: '场景化详情图', description: '用生活场景解释产品使用价值。', promptStarter: '生成场景化详情图：产品出现在真实使用场景中，强调人物手部动作和环境细节，保留说明文案位置。', workflowSteps: ['定义使用场景', '生成环境画面', '放置产品主体', '加入动作细节', '预留文案区域'] },
      { title: '大促活动封面', description: '活动视觉、产品和利益点的封面图。', promptStarter: '创建大促活动封面图：强视觉中心、产品组合、优惠信息占位和倒计时氛围，配色醒目但不杂乱。', workflowSteps: ['整理活动权益', '生成视觉中心', '安排产品组合', '加入倒计时位置', '输出活动封面'] },
    ],
  },
  {
    category: '角色设定',
    nodeType: 'image',
    aspectRatio: '4:3',
    gradientFrom: '#450a0a',
    gradientTo: '#f97316',
    styleTags: ['character', 'design', 'concept-art', 'pose'],
    useCases: ['动画角色', '游戏角色', '短剧人物'],
    variants: [
      { title: '主角三视图设定', description: '正侧背轮廓、服装和道具的角色起点。', promptStarter: '生成角色三视图设定：主角正面、侧面、背面轮廓清晰，包含服装材质、标志道具和性格关键词。', workflowSteps: ['写人物设定', '生成轮廓草案', '补充服装材质', '加入标志道具', '输出三视图'] },
      { title: '反派视觉设定', description: '从动机、权力感和视觉压迫出发。', promptStarter: '创建反派角色设定：外形克制但有压迫感，服装细节体现身份，表情冷静，保留武器/道具占位。', workflowSteps: ['定义反派动机', '设计压迫轮廓', '生成服装细节', '加入表情范围', '输出角色卡'] },
      { title: '品牌代言人设定', description: '为品牌虚拟人或广告角色建立风格。', promptStarter: '生成品牌代言人角色设定：亲和、专业、现代，包含服装、姿态、色彩和品牌符号，不使用真实名人脸。', workflowSteps: ['提炼品牌人格', '设计角色外形', '生成姿态样张', '加入品牌色', '输出使用规范'] },
      { title: '群像角色关系图', description: '适合短剧、动画和团队项目。', promptStarter: '创建群像角色关系图：四个角色站位、年龄层、性格差异和关系箭头，画面用于前期开发。', workflowSteps: ['列出角色关系', '生成群像站位', '区分服装色彩', '加入关系标签', '输出开发图'] },
    ],
  },
  {
    category: '情绪板',
    nodeType: 'image',
    aspectRatio: '16:9',
    gradientFrom: '#312e81',
    gradientTo: '#0f766e',
    styleTags: ['moodboard', 'styleframe', 'lookdev', 'palette'],
    useCases: ['提案', '视觉开发', '客户确认'],
    variants: [
      { title: '品牌视觉情绪板', description: '颜色、材质、人物和空间的统一风格起点。', promptStarter: '生成品牌视觉情绪板：包含色彩、材质、人物状态、空间光线和字体气质占位，用于客户确认方向。', workflowSteps: ['提炼风格词', '生成色彩区块', '加入材质参考', '安排人物/空间', '输出提案页'] },
      { title: '电影感 Lookdev', description: '为短片或广告确定光线、镜头和色彩。', promptStarter: '创建电影感Lookdev情绪板：低照度、背光、浅景深、空间层次和主色调，保留镜头语言说明。', workflowSteps: ['定义影像基调', '生成光线样张', '加入构图参考', '整理色彩规则', '输出Lookdev说明'] },
      { title: '产品材质情绪板', description: '围绕金属、玻璃、织物等质感建立参考。', promptStarter: '生成产品材质情绪板：将金属、玻璃、织物、皮革或塑料质感整理成可用于产品片的视觉方向。', workflowSteps: ['选择材质关键词', '生成材质样块', '安排光线测试', '加入产品占位', '输出风格规则'] },
      { title: '社媒账号风格板', description: '适合账号视觉升级和内容系列化。', promptStarter: '创建社媒账号风格板：封面、字幕、色彩、人物姿态和常用场景统一为一套可复用规则。', workflowSteps: ['确定账号人设', '生成封面风格', '设计字幕规则', '加入场景样式', '输出系列模板'] },
    ],
  },
  {
    category: '分镜脚本',
    nodeType: 'text',
    aspectRatio: '16:9',
    gradientFrom: '#334155',
    gradientTo: '#eab308',
    styleTags: ['storyboard', 'script', 'shot-list', 'previs'],
    useCases: ['广告分镜', '短片分镜', '拍摄计划'],
    variants: [
      { title: '广告六镜头分镜', description: '从钩子到CTA的镜头表起点。', promptStarter: '写一份广告六镜头分镜脚本：每个镜头包含画面、景别、动作、字幕、时长和生成提示。主题为一个可替换产品卖点。', workflowSteps: ['定义广告目标', '拆成六个镜头', '写画面动作', '补充字幕/时长', '输出生成提示'] },
      { title: '短片三幕分镜', description: '适合概念短片和剧情提案。', promptStarter: '生成短片三幕分镜脚本：开端建立人物和环境，中段出现转折，结尾留下情绪余韵；每幕拆成3个镜头。', workflowSteps: ['确定主题问题', '建立三幕结构', '拆分镜头表', '加入情绪变化', '输出拍摄提示'] },
      { title: '产品演示 Shot List', description: '功能演示、微距、使用场景的拍摄清单。', promptStarter: '写产品演示Shot List：包含全貌、功能手部操作、微距细节、使用前后和CTA镜头，适合生成或拍摄。', workflowSteps: ['列出功能点', '安排镜头类型', '写动作说明', '补充道具/光线', '输出拍摄清单'] },
      { title: '采访 B-roll 脚本', description: '为访谈补足环境和细节镜头。', promptStarter: '生成采访B-roll脚本：围绕人物工作环境、手部动作、关键物件、路上状态和空镜，补充访谈画面层次。', workflowSteps: ['确定人物职业', '列出环境镜头', '写动作细节', '加入物件特写', '输出B-roll清单'] },
    ],
  },
  {
    category: '预告片',
    sourceUrl: SOURCE_URLS.flexclipTemplates,
    nodeType: 'video',
    aspectRatio: '16:9',
    gradientFrom: '#020617',
    gradientTo: '#e11d48',
    styleTags: ['trailer', 'teaser', 'launch', 'suspense'],
    useCases: ['项目预告', '电影预告', '产品预热'],
    variants: [
      { title: '悬念预告片', description: '不交代全部信息，用问题和节奏制造期待。', promptStarter: '生成悬念预告片：黑场文字、快速闪回、人物反应、关键物件和一句未完成的问题，结尾给出上线日期占位。', workflowSteps: ['确定核心悬念', '生成闪回镜头', '安排文字节奏', '加入关键物件', '输出日期落版'] },
      { title: '产品预热视频', description: '发布前隐藏细节、释放局部和气质。', promptStarter: '创建产品预热视频：只展示轮廓、材质、局部灯光和用户反应，不提前完整露出产品，结尾提示发布日期。', workflowSteps: ['确定保密程度', '生成局部特写', '安排反应镜头', '加入发布信息', '输出预热版'] },
      { title: '电影项目 Teaser', description: '短片/长片项目的气氛先导。', promptStarter: '生成电影项目Teaser：用空间、声音、人物背影和一句旁白建立类型，不透露完整剧情。', workflowSteps: ['定义类型气质', '生成空间画面', '加入人物背影', '写先导旁白', '输出片名卡'] },
      { title: '活动倒计时预告', description: '适合会议、展会、演唱会、直播预热。', promptStarter: '创建活动倒计时预告：倒计时数字、场地局部、嘉宾/节目占位和报名CTA，节奏逐步增强。', workflowSteps: ['整理活动信息', '生成场地局部', '加入嘉宾占位', '设计倒计时', '完成报名CTA'] },
    ],
  },
  {
    category: '音乐视觉',
    sourceUrl: SOURCE_URLS.adobeMusic,
    nodeType: 'video',
    aspectRatio: '16:9',
    gradientFrom: '#1e1b4b',
    gradientTo: '#22d3ee',
    styleTags: ['visualizer', 'audio-reactive', 'stage', 'ambient'],
    useCases: ['音乐可视化', '舞台背景', '歌词视觉'],
    variants: [
      { title: '音频反应视觉', description: '以节拍、频谱和抽象形状驱动画面。', promptStarter: '生成音乐视觉模板：抽象几何体、粒子线条和光带随节拍变化，保留可替换歌曲名和艺术家名。', workflowSteps: ['定义音乐情绪', '设计视觉母题', '安排节拍变化', '加入标题信息', '输出循环片段'] },
      { title: '歌词视觉片段', description: '副歌、歌词和背景影像的轻量组合。', promptStarter: '创建歌词视觉片段：大号歌词排版、柔和背景运动和轻微节拍变化，画面不依赖任何第三方MV素材。', workflowSteps: ['选择歌词段落', '设计字体层级', '生成背景运动', '匹配节拍转场', '输出社媒版本'] },
      { title: '舞台屏幕循环', description: '演出大屏和直播背景的循环视觉。', promptStarter: '生成舞台屏幕循环视觉：光束、烟雾、抽象图案和缓慢变形，可无缝循环，适合现场背景。', workflowSteps: ['确定舞台色彩', '生成循环图案', '安排光束动作', '测试无缝衔接', '输出大屏比例'] },
      { title: '电子音乐封面动效', description: '为单曲封面扩展成动态宣传视觉。', promptStarter: '创建电子音乐封面动效：中心标题、抽象空间、脉冲光和低频震动感，保留封面替换占位。', workflowSteps: ['提炼封面气质', '生成抽象空间', '加入脉冲动效', '安排标题层级', '输出短循环'] },
    ],
  },
  {
    category: '科技发布',
    sourceUrl: SOURCE_URLS.adobeVideo,
    nodeType: 'video',
    aspectRatio: '16:9',
    gradientFrom: '#0b1120',
    gradientTo: '#38bdf8',
    styleTags: ['launch', 'technology', 'keynote', 'premium'],
    useCases: ['新品发布', '发布会开场', '官网首屏'],
    variants: [
      { title: 'AI 产品发布会开场', description: '发布会开头的产品使命、场景和功能预告。', promptStarter: '生成AI产品发布会开场：黑色空间、细线光效、产品轮廓、真实使用场景和一句发布主题，节奏克制但有期待感。', workflowSteps: ['提炼发布主题', '生成产品轮廓', '加入使用场景', '组织功能预告', '输出片名落版'] },
      { title: '硬件新品 Reveal', description: '从局部材质到完整露出的硬件发布结构。', promptStarter: '创建硬件新品Reveal视频：先展示材质、接口、边缘和交互细节，最后完整露出产品并给出核心卖点。', workflowSteps: ['确认硬件卖点', '生成局部特写', '安排完整露出', '加入功能字幕', '完成发布CTA'] },
      { title: 'SaaS 功能更新短片', description: '适合产品更新日志、官网和社媒发布。', promptStarter: '生成SaaS功能更新短片：用界面占位、用户任务、前后对比和三项新能力说明更新价值。', workflowSteps: ['整理更新点', '写用户任务', '生成界面占位', '加入前后对比', '输出更新摘要'] },
      { title: '开发者大会预告', description: '技术大会、API 发布和社区活动的预热片。', promptStarter: '创建开发者大会预告：代码片段、舞台灯光、开发者社群、议程模块和报名CTA，整体专业、有能量。', workflowSteps: ['确定大会主题', '生成技术视觉', '加入社群画面', '组织议程字幕', '完成报名CTA'] },
    ],
  },
  {
    category: '美妆广告',
    sourceUrl: SOURCE_URLS.canvaAds,
    nodeType: 'video',
    aspectRatio: '9:16',
    gradientFrom: '#831843',
    gradientTo: '#f9a8d4',
    styleTags: ['beauty', 'skincare', 'before-after', 'social'],
    useCases: ['美妆种草', '护肤广告', '新品试色'],
    variants: [
      { title: '护肤质地微距', description: '突出肤感、吸收和成分氛围的护肤模板。', promptStarter: '生成护肤质地微距广告：水润质地、手背推开、上脸轻拍、自然光肤感和功效字幕，表达真实、干净。', workflowSteps: ['定义功效重点', '生成质地微距', '安排上脸动作', '加入成分字幕', '输出种草结尾'] },
      { title: '口红试色短片', description: '多色号、妆容和场景切换的试色结构。', promptStarter: '创建口红试色短片：三个色号依次出现，展示膏体、上唇、妆容和适用场景，背景简洁。', workflowSteps: ['列出色号', '生成膏体特写', '安排上唇镜头', '匹配场景标签', '完成购买提示'] },
      { title: '底妆遮瑕对比', description: '用真实对比和细节镜头建立信任。', promptStarter: '生成底妆遮瑕对比广告：半脸对比、局部细节、自然光检查和持妆状态，不夸大效果。', workflowSteps: ['设定对比方式', '生成半脸画面', '补充局部细节', '加入持妆测试', '输出可信结尾'] },
      { title: '香氛情绪广告', description: '用空间、人物和材质表达香调氛围。', promptStarter: '创建香氛情绪广告：玻璃瓶、织物、花材、夜晚空间和人物动作共同表达香调，不使用第三方品牌素材。', workflowSteps: ['定义香调关键词', '生成瓶身占位', '加入材质意象', '安排人物动作', '输出品牌氛围'] },
    ],
  },
  {
    category: '服装 Lookbook',
    sourceUrl: SOURCE_URLS.canvaVideos,
    nodeType: 'video',
    aspectRatio: '9:16',
    gradientFrom: '#172554',
    gradientTo: '#fb923c',
    styleTags: ['fashion', 'lookbook', 'outfit', 'editorial'],
    useCases: ['服装上新', '穿搭账号', '品牌系列'],
    variants: [
      { title: '春夏系列 Lookbook', description: '用造型、面料和走动镜头展示系列感。', promptStarter: '生成春夏系列Lookbook：三套造型、自然光、面料近景和行走切换，画面干净、有品牌感。', workflowSteps: ['确定系列主题', '规划三套造型', '生成行走镜头', '补充面料细节', '输出上新结尾'] },
      { title: '街头穿搭快剪', description: '适合社媒穿搭和潮流品牌内容。', promptStarter: '创建街头穿搭快剪：城市街角、全身造型、鞋包配饰、转身动作和节拍切换，突出态度。', workflowSteps: ['定义街头风格', '生成街景动线', '展示全身造型', '加入配饰特写', '输出社媒版本'] },
      { title: '高级成衣质感片', description: '慢节奏、低饱和、突出剪裁和材质。', promptStarter: '生成高级成衣质感片：模特静态姿态、肩线、褶皱、纽扣和布料运动，镜头克制，适合品牌官网。', workflowSteps: ['提炼高级感关键词', '生成静态姿态', '补充剪裁细节', '安排布料运动', '完成品牌落版'] },
      { title: '鞋履新品走秀', description: '鞋履细节、步态和搭配场景的模板。', promptStarter: '创建鞋履新品走秀短片：低机位脚步、鞋底细节、搭配造型和路面材质，强调舒适与设计。', workflowSteps: ['定义鞋履卖点', '生成低机位脚步', '加入细节镜头', '展示搭配场景', '输出产品CTA'] },
    ],
  },
  {
    category: '运动赛事',
    nodeType: 'video',
    aspectRatio: '16:9',
    gradientFrom: '#064e3b',
    gradientTo: '#facc15',
    styleTags: ['sports', 'event', 'highlight', 'energy'],
    useCases: ['赛事预告', '高光剪辑', '球队宣传'],
    variants: [
      { title: '赛事高光回顾', description: '用动作、观众和比分节点组成赛事回顾。', promptStarter: '生成赛事高光回顾：运动员动作、观众欢呼、关键比分占位、慢动作瞬间和胜利庆祝，节奏有爆点。', workflowSteps: ['整理高光段落', '生成动作镜头', '加入观众反应', '设计比分字幕', '输出回顾结尾'] },
      { title: '球队赛前预告', description: '赛前氛围、球员状态和对阵信息。', promptStarter: '创建球队赛前预告：更衣室、热身、球员特写、城市氛围和对阵信息卡，语气坚定有力量。', workflowSteps: ['确认对阵信息', '生成热身镜头', '加入球员特写', '设计信息卡', '完成开赛CTA'] },
      { title: '健身挑战短片', description: '适合健身房、运动品牌和社媒挑战。', promptStarter: '生成健身挑战短片：训练动作、计时器、汗水细节和挑战结果，竖屏版本适合传播。', workflowSteps: ['定义挑战规则', '生成训练动作', '加入计时字幕', '展示结果反馈', '输出参与提示'], aspectRatio: '9:16' },
      { title: '马拉松城市宣传', description: '跑者、城市街道和赛事精神的组合。', promptStarter: '创建马拉松城市宣传片：清晨起跑、城市地标、跑者表情、补给点和终点冲刺，表达坚持与城市活力。', workflowSteps: ['规划赛道段落', '生成城市镜头', '加入跑者状态', '安排终点冲刺', '输出赛事落版'] },
    ],
  },
  {
    category: '招募宣传',
    nodeType: 'mixed',
    aspectRatio: '16:9',
    gradientFrom: '#1f2937',
    gradientTo: '#60a5fa',
    styleTags: ['recruiting', 'community', 'team', 'career'],
    useCases: ['团队招聘', '社群招募', '志愿者招募'],
    variants: [
      { title: '创作者招募短片', description: '面向创作者社区的招募工作流。', promptStarter: '生成创作者招募短片：展示创作空间、作品片段占位、成员协作和加入理由，语气真诚、有吸引力。', workflowSteps: ['定义招募对象', '生成创作空间', '展示协作场景', '写加入理由', '输出报名CTA'] },
      { title: '企业岗位招聘片', description: '说明岗位、团队文化和成长机会。', promptStarter: '创建企业岗位招聘片：岗位挑战、团队协作、办公状态、成长路径和投递入口，避免夸张福利堆叠。', workflowSteps: ['确认岗位画像', '生成团队镜头', '加入工作挑战', '展示成长路径', '完成投递CTA'] },
      { title: '志愿者招募视频', description: '公益项目、活动现场和参与价值。', promptStarter: '生成志愿者招募视频：项目现场、服务对象、志愿者行动和参与价值，画面真实温暖。', workflowSteps: ['明确公益主题', '生成现场画面', '安排行动镜头', '说明参与价值', '输出报名信息'] },
      { title: '校园社团招新', description: '社团活动、成员状态和招新信息卡。', promptStarter: '创建校园社团招新短片：活动片段、成员笑脸、成果展示和招新时间地点占位，节奏轻快。', workflowSteps: ['定义社团气质', '生成活动镜头', '展示成果占位', '加入信息卡', '完成招新结尾'] },
    ],
  },
  {
    category: '城市宣传',
    nodeType: 'video',
    aspectRatio: '16:9',
    gradientFrom: '#0f172a',
    gradientTo: '#f97316',
    styleTags: ['city', 'tourism', 'culture', 'campaign'],
    useCases: ['城市形象', '文旅推广', '招商宣传'],
    variants: [
      { title: '城市晨昏形象片', description: '从清晨到夜晚展示城市气质。', promptStarter: '生成城市晨昏形象片：清晨街道、通勤人群、文化地标、夕阳天际线和夜晚灯光，语气开放、现代。', workflowSteps: ['提炼城市关键词', '生成晨间镜头', '加入文化地标', '安排夜景收束', '输出城市标语'] },
      { title: '文旅目的地推广', description: '自然、人文、美食和路线推荐。', promptStarter: '创建文旅目的地推广片：自然景观、历史街区、本地美食、游客体验和路线标签，不使用第三方素材。', workflowSteps: ['确定目的地卖点', '生成景观镜头', '加入人文细节', '展示美食体验', '完成路线CTA'] },
      { title: '城市招商宣传', description: '产业、交通、人才和未来愿景的结构。', promptStarter: '生成城市招商宣传片：产业园区、交通枢纽、青年人才、商业空间和未来规划，表达效率和机会。', workflowSteps: ['梳理招商优势', '生成产业画面', '加入交通节点', '展示人才场景', '输出招商落版'] },
      { title: '街区更新短纪录', description: '适合城市更新、社区和公共空间项目。', promptStarter: '创建街区更新短纪录：旧街区细节、新空间使用、人群互动和居民声音，语气真实克制。', workflowSteps: ['确认街区变化', '生成旧貌细节', '展示新空间', '加入居民视角', '输出项目说明'] },
    ],
  },
]

export const PUBLIC_TEMPLATE_CATALOG: PublicTemplate[] = CATEGORY_PLANS.flatMap((plan, categoryIndex) => (
  plan.variants.map((variant, variantIndex) => ({
    id: `public-${categoryIndex + 1}-${variantIndex + 1}`,
    title: variant.title,
    category: plan.category,
    description: variant.description,
    promptStarter: variant.promptStarter,
    workflowSteps: variant.workflowSteps,
    nodeType: variant.nodeType ?? plan.nodeType,
    aspectRatio: variant.aspectRatio ?? plan.aspectRatio,
    styleTags: [...plan.styleTags, ...(variant.styleTags ?? [])],
    useCases: [...plan.useCases, ...(variant.useCases ?? [])],
    mediaQuery: buildTemplateMediaQuery(plan, variant),
    sourceType: plan.sourceType ?? (plan.sourceUrl ? 'public-reference' : 'creator-city'),
    sourceUrl: plan.sourceUrl,
    license: plan.sourceUrl ? REFERENCE_ONLY_TEMPLATE_LICENSE : ORIGINAL_TEMPLATE_LICENSE,
    licenseNote: PUBLIC_TEMPLATE_LICENSE_NOTE,
    thumbnail: {
      type: 'gradient',
      gradientFrom: plan.gradientFrom,
      gradientTo: plan.gradientTo,
      alt: `${variant.title} 模板封面占位`,
    },
    preview: {
      type: 'placeholder-video',
      licenseType: 'original',
      attribution: 'Creator City CSS placeholder',
    },
    nodeGraph: buildTemplateNodeGraph({
      title: variant.title,
      category: plan.category,
      description: variant.description,
      promptStarter: variant.promptStarter,
      workflowSteps: variant.workflowSteps,
      nodeType: variant.nodeType ?? plan.nodeType,
      aspectRatio: variant.aspectRatio ?? plan.aspectRatio,
    }),
    isUsable: true,
  }))
))

export const PUBLIC_TEMPLATE_COUNT = PUBLIC_TEMPLATE_CATALOG.length

export function getPublicTemplateById(templateId: string | null | undefined) {
  if (!templateId) return undefined
  return PUBLIC_TEMPLATE_CATALOG.find((template) => template.id === templateId)
}

export function getPublicTemplatesByCategory(category: PublicTemplateCategory) {
  return PUBLIC_TEMPLATE_CATALOG.filter((template) => template.category === category)
}

export const PUBLIC_TEMPLATE_CATEGORY_COUNTS = Object.fromEntries(
  PUBLIC_TEMPLATE_CATEGORIES.map((category) => [
    category,
    PUBLIC_TEMPLATE_CATALOG.filter((template) => template.category === category).length,
  ]),
) as Record<PublicTemplateCategory, number>
