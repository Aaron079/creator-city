import type { ShotType, CameraMovement, DirectorStyle, Lighting, Color, Rhythm, CameraBody, LensType, FocalLength, Aperture } from './types'

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

export const CAMERA_BODY_PRESETS: Record<CameraBody, Preset> = {
  'cinema': {
    label: '电影机',
    positives: ['large format cinema camera', 'film-grade sensor quality', 'anamorphic optics character', 'ARRI or RED equivalent', 'cinema-grade image rendition'],
    negatives: ['consumer camera', 'phone camera', 'amateur gear'],
  },
  'handheld': {
    label: '手持',
    positives: ['handheld camera feel', 'organic camera movement', 'documentary energy', 'intimate handheld framing', 'natural camera breathing'],
    negatives: ['locked-off tripod', 'perfect stability', 'sterile camera motion'],
  },
  'drone': {
    label: '无人机',
    positives: ['aerial drone shot', 'UAV perspective', 'stabilized aerial movement', 'sweeping aerial vista', 'elevated bird-eye angle'],
    negatives: ['ground level', 'eye-level shot', 'low angle'],
  },
  'studio': {
    label: '摄影棚',
    positives: ['studio camera setup', 'controlled studio environment', 'precision studio lighting', 'commercial studio aesthetic', 'clean studio background'],
    negatives: ['outdoor location', 'natural environment', 'documentary rough'],
  },
}

export const LENS_TYPE_PRESETS: Record<LensType, Preset> = {
  'wide-angle': {
    label: '广角',
    positives: ['wide-angle lens', 'exaggerated perspective', 'environmental context', 'expanded field of view', 'distorted foreground depth'],
    negatives: ['telephoto compression', 'narrow field of view', 'background isolation'],
  },
  'standard': {
    label: '标准',
    positives: ['standard lens', 'natural perspective', '50mm equivalent focal length', 'true-to-eye field of view', 'neutral perspective rendition'],
    negatives: ['distorted wide angle', 'telephoto compression'],
  },
  'telephoto': {
    label: '长焦',
    positives: ['telephoto lens', 'compressed perspective', 'subject isolation', 'background bokeh', 'telephoto reach', 'shallow depth of field'],
    negatives: ['wide-angle distortion', 'expanded field of view', 'environmental context'],
  },
  'macro': {
    label: '微距',
    positives: ['macro lens', 'extreme close-up detail', 'razor-thin depth of field', 'micro texture visible', 'magnified subject detail'],
    negatives: ['wide shot', 'environmental context', 'deep depth of field'],
  },
}

export const FOCAL_LENGTH_PRESETS: Record<FocalLength, Preset> = {
  '14mm': {
    label: '14mm',
    positives: ['14mm ultra-wide lens', 'extreme environmental context', 'maximum field of view', 'ultra-wide perspective'],
    negatives: ['telephoto reach', 'compressed perspective'],
  },
  '24mm': {
    label: '24mm',
    positives: ['24mm wide lens', 'environmental storytelling', 'minimal distortion wide', 'reportage wide angle'],
    negatives: ['telephoto compression', 'narrow focus'],
  },
  '35mm': {
    label: '35mm',
    positives: ['35mm lens', 'classic cinema focal length', 'natural wide perspective', 'street photography feel'],
    negatives: ['telephoto compression', 'extreme wide distortion'],
  },
  '50mm': {
    label: '50mm',
    positives: ['50mm standard lens', 'true-to-eye perspective', 'neutral natural look', 'classic portrait distance'],
    negatives: ['distorted wide angle', 'telephoto reach'],
  },
  '85mm': {
    label: '85mm',
    positives: ['85mm portrait lens', 'flattering facial compression', 'beautiful background separation', 'classic portrait focal length'],
    negatives: ['wide environmental context', 'distorted perspective'],
  },
  '135mm': {
    label: '135mm',
    positives: ['135mm telephoto lens', 'extreme background compression', 'dream-like bokeh', 'subject lifted from background'],
    negatives: ['wide environmental context', 'minimal compression'],
  },
}

export const APERTURE_PRESETS: Record<Aperture, Preset> = {
  'f1.4': {
    label: 'f/1.4',
    positives: ['f/1.4 wide aperture', 'razor-thin depth of field', 'extreme bokeh', 'dreamy lens character', 'maximum light gathering'],
    negatives: ['deep depth of field', 'everything in focus', 'closed aperture'],
  },
  'f2.8': {
    label: 'f/2.8',
    positives: ['f/2.8 aperture', 'shallow depth of field', 'beautiful background separation', 'creamy bokeh', 'cinematic subject isolation'],
    negatives: ['deep depth of field', 'landscape sharpness'],
  },
  'f4': {
    label: 'f/4',
    positives: ['f/4 aperture', 'moderate depth of field', 'balanced sharpness and bokeh', 'versatile exposure'],
    negatives: ['extreme bokeh', 'fully deep focus'],
  },
  'f8': {
    label: 'f/8',
    positives: ['f/8 aperture', 'deep depth of field', 'landscape sharpness', 'foreground to background in focus'],
    negatives: ['shallow bokeh', 'subject isolation', 'dreamy soft focus'],
  },
  'f11': {
    label: 'f/11',
    positives: ['f/11 aperture', 'maximum depth of field', 'everything in sharp focus', 'landscape and architecture photography style', 'diffraction-limited sharpness'],
    negatives: ['bokeh', 'shallow depth', 'subject isolation', 'dreamy lens character'],
  },
}

export const CONTROL_GROUP_LABELS = {
  shotType: '镜头类型',
  cameraMovement: '镜头运动',
  style: '风格',
  lighting: '光线',
  color: '色彩',
  rhythm: '节奏',
  cameraBody: '机身',
  lensType: '镜头',
  focalLength: '焦距',
  aperture: '光圈',
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
  cinema: '电影机：大底电影传感器、变形镜头质感、院线级画质',
  handheld: '手持：有机摄影机运动、纪录片质感、亲密感',
  drone: '无人机：航拍视角、稳定空中运动、俯瞰全景',
  studio: '摄影棚：精准布光、商业级画质、受控环境',
  'wide-angle': '广角：夸张透视、宽阔视野、环境感强',
  standard: '标准：自然视角、50mm等效、接近人眼',
  telephoto: '长焦：压缩透视、背景虚化、主体隔离',
  macro: '微距：极近细节、极浅景深、材质纹理可见',
  '14mm': '14mm超广：最大视野、建筑/风景常用',
  '24mm': '24mm广角：纪实摄影、轻微畸变',
  '35mm': '35mm：经典电影焦距、自然视角略宽',
  '50mm': '50mm：人眼视角、最自然透视',
  '85mm': '85mm：人像首选、背景漂亮分离',
  '135mm': '135mm：极致压缩、梦幻虚化、主体飘离背景',
  'f1.4': 'f/1.4：极浅景深、虚化极强、追求电影梦幻感',
  'f2.8': 'f/2.8：浅景深、背景美丽分离、电影感',
  f4: 'f/4：适中景深、虚化与清晰平衡',
  f8: 'f/8：大景深、前后都清晰、风景常用',
  f11: 'f/11：最大景深、一切锐利，建筑/风景摄影风格',
}
