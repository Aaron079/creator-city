import type { ShotType, CameraMovement, DirectorStyle, Lighting, Color, Rhythm } from './types'

type Preset = {
  label: string
  positives: string[]
  negatives: string[]
}

export const SHOT_TYPE_PRESETS: Record<ShotType, Preset> = {
  'wide': {
    label: '远景',
    positives: ['wide shot', 'establishing shot', 'full environment visible', 'subject small in frame', 'expansive scene'],
    negatives: ['close-up', 'extreme close-up', 'portrait cropping'],
  },
  'medium': {
    label: '中景',
    positives: ['medium shot', 'waist-up framing', 'balanced subject and environment', 'conversational distance'],
    negatives: ['extreme close-up', 'full wide landscape'],
  },
  'close': {
    label: '近景',
    positives: ['close shot', 'subject fills frame', 'shallow depth of field', 'detailed expression', 'face and shoulders'],
    negatives: ['wide establishing shot', 'full body visible', 'deep depth of field'],
  },
  'extreme-close': {
    label: '特写',
    positives: ['extreme close-up', 'ECU', 'facial detail', 'eyes in sharp focus', 'skin texture visible', 'intense emotion'],
    negatives: ['wide shot', 'full body', 'establishing shot', 'background in focus'],
  },
}

export const CAMERA_MOVEMENT_PRESETS: Record<CameraMovement, Preset> = {
  'push-in': {
    label: '推镜',
    positives: ['slow push-in', 'camera moves toward subject', 'tightening frame', 'building tension', 'zoom-in effect'],
    negatives: ['static camera', 'pull-out', 'camera retreats'],
  },
  'pull-out': {
    label: '拉镜',
    positives: ['pull-out shot', 'camera retreats from subject', 'revealing environment', 'expanding scale', 'zoom-out effect'],
    negatives: ['static camera', 'push-in', 'tightening frame'],
  },
  'pan': {
    label: '摇镜',
    positives: ['pan shot', 'camera sweeps horizontally', 'lateral camera rotation', 'scanning movement'],
    negatives: ['static camera', 'no movement', 'locked off'],
  },
  'dolly': {
    label: '移镜',
    positives: ['dolly shot', 'lateral dolly movement', 'cinematic lateral tracking', 'smooth sideways motion'],
    negatives: ['static camera', 'handheld shake', 'rotational pan'],
  },
  'tracking': {
    label: '跟拍',
    positives: ['tracking shot', 'camera follows subject', 'dynamic motion follow', 'subject-locked movement', 'handheld energy'],
    negatives: ['static camera', 'locked off', 'stationary frame'],
  },
  'overhead': {
    label: '俯拍',
    positives: ['overhead shot', 'top-down composition', 'bird\'s eye view', 'god-view angle', 'aerial perspective'],
    negatives: ['eye-level shot', 'worm\'s eye view', 'low angle'],
  },
}

export const STYLE_PRESETS: Record<DirectorStyle, Preset> = {
  'cinematic': {
    label: '电影感',
    positives: ['cinematic lighting', 'film still aesthetic', 'anamorphic lens feel', 'dramatic composition', 'movie quality', 'cinematic color grade', '2.39:1 aspect ratio feel'],
    negatives: ['snapshot', 'phone camera', 'flat lighting', 'amateur look'],
  },
  'commercial': {
    label: '广告感',
    positives: ['clean commercial lighting', 'premium product visual', 'polished finish', 'high-end brand aesthetic', 'studio quality', 'aspirational mood'],
    negatives: ['gritty', 'rough texture', 'dark mood', 'handheld rough'],
  },
  'short-drama': {
    label: '短剧',
    positives: ['vertical drama framing', 'emotional tension', 'direct storytelling', 'close intimate composition', 'dramatic beats'],
    negatives: ['wide landscape', 'slow pacing', 'abstract'],
  },
  'manhua': {
    label: '漫剧',
    positives: ['manhua-inspired composition', 'comic panel energy', 'stylized drama', 'bold graphic composition', 'manga aesthetic', 'ink line quality'],
    negatives: ['photorealistic', 'muted palette', 'subtle tones'],
  },
  'realistic': {
    label: '写实',
    positives: ['photorealistic', 'natural textures', 'believable lighting', 'documentary feel', 'true-to-life colors', 'authentic detail'],
    negatives: ['stylized', 'fantasy elements', 'oversaturated', 'comic style'],
  },
  'fantasy': {
    label: '幻想',
    positives: ['fantasy atmosphere', 'magical realism', 'epic worldbuilding', 'otherworldly environment', 'ethereal lighting', 'surreal elements'],
    negatives: ['mundane', 'ordinary setting', 'flat lighting', 'realistic only'],
  },
}

