/**
 * Camera Model Database — First Edition
 * Main-stream professional & consumer camera models.
 * Expandable: add entries to CAMERA_DATABASE array; no other changes needed.
 * Does NOT claim to cover all cameras in the world.
 */

export type CameraVisualProfile =
  | 'cinema-box'
  | 'cinema-compact'
  | 'mirrorless'
  | 'phone'
  | 'action-cam'
  | 'drone'
  | 'broadcast'
  | 'camcorder'
  | 'three-sixty'

export interface CameraModelEntry {
  id: string
  brand: string
  model: string
  category: string
  format?: string
  useCase: string
  look: string
  promptDescription: string
  visualProfile: CameraVisualProfile
  directorNote: string
}

export const CAMERA_DATABASE: CameraModelEntry[] = [
  // ─── ARRI ────────────────────────────────────────────────────────────────────
  {
    id: 'arri-alexa-35',
    brand: 'ARRI',
    model: 'Alexa 35',
    category: '旗舰电影机',
    format: '4.6K ALEV 4',
    useCase: '大制作 / 院线',
    look: '超高宽容度 · 电影级质感 · 工业标准',
    promptDescription: 'ARRI Alexa 35 cinema camera — maximum dynamic range, film-like tonal gradation, industry-standard cinematic rendering with rich shadow detail',
    visualProfile: 'cinema-box',
    directorNote: '宽容度最高的电影机，阴影细节丰富，胶片质感标准',
  },
  {
    id: 'arri-alexa-mini-lf',
    brand: 'ARRI',
    model: 'Alexa Mini LF',
    category: '紧凑大画幅电影机',
    format: 'Large Format',
    useCase: '多场景 / 手持 / 航拍',
    look: '大画幅柔和渲染 · 多用途',
    promptDescription: 'ARRI Alexa Mini LF cinema camera — large-format sensor, cinematic softness, versatile for handheld and aerial, beautiful lens rendering',
    visualProfile: 'cinema-compact',
    directorNote: '大画幅 · 轻便 · 吊臂/手持两用',
  },
  {
    id: 'arri-amira',
    brand: 'ARRI',
    model: 'Amira',
    category: '纪录片 / ENG',
    format: '3.4K Super 35',
    useCase: '纪录片 / 新闻 / 采访',
    look: '人文纪实 · 肩扛 · 即时感',
    promptDescription: 'ARRI Amira documentary camera — ergonomic shoulder-mount design, authentic journalistic feel, natural handheld texture, real-world immediacy',
    visualProfile: 'cinema-compact',
    directorNote: '肩扛纪录风格，即时感与现场氛围最强',
  },

  // ─── RED ─────────────────────────────────────────────────────────────────────
  {
    id: 'red-v-raptor-8k',
    brand: 'RED',
    model: 'V-Raptor 8K VV',
    category: '旗舰高分辨率电影机',
    format: '8K Vista Vision',
    useCase: '商业大片 / 特效',
    look: '超高分辨率 · 商业锐利 · 宽银幕级别',
    promptDescription: 'RED V-Raptor 8K VV cinema camera — ultra-high resolution Vista Vision sensor, commercial blockbuster visual quality, razor-sharp wide-screen image',
    visualProfile: 'cinema-box',
    directorNote: '分辨率最高，商业广告和大片特效首选',
  },
  {
    id: 'red-komodo-6k',
    brand: 'RED',
    model: 'Komodo 6K',
    category: '紧凑电影机',
    format: '6K Full Frame',
    useCase: '无人机 / 稳定器 / 多机位',
    look: 'RED 科学 · 紧凑 · 高分辨率',
    promptDescription: 'RED Komodo 6K compact cinema camera — full-frame 6K resolution, RED color science, ideal for drone and gimbal work, cinematic detail in a compact body',
    visualProfile: 'cinema-compact',
    directorNote: '最小的 RED 机身，稳定器与无人机首选',
  },
  {
    id: 'red-monstro-8k',
    brand: 'RED',
    model: 'Monstro 8K VV',
    category: '高端电影机',
    format: '8K Vista Vision',
    useCase: '剧情长片 / 商业制作',
    look: '戏剧性影调 · 高动态 · 有力量',
    promptDescription: 'RED Monstro 8K VV cinema camera — dramatic tonal range, powerful visual weight, rich blacks and high-contrast cinematic image quality',
    visualProfile: 'cinema-box',
    directorNote: '影调最具戏剧张力，高对比黑色最沉厚',
  },

  // ─── Sony ────────────────────────────────────────────────────────────────────
  {
    id: 'sony-venice-2',
    brand: 'Sony',
    model: 'Venice 2',
    category: '高端电影机',
    format: '8.6K Full Frame',
    useCase: '院线 / 流媒体大剧 / 变形宽银幕',
    look: '自然肤色 · 变形镜头兼容 · 行业标准',
    promptDescription: 'Sony Venice 2 cinema camera — natural skin tone rendering, anamorphic lens compatibility, large-format cinematic image with warm filmic character',
    visualProfile: 'cinema-box',
    directorNote: '肤色最准，变形镜头兼容性最好',
  },
  {
    id: 'sony-fx6',
    brand: 'Sony',
    model: 'FX6',
    category: '专业影视摄影机',
    format: '4K Full Frame',
    useCase: '广告 / 文档 / 叙事电影',
    look: '全画幅柔和 · 高感光度 · 多用途',
    promptDescription: 'Sony FX6 cinema camera — full-frame sensor with excellent low light, versatile cinematic look suitable for documentary, narrative, and commercial work',
    visualProfile: 'cinema-compact',
    directorNote: '高感光度夜拍能力强，全画幅广告纪录两用',
  },
  {
    id: 'sony-fx3',
    brand: 'Sony',
    model: 'FX3',
    category: '紧凑影视摄影机',
    format: '4K Full Frame',
    useCase: '独立电影 / 内容创作 / 音乐录影',
    look: '紧凑全画幅 · 低光出色 · 现代电影感',
    promptDescription: 'Sony FX3 compact cinema camera — full-frame sensor in a small body, clean cinematic image, popular for indie films, music videos, and solo content creators',
    visualProfile: 'mirrorless',
    directorNote: '最小的全画幅电影机，独立制片人主力',
  },
  {
    id: 'sony-a7s3',
    brand: 'Sony',
    model: 'A7S III',
    category: '全画幅无反',
    format: '12.1MP Full Frame',
    useCase: '夜拍 / 活动 / 自然纪录',
    look: '极低噪点 · 现实主义 · 暗环境质感',
    promptDescription: 'Sony A7S III mirrorless camera — extreme low-light sensitivity, minimal noise in darkness, documentary realism, natural ambient light capture',
    visualProfile: 'mirrorless',
    directorNote: '弱光极限使用，暗部细节保留最多',
  },

  // ─── Canon ───────────────────────────────────────────────────────────────────
  {
    id: 'canon-c70',
    brand: 'Canon',
    model: 'C70',
    category: '紧凑电影机',
    format: '4K Super 35',
    useCase: '独立电影 / 内容创作',
    look: 'Canon 暖调 · 柔和 · 自然',
    promptDescription: 'Canon C70 compact cinema camera — Canon color science with warm natural tones, Super 35 cinematic look, popular for indie narrative and content creation',
    visualProfile: 'cinema-compact',
    directorNote: 'Canon 温暖自然色彩，独立叙事首选',
  },
  {
    id: 'canon-c300-mk3',
    brand: 'Canon',
    model: 'C300 Mark III',
    category: '专业电影机',
    format: '4K Super 35 / Full Frame',
    useCase: '广告 / 纪录片 / 剧情片',
    look: '专业级电影感 · Canon 色彩科学 · 精准还原',
    promptDescription: 'Canon C300 Mark III professional cinema camera — dual gain output sensor, cinematic Canon color science, clean broadcast and film look for professional productions',
    visualProfile: 'cinema-compact',
    directorNote: '专业电影品质，Canon 双增益宽容度宽',
  },
  {
    id: 'canon-r5c',
    brand: 'Canon',
    model: 'EOS R5 C',
    category: '混合全画幅无反',
    format: '8K Full Frame',
    useCase: '8K电影 / 高端摄影与影像一体',
    look: '8K高分辨率 · Canon 色彩 · 双模式',
    promptDescription: 'Canon EOS R5 C hybrid camera — 8K RAW cinema capability with full-frame Canon color, stills and cinema dual mode, ultra-high detail image quality',
    visualProfile: 'mirrorless',
    directorNote: '8K RAW 拍摄，静态与影视兼备',
  },

  // ─── Blackmagic ──────────────────────────────────────────────────────────────
  {
    id: 'bmd-ursa-mini-pro-12k',
    brand: 'Blackmagic',
    model: 'URSA Mini Pro 12K',
    category: '高分辨率电影机',
    format: '12K Super 35',
    useCase: '商业 / 独立电影 / VFX',
    look: '自然有机质感 · 超高分辨率 · 后期空间大',
    promptDescription: 'Blackmagic URSA Mini Pro 12K cinema camera — organic natural image texture, 12K resolution for extensive post-production latitude, raw cinematic rendering',
    visualProfile: 'cinema-box',
    directorNote: '12K 分辨率，后期调色空间最充裕',
  },
  {
    id: 'bmd-pocket-6k-pro',
    brand: 'Blackmagic',
    model: 'Pocket Cinema 6K Pro',
    category: '口袋电影机',
    format: '6K Super 35',
    useCase: '独立电影 / 学生作品 / 低成本制作',
    look: 'BMD 有机质感 · 柔和 · 胶片风格',
    promptDescription: 'Blackmagic Pocket Cinema 6K Pro — organic film-like texture, indie movie character, soft natural rendering with Blackmagic raw color science',
    visualProfile: 'mirrorless',
    directorNote: '独立电影质感，有机胶片色调，后期友好',
  },
  {
    id: 'bmd-cinema-6k',
    brand: 'Blackmagic',
    model: 'Cinema Camera 6K',
    category: '独立电影机',
    format: '6K Full Frame',
    useCase: '叙事电影 / 音乐录影',
    look: '新型全画幅 BMD 质感 · 现代电影感',
    promptDescription: 'Blackmagic Cinema Camera 6K full-frame — modern cinematic image with Blackmagic color science, full-frame natural rendering, versatile narrative film look',
    visualProfile: 'cinema-compact',
    directorNote: '新一代 BMD 全画幅，叙事电影现代感强',
  },

  // ─── Panasonic ───────────────────────────────────────────────────────────────
  {
    id: 'panasonic-s5iix',
    brand: 'Panasonic',
    model: 'Lumix S5IIX',
    category: '全画幅无反',
    format: '6K Full Frame',
    useCase: '流媒体 / 混合拍摄 / 创作者',
    look: '自然温润 · 全画幅 · 直播友好',
    promptDescription: 'Panasonic Lumix S5IIX mirrorless camera — full-frame natural rendering, warm tonal quality, hybrid photo-video with excellent color science for content creators',
    visualProfile: 'mirrorless',
    directorNote: '创作者全能机，色彩自然温润',
  },
  {
    id: 'panasonic-gh6',
    brand: 'Panasonic',
    model: 'GH6',
    category: 'M43 专业影视无反',
    format: '5.7K Micro Four Thirds',
    useCase: '多用途 / 预算制作',
    look: 'M43 紧凑 · 高帧率 · 轻便',
    promptDescription: 'Panasonic GH6 mirrorless camera — Micro Four Thirds high-frame-rate video, versatile cinematic quality in a compact body, ideal for run-and-gun filmmaking',
    visualProfile: 'mirrorless',
    directorNote: '轻便高帧率，跑拍和游击拍摄利器',
  },
  {
    id: 'panasonic-eva1',
    brand: 'Panasonic',
    model: 'AU-EVA1',
    category: '紧凑电影机',
    format: '5.7K Super 35',
    useCase: '纪录片 / 多机位 / 独立电影',
    look: '小型电影质感 · 紧凑 · EF 卡口',
    promptDescription: 'Panasonic AU-EVA1 compact cinema camera — Super 35 cinematic image in a mini body, documentary and narrative versatility, filmic color rendition',
    visualProfile: 'cinema-compact',
    directorNote: '最小 Super 35 电影机，多机位和纪录首选',
  },

  // ─── DJI ─────────────────────────────────────────────────────────────────────
  {
    id: 'dji-ronin-4d',
    brand: 'DJI',
    model: 'Ronin 4D',
    category: '一体化稳定电影系统',
    format: '8K Full Frame / 6K Super 35',
    useCase: '稳定 / 单人拍摄 / 商业',
    look: '超稳定电影感 · 无抖动 · 专业质感',
    promptDescription: 'DJI Ronin 4D integrated cinema camera system — stabilized cinematic image, smooth motion with professional full-frame quality, single-operator film production',
    visualProfile: 'cinema-box',
    directorNote: '自稳定电影系统，单人无人机风格稳定镜头',
  },
  {
    id: 'dji-inspire-3-x9',
    brand: 'DJI',
    model: 'Inspire 3 X9',
    category: '航拍电影无人机',
    format: '8K Full Frame',
    useCase: '航拍 / 鸟瞰 / 空中叙事',
    look: '航拍俯瞰 · 宏大 · 大地视角',
    promptDescription: 'DJI Inspire 3 aerial cinema camera — bird\'s eye view perspective, majestic aerial cinematography, sweeping landscape shots from above with full-frame quality',
    visualProfile: 'drone',
    directorNote: '上帝视角 · 宏大叙事 · 航拍标准',
  },
  {
    id: 'dji-pocket-3',
    brand: 'DJI',
    model: 'Osmo Pocket 3',
    category: '口袋云台摄像机',
    format: '4K 1-inch Sensor',
    useCase: '旅拍 / Vlog / 随手记录',
    look: '极致便携 · 稳定 · 随拍随走',
    promptDescription: 'DJI Osmo Pocket 3 — ultra-portable 1-inch sensor gimbal camera, smooth cinematic movement, travel and vlog spontaneous cinematography, natural everyday moments',
    visualProfile: 'action-cam',
    directorNote: '最小电影级稳定器，旅行随拍的终极选择',
  },

  // ─── iPhone ──────────────────────────────────────────────────────────────────
  {
    id: 'iphone-15-pro-cinematic',
    brand: 'Apple',
    model: 'iPhone 15 Pro',
    category: '手机电影模式',
    format: '4K ProRes / Cinematic Mode',
    useCase: '手机创作 / 纪录 / Cinematic 模式',
    look: '日常现实感 · 浅景深 · 手持纪录',
    promptDescription: 'Apple iPhone 15 Pro Cinematic mode — handheld naturalistic style, shallow depth of field with subject tracking, intimate documentary realism, everyday life cinematics',
    visualProfile: 'phone',
    directorNote: '手机 Cinematic 模式，日常纪录最真实',
  },
  {
    id: 'iphone-16-pro-cinematic',
    brand: 'Apple',
    model: 'iPhone 16 Pro',
    category: '手机电影模式',
    format: '4K 120fps ProRes / Apple Log',
    useCase: '手机高帧率 / Vlog / 短片',
    look: '4K 120fps · Apple Log 宽容度 · 即时感',
    promptDescription: 'Apple iPhone 16 Pro — 4K 120fps Apple Log cinema quality, high-frame-rate emotion, spontaneous handheld documentary with advanced computational photography',
    visualProfile: 'phone',
    directorNote: '4K 120fps 高帧率 · 手机最强电影模式',
  },

  // ─── GoPro ───────────────────────────────────────────────────────────────────
  {
    id: 'gopro-hero12',
    brand: 'GoPro',
    model: 'HERO12 Black',
    category: '运动摄像机',
    format: '5.3K Wide',
    useCase: '极限运动 / 水下 / POV',
    look: '沉浸式 POV · 超广角 · 动感',
    promptDescription: 'GoPro HERO12 Black action camera — immersive first-person POV perspective, ultra-wide angle distortion, extreme sport energy, waterproof kinetic documentary',
    visualProfile: 'action-cam',
    directorNote: '第一人称沉浸感，极限动感 POV 视角',
  },

  // ─── Insta360 ────────────────────────────────────────────────────────────────
  {
    id: 'insta360-x4',
    brand: 'Insta360',
    model: 'X4',
    category: '360° 全景摄像机',
    format: '8K 360°',
    useCase: 'VR / 全景体验 / 沉浸式',
    look: '360° 沉浸 · 无死角 · VR 视角',
    promptDescription: 'Insta360 X4 360-degree camera — fully immersive spherical perspective, invisible camera placement, VR-ready omnidirectional capture, spatial storytelling',
    visualProfile: 'three-sixty',
    directorNote: '360° 全视野，VR 沉浸感无与伦比',
  },
  {
    id: 'insta360-one-rs-1inch',
    brand: 'Insta360',
    model: 'ONE RS 1-Inch 360',
    category: '大底 360° 摄像机',
    format: '6K 1-inch 360°',
    useCase: '高画质全景 / 商业 VR / 沉浸式叙事',
    look: '1 英寸大底全景 · 高画质沉浸 · 低噪',
    promptDescription: 'Insta360 ONE RS 1-Inch 360 — large-sensor 360-degree capture with cinematic quality, low-noise spherical image, ideal for premium immersive storytelling and commercial VR',
    visualProfile: 'three-sixty',
    directorNote: '大底全景最高画质，商业 VR 首选',
  },

  // ─── Broadcast ───────────────────────────────────────────────────────────────
  {
    id: 'sony-pxw-fx9',
    brand: 'Sony',
    model: 'PXW-FX9',
    category: '全画幅广播电影混合机',
    format: '6K Full Frame',
    useCase: '广播 / 活动 / 新闻 / 纪录',
    look: '全画幅广播级 · 高速自动 · 多用途',
    promptDescription: 'Sony PXW-FX9 broadcast cinema hybrid camera — full-frame broadcast quality, fast autofocus, professional news and documentary aesthetics with cinematic depth of field',
    visualProfile: 'broadcast',
    directorNote: '广播电影两用，新闻纪录专业级',
  },
  {
    id: 'canon-xf605',
    brand: 'Canon',
    model: 'XF605',
    category: '专业广播便携机',
    format: '4K UHD',
    useCase: '新闻采集 / 活动直播 / ENG',
    look: 'ENG 广播风格 · 肩扛 · 新闻现场感',
    promptDescription: 'Canon XF605 professional broadcast camcorder — ENG broadcast aesthetic, shoulder-mount journalism style, live event and news production visual identity',
    visualProfile: 'camcorder',
    directorNote: '专业广播肩扛机，ENG 新闻现场感最强',
  },
]

/**
 * Returns the camera body label (model name) for display.
 * Falls back to the raw id if not found.
 */
export function getCameraModelLabel(id: string): string {
  const entry = CAMERA_DATABASE.find((m) => m.id === id)
  if (entry) return entry.model
  return id || '摄影机'
}

/**
 * Returns the visual profile for the given camera id.
 * Falls back to 'cinema-compact' for unknown or legacy values.
 */
export function getCameraVisualProfile(id: string): CameraVisualProfile {
  return CAMERA_DATABASE.find((m) => m.id === id)?.visualProfile ?? 'cinema-compact'
}

/**
 * Returns the prompt description for the given camera id.
 * Falls back to the raw id string for backward compat with old localStorage keys.
 */
export function getCameraPromptDescription(id: string): string {
  const entry = CAMERA_DATABASE.find((m) => m.id === id)
  if (entry) return `${entry.brand} ${entry.model} — ${entry.promptDescription}`
  // Legacy: old values like 'ARRI Alexa 35' stored as display names
  return id
}
