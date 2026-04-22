import type { ProjectTemplate } from '@/lib/templates'
import type { CharacterBible, Narrative, RoleBible, Shot, StoryboardFrame, StoryboardPrevis, StyleBible } from '@/store/shots.store'

type GeneratePrevisInput = {
  sourceType: 'prompt' | 'image'
  sourcePrompt?: string
  sourceImageUrl?: string
  duration: number
  frameCount: number
  frameStyle: 'comic' | 'storyboard' | 'cinematic'
  aspectRatio: '16:9' | '9:16' | '1:1'
  narrative: Narrative | null
  shots: Shot[]
  currentShot?: Shot
  projectTemplate?: ProjectTemplate
  lockedRoleBible?: RoleBible | null
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function buildFramePlaceholder(args: {
  title: string
  subtitle: string
  accent: string
  aspectRatio: '16:9' | '9:16' | '1:1'
}) {
  const sizeMap = {
    '16:9': { width: 960, height: 540 },
    '9:16': { width: 540, height: 960 },
    '1:1': { width: 720, height: 720 },
  } as const
  const size = sizeMap[args.aspectRatio]
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0b1220"/>
          <stop offset="100%" stop-color="#182233"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect x="28" y="28" width="${size.width - 56}" height="${size.height - 56}" rx="26" fill="none" stroke="rgba(255,255,255,0.14)"/>
      <text x="56" y="${size.height / 2 - 12}" fill="${args.accent}" font-size="34" font-family="Arial, sans-serif" font-weight="700">${args.title}</text>
      <text x="56" y="${size.height / 2 + 36}" fill="rgba(255,255,255,0.55)" font-size="22" font-family="Arial, sans-serif">${args.subtitle}</text>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function formatTimecode(seconds: number) {
  const whole = Math.max(0, Math.round(seconds))
  return `${whole}s`
}

export function buildCharacterBible(args: {
  currentShot?: Shot
  sourceImageUrl?: string
  lockedRoleBible?: RoleBible | null
}): CharacterBible {
  const { currentShot, sourceImageUrl, lockedRoleBible } = args
  const idea = currentShot?.idea || '主角'
  if (lockedRoleBible) {
    return {
      id: lockedRoleBible.id,
      name: lockedRoleBible.name,
      faceReference: lockedRoleBible.referenceImageUrl ?? sourceImageUrl,
      wardrobe: lockedRoleBible.appearance.wardrobe,
      hair: lockedRoleBible.appearance.hair,
      bodyType: lockedRoleBible.appearance.bodyType,
      visualTags: lockedRoleBible.appearance.visualTags,
      consistencyKey: lockedRoleBible.consistencyKey,
    }
  }
  return {
    id: uid('char'),
    name: idea.slice(0, 12) || '主角',
    faceReference: sourceImageUrl,
    wardrobe: '保持与主镜头一致的服装轮廓与材质层次',
    hair: '维持同一发型方向与整体轮廓',
    bodyType: '中性偏修长',
    visualTags: [currentShot?.style ?? '商业广告', currentShot?.intent ?? '建立环境', 'consistency-first'],
    consistencyKey: `face:${idea.slice(0, 8)}|style:${currentShot?.style ?? 'base'}|intent:${currentShot?.intent ?? 'base'}`,
  }
}

export function buildStyleBible(args: {
  currentShot?: Shot
  projectTemplate?: ProjectTemplate
}): StyleBible {
  const { currentShot, projectTemplate } = args
  return {
    id: uid('style'),
    name: projectTemplate?.name ?? currentShot?.style ?? 'Default Visual System',
    colorGrade: currentShot?.presetParams?.colorLUT ?? 'Cinematic',
    lighting: currentShot?.presetParams?.lightingType ?? 'Natural',
    cameraSignature: [currentShot?.cameraBrand, currentShot?.cameraModel].filter(Boolean).join(' ') || undefined,
    lensSignature: [currentShot?.lensBrand, currentShot?.lensModel].filter(Boolean).join(' ') || undefined,
    texture: projectTemplate?.recommendedStyle === '电影感' ? 'soft grain' : 'clean commercial contrast',
    promptPrefix: `${projectTemplate?.recommendedStyle ?? currentShot?.style ?? '商业广告'} visual language, maintain continuity, same hero subject, same wardrobe, same atmosphere`,
  }
}

function buildFrameBlueprints(duration: number, frameCount: number) {
  const defaults = [
    { label: 'opening frame', intent: '建立环境' },
    { label: 'character entrance', intent: '强调角色' },
    { label: 'emotional close-up', intent: '推进情绪' },
    { label: 'action / conflict', intent: '制造冲突' },
    { label: 'visual peak', intent: '品牌展示' },
    { label: 'transition', intent: '推进情绪' },
    { label: 'end frame', intent: '品牌展示' },
    { label: 'hold ending', intent: '推进情绪' },
    { label: 'secondary beat', intent: '产品特写' },
    { label: 'final lock-up', intent: '品牌展示' },
  ]

  return Array.from({ length: frameCount }, (_, index) => {
    const second = Math.min(duration, Math.round((duration / Math.max(frameCount - 1, 1)) * index))
    const base = defaults[index] ?? defaults[defaults.length - 1]!
    return { second, ...base }
  })
}

export function regenerateStoryboardFrame(args: {
  frame: StoryboardFrame
  styleBible: StyleBible
  frameStyle: StoryboardPrevis['frameStyle']
  aspectRatio: StoryboardPrevis['aspectRatio']
}): StoryboardFrame {
  const { frame, styleBible, frameStyle, aspectRatio } = args
  return {
    ...frame,
    status: 'draft',
    imagePrompt: `${frame.imagePrompt}. Refresh variation with the same subject consistency, ${styleBible.promptPrefix}, ${frameStyle} frame treatment.`,
    imageUrl: buildFramePlaceholder({
      title: frame.timecode,
      subtitle: frame.description,
      accent: frame.status === 'selected' ? '#34d399' : '#c7d2fe',
      aspectRatio,
    }),
  }
}

export function generateStoryboardPrevis(input: GeneratePrevisInput): {
  previs: StoryboardPrevis
  characterBible: CharacterBible
  styleBible: StyleBible
} {
  const { sourceType, sourcePrompt, sourceImageUrl, duration, frameCount, frameStyle, aspectRatio, narrative, shots, currentShot, projectTemplate, lockedRoleBible } = input
  const activeShot = currentShot ?? shots[0]
  const characterBible = buildCharacterBible({ currentShot: activeShot, sourceImageUrl, lockedRoleBible })
  const styleBible = buildStyleBible({ currentShot: activeShot, projectTemplate })
  const blueprints = buildFrameBlueprints(duration, frameCount)

  const frames: StoryboardFrame[] = blueprints.map((blueprint, index) => {
    const sourceShot = shots[index % Math.max(shots.length, 1)] ?? activeShot
    const sequence = narrative?.sequences.find((item) => item.id === sourceShot?.sequenceId)
    const shotType = sourceShot?.presetParams?.framing ?? 'MS'
    const angle = sourceShot?.presetParams?.angle ?? 'Eye Level'
    const movement = sourceShot?.presetParams?.movement ?? 'Static'
    const focalLength = sourceShot?.presetParams?.focalLength ?? 35
    const lighting = sourceShot?.presetParams?.lightingType ?? 'Natural'
    const colorGrade = sourceShot?.presetParams?.colorLUT ?? styleBible.colorGrade
    const description = `${sequence?.name ?? 'Sequence'} · ${blueprint.label} · ${sequence?.goal ?? sourceShot?.idea ?? sourcePrompt ?? 'visual beat'}`
    const imagePrompt = [
      styleBible.promptPrefix,
      `frame ${index + 1} at ${formatTimecode(blueprint.second)}`,
      `sequence goal: ${sequence?.goal ?? 'maintain continuity'}`,
      `character consistency: ${characterBible.consistencyKey}`,
      `shot type ${shotType}, angle ${angle}, movement ${movement}, ${focalLength}mm, ${lighting}, ${colorGrade}`,
      sourceType === 'image' ? `reference image: ${sourceImageUrl ?? 'provided'}` : `source prompt: ${sourcePrompt ?? sourceShot?.idea ?? ''}`,
      `${frameStyle} previs frame`,
    ].filter(Boolean).join('. ')

    return {
      id: uid('frame'),
      timecode: formatTimecode(blueprint.second),
      sequenceId: sourceShot?.sequenceId ?? narrative?.sequences[0]?.id ?? 'seq-unknown',
      description,
      intent: sourceShot?.intent ?? blueprint.intent,
      shotType,
      angle,
      movement,
      focalLength,
      lighting,
      colorGrade,
      imagePrompt,
      imageUrl: buildFramePlaceholder({
        title: formatTimecode(blueprint.second),
        subtitle: sequence?.name ?? blueprint.label,
        accent: frameStyle === 'comic' ? '#f9a8d4' : frameStyle === 'cinematic' ? '#fbbf24' : '#c7d2fe',
        aspectRatio,
      }),
      status: 'draft',
      linkedShotId: sourceShot?.id,
      roleBibleId: lockedRoleBible?.id,
      consistencyKey: lockedRoleBible?.consistencyKey,
      cameraBrand: sourceShot?.cameraBrand,
      cameraModel: sourceShot?.cameraModel,
      lensBrand: sourceShot?.lensBrand,
      lensModel: sourceShot?.lensModel,
      createdAt: new Date().toISOString(),
    }
  })

  return {
    previs: {
      id: uid('previs'),
      sourceType,
      sourcePrompt,
      sourceImageUrl,
      duration,
      frameStyle,
      aspectRatio,
      frames,
      status: 'draft',
    },
    characterBible,
    styleBible,
  }
}