export const LIGHTING_PRESETS: Record<Lighting, Preset> = {
  'backlight': {
    label: '逆光',
    positives: ['backlit', 'rim lighting', 'glowing outline', 'silhouette against bright background', 'hair light', 'golden backlight haze'],
    negatives: ['flat front lighting', 'no rim light'],
  },
  'rembrandt': {
    label: '伦勃朗光',
    positives: ['Rembrandt lighting', 'triangular cheek highlight', 'dramatic shadow', 'one side lit', 'classical portrait lighting', 'chiaroscuro'],
    negatives: ['flat lighting', 'even illumination', 'studio softbox only'],
  },
  'neon': {
    label: '霓虹',
    positives: ['neon lighting', 'cyberpunk glow', 'saturated night color', 'neon sign reflections', 'colorful ambient light', 'urban night atmosphere'],
    negatives: ['natural daylight', 'desaturated', 'monochrome'],
  },
  'natural': {
    label: '自然光',
    positives: ['natural daylight', 'soft realistic illumination', 'golden hour light', 'window light', 'ambient outdoor lighting'],
    negatives: ['studio light', 'artificial neon', 'harsh spotlight'],
  },
}

export const COLOR_PRESETS: Record<Color, Preset> = {
  'cool': {
    label: '冷色',
    positives: ['cool color palette', 'blue tones', 'restrained mood', 'cold color grade', 'steel blue atmosphere', 'cool shadows'],
    negatives: ['warm amber tones', 'orange grade', 'warm palette'],
  },
  'warm': {
    label: '暖色',
    positives: ['warm color palette', 'amber tones', 'emotional warmth', 'golden grade', 'warm candlelight feel', 'orange-yellow hues'],
    negatives: ['cool blue tones', 'cold grade', 'desaturated'],
  },
  'high-contrast': {
    label: '高对比',
    positives: ['high contrast', 'deep crushed blacks', 'bright highlights', 'dramatic tonal range', 'bold shadows', 'punchy contrast'],
    negatives: ['low contrast', 'flat tones', 'lifted shadows'],
  },
  'low-saturation': {
    label: '低饱和',
    positives: ['low saturation', 'muted color palette', 'restrained cinematic grade', 'desaturated tones', 'bleach bypass look'],
    negatives: ['vivid saturated colors', 'vibrant palette', 'oversaturated'],
  },
}

export const RHYTHM_PRESETS: Record<Rhythm, Preset> = {
  'slow-motion': {
    label: '慢动作',
    positives: ['slow motion', 'graceful suspended movement', 'time-stretched action', 'smooth slow-mo', 'dreamy pacing'],
    negatives: ['fast paced', 'rapid cuts', 'energetic motion'],
  },
  'fast-paced': {
    label: '快节奏',
    positives: ['fast-paced action', 'energetic motion', 'rapid visual rhythm', 'dynamic energy', 'high tempo'],
    negatives: ['slow motion', 'leisurely pacing', 'static'],
  },
  'stable-shot': {
    label: '稳定镜头',
    positives: ['stable camera', 'smooth movement', 'steady cam', 'no shaky cam', 'locked smooth motion', 'gimbal stability'],
    negatives: ['handheld shake', 'jitter', 'unstable camera'],
  },
}

export const CONTROL_GROUP_LABELS = {
  shotType: '镜头类型',
  cameraMovement: '镜头运动',
  style: '风格',
  lighting: '光线',
  color: '色彩',
  rhythm: '节奏',
} as const

export const CONTROL_GROUP_TOOLTIPS: Record<string, string> = {
  wide: '远景：展示宏观环境，人物占比小，体现空间关系',
  medium: '中景：腰部以上构图，人与环境平衡',
  close: '近景：脸部和肩部，浅景深，表情细节丰富',
  'extreme-close': '特写：极近距离，眼神、皮肤纹理、极强情绪',
  'push-in': '推镜：镜头缓缓推近，增加紧张感',
  'pull-out': '拉镜：镜头后退，揭示更大环境',
  pan: '摇镜：横向扫视，跟随动作或展示场景',
  dolly: '移镜：侧向平移，电影感横向运动',
  tracking: '跟拍：跟随主体移动，动感强',
  overhead: '俯拍：从正上方俯视，上帝视角',
  cinematic: '电影感：强戏剧感打光、变形镜头感、电影色调',
  commercial: '广告感：干净精致、高端品牌感、完美光线',
  'short-drama': '短剧：竖屏情感张力、直接叙事、亲密构图',
  manhua: '漫剧：漫画格式感、风格化戏剧、线条感',
  realistic: '写实：照片级真实、可信打光、自然材质',
  fantasy: '幻想：奇幻氛围、史诗世界观、超现实元素',
  backlight: '逆光：轮廓发光、金色光晕、剪影感',
  rembrandt: '伦勃朗光：经典三角高光、强阴影、戏剧感',
  neon: '霓虹：赛博朋克光、夜晚城市色彩',
  natural: '自然光：户外柔光、黄金时刻、窗口光',
  cool: '冷色：蓝调、克制氛围',
  warm: '暖色：琥珀金调、情感温暖',
  'high-contrast': '高对比：黑色深沉、高光明亮、戏剧性层次',
  'low-saturation': '低饱和：去色、内敛电影调色',
  'slow-motion': '慢动作：动作悬停、优雅流畅',
  'fast-paced': '快节奏：动感、高能量、快速节奏',
  'stable-shot': '稳定镜头：无抖动、稳定器质感、平滑移动',
}
