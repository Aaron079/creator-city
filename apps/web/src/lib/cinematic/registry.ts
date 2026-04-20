import type { ProParams } from '@/lib/ai/prompts'
import type { ProjectTemplate } from '@/lib/templates'
import type { EditorClip, Narrative, Sequence, Shot, ShotSuggestion } from '@/store/shots.store'

export type CinematicSkillCategory =
  | 'vfx-motion'
  | 'composition'
  | 'editing-logic'
  | 'perspective'
  | 'color-look'
  | 'camera-language'

export interface CinematicSkillAdapter {
  name: string
  type: 'plugin' | 'api' | 'host-export'
  supportedHosts: string[]
  notes: string
}

export interface CinematicSkill {
  id: string
  name: string
  category: CinematicSkillCategory
  description: string
  useWhen: string
  avoidWhen: string
  parameters: Array<{ key: string; recommended: string | number }>
  externalAdapters: CinematicSkillAdapter[]
  userActions: string[]
  applyTarget?: 'shot' | 'sequence' | 'editor-clip'
  applyPreset?: Partial<ProParams>
  transition?: EditorClip['transition']
  pacing?: EditorClip['pacing']
  sequenceMatch?: string[]
}

type SkillPanelId = 'camera' | 'composition' | 'perspective' | 'movement' | 'effects' | 'color' | 'editing'

const ADAPTERS: Record<string, CinematicSkillAdapter> = {
  twixtor: { name: 'Twixtor', type: 'plugin', supportedHosts: ['After Effects', 'Premiere Pro'], notes: '适合做时间重映射、慢动作插帧参考。' },
  topaz: { name: 'Topaz Video AI', type: 'plugin', supportedHosts: ['Standalone', 'Host Export'], notes: '适合高帧率补帧和画质增强。' },
  rsmb: { name: 'RSMB', type: 'plugin', supportedHosts: ['After Effects', 'Premiere Pro'], notes: '适合做运动模糊补偿。' },
  mocha: { name: 'Mocha Pro', type: 'plugin', supportedHosts: ['After Effects', 'Premiere Pro', 'Fusion'], notes: '适合平面跟踪、贴附和复杂稳定。' },
  sapphire: { name: 'Boris FX Sapphire', type: 'plugin', supportedHosts: ['After Effects', 'Premiere Pro', 'DaVinci Resolve'], notes: '适合做风格化特效和转场。' },
  continuum: { name: 'Boris FX Continuum', type: 'plugin', supportedHosts: ['After Effects', 'Premiere Pro', 'DaVinci Resolve'], notes: '适合做修饰、镜头特效和剪辑过渡。' },
  resolve: { name: 'DaVinci Resolve / Fusion', type: 'host-export', supportedHosts: ['DaVinci Resolve', 'Fusion'], notes: '适合调色、合成、节奏和镜头语言落地。' },
  adobe: { name: 'Adobe Premiere / After Effects UXP', type: 'host-export', supportedHosts: ['Premiere Pro', 'After Effects'], notes: '适合剪辑、表达式和插件面板工作流。' },
  otio: { name: 'OpenTimelineIO', type: 'host-export', supportedHosts: ['Resolve', 'Premiere', 'Editorial'], notes: '适合做剪辑结构交换和方案导出。' },
  looks: { name: 'Magic Bullet Looks', type: 'plugin', supportedHosts: ['Premiere Pro', 'After Effects', 'Resolve'], notes: '适合快速建立风格 LUT 方向。' },
  dehancer: { name: 'Dehancer', type: 'plugin', supportedHosts: ['Resolve', 'Premiere Pro', 'After Effects'], notes: '适合胶片模拟和高端商业色彩。' },
  filmconvert: { name: 'FilmConvert Nitrate', type: 'plugin', supportedHosts: ['Resolve', 'Premiere Pro', 'Final Cut Pro'], notes: '适合快速建立胶片基底。' },
  cinematch: { name: 'CineMatch', type: 'plugin', supportedHosts: ['Resolve', 'Premiere Pro', 'Final Cut Pro'], notes: '适合机型间风格匹配。' },
  neatvideo: { name: 'Neat Video', type: 'plugin', supportedHosts: ['Resolve', 'Premiere Pro', 'After Effects'], notes: '适合降噪和画面修复。' },
  runway: { name: 'Runway', type: 'api', supportedHosts: ['Web'], notes: '适合做生成式镜头预演和运动尝试。' },
  seedance: { name: 'Seedance', type: 'api', supportedHosts: ['Web'], notes: '适合做镜头运动与视觉实验。' },
  kling: { name: 'Kling', type: 'api', supportedHosts: ['Web'], notes: '适合做动态镜头预演。' },
  happyhorse: { name: 'HappyHorse（experimental）', type: 'api', supportedHosts: ['Web'], notes: '实验性生成器，仅适合作为备选执行器。' },
}

const adapters = (...keys: Array<keyof typeof ADAPTERS>): CinematicSkillAdapter[] =>
  keys
    .map((key) => ADAPTERS[key])
    .filter((adapter): adapter is CinematicSkillAdapter => Boolean(adapter))

export const CINEMATIC_SKILLS: CinematicSkill[] = [
  { id: 'bullet-time', name: 'Bullet Time', category: 'vfx-motion', description: '让时间局部冻结，强调动作峰值与空间张力。', useWhen: '需要把瞬间动作变成视觉峰值时。', avoidWhen: '情绪表达很私密、真实感比奇观更重要时。', parameters: [{ key: 'motion', recommended: 'Arc Freeze' }, { key: 'speed', recommended: 'Ultra Slow' }], externalAdapters: adapters('twixtor', 'topaz', 'runway'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { movement: 'Arc Freeze', speed: 'Ultra Slow' }, sequenceMatch: ['Hook', 'Escalation', 'Payoff'] },
  { id: 'dolly-zoom', name: 'Dolly Zoom', category: 'camera-language', description: '通过推拉配合焦距变化制造心理失衡。', useWhen: '需要表现人物认知震荡或突然意识到风险时。', avoidWhen: '镜头本身已经很复杂或空间太狭窄时。', parameters: [{ key: 'movement', recommended: 'Push Pull' }, { key: 'focalLength', recommended: '28→70mm' }], externalAdapters: adapters('resolve', 'adobe', 'kling'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { movement: 'Push Pull', focalLength: 50, angle: 'Eye Level' }, sequenceMatch: ['Problem', 'Shift'] },
  { id: 'long-take', name: 'Long Take', category: 'camera-language', description: '用长镜头保持时空连续和调度完整。', useWhen: '想让观众沉浸在真实时间流动里。', avoidWhen: '信息点过多、需要高密度剪辑时。', parameters: [{ key: 'movement', recommended: 'Dolly' }, { key: 'duration', recommended: '10-15s' }], externalAdapters: adapters('resolve', 'adobe', 'otio'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { movement: 'Dolly' }, sequenceMatch: ['Opening', 'Establish', 'Observe'] },
  { id: 'one-shot', name: 'One Shot', category: 'camera-language', description: '单镜头完成完整段落，强调一气呵成。', useWhen: '需要让品牌或剧情一口气说完一个完整动作时。', avoidWhen: '段落里存在很多必须拆开的信息点时。', parameters: [{ key: 'movement', recommended: 'Follow' }, { key: 'framing', recommended: 'MS' }], externalAdapters: adapters('resolve', 'adobe', 'runway'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { movement: 'Follow', framing: 'MS' }, sequenceMatch: ['Hook', 'Opening', 'Feature'] },
  { id: 'handheld', name: 'Handheld', category: 'camera-language', description: '手持语言让镜头更贴近现场和人物。', useWhen: '需要增强真实感、紧张感或人物临场反应时。', avoidWhen: '品牌表达要求极稳、极洁净时。', parameters: [{ key: 'movement', recommended: 'Handheld' }, { key: 'lighting', recommended: 'Available Light' }], externalAdapters: adapters('resolve', 'adobe', 'neatvideo'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { movement: 'Handheld', lightingType: 'Natural' }, sequenceMatch: ['Problem', 'Conflict', 'Documentary'] },
  { id: 'slow-motion', name: 'Slow Motion', category: 'vfx-motion', description: '拉长动作感知，突出情绪、质感和冲击。', useWhen: '想把动作、材质或情绪峰值拉出来时。', avoidWhen: '叙事需要直接推进、不希望停顿时。', parameters: [{ key: 'speed', recommended: 'Slow Motion' }, { key: 'framing', recommended: 'CU' }], externalAdapters: adapters('twixtor', 'topaz', 'runway'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { speed: 'Slow Motion', framing: 'CU' }, sequenceMatch: ['Highlight', 'Payoff', 'Emotional Shift'] },
  { id: 'high-speed-low-speed', name: 'High-Speed / Low-Speed', category: 'vfx-motion', description: '在同一段内拉开速度反差，制造节奏冲击。', useWhen: '需要把一个动作拆成不同感知层次时。', avoidWhen: '段落本身已经节奏很碎时。', parameters: [{ key: 'speed', recommended: 'Ramp' }, { key: 'movement', recommended: 'Static or Push' }], externalAdapters: adapters('twixtor', 'topaz', 'resolve'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { speed: 'Ramp', movement: 'Static' }, sequenceMatch: ['Hook', 'Highlight'] },
  { id: 'snorricam-bodycam', name: 'Snorricam / Bodycam', category: 'camera-language', description: '把人物固定在画面中心，强调主观压迫。', useWhen: '想让人物处在世界失衡但自我被钉住的状态。', avoidWhen: '产品说明、品牌表达要求优雅克制时。', parameters: [{ key: 'movement', recommended: 'Bodycam' }, { key: 'framing', recommended: 'CU' }], externalAdapters: adapters('mocha', 'resolve', 'kling'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { movement: 'Bodycam', framing: 'CU' }, sequenceMatch: ['Problem', 'Shift'] },
  { id: 'timelapse', name: 'Timelapse', category: 'vfx-motion', description: '压缩时间，快速建立空间、过程或流逝感。', useWhen: '需要交代环境变化、过程推进或时间跨度时。', avoidWhen: '人物表演是核心时。', parameters: [{ key: 'movement', recommended: 'Locked Off' }, { key: 'framing', recommended: 'WS' }], externalAdapters: adapters('resolve', 'adobe', 'runway'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { movement: 'Static', framing: 'WS' }, sequenceMatch: ['Hook', 'Opening', 'Establish'] },
  { id: 'fourth-wall', name: 'Fourth Wall', category: 'camera-language', description: '让角色直接意识到镜头存在，形成宣告感。', useWhen: '品牌代言、喜剧打破观演距离或直给 CTA 时。', avoidWhen: '沉浸式写实叙事很强时。', parameters: [{ key: 'angle', recommended: 'Direct Address' }, { key: 'framing', recommended: 'MCU' }], externalAdapters: adapters('adobe', 'resolve', 'runway'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { angle: 'Direct Address', framing: 'MCU' }, sequenceMatch: ['CTA', 'Brand', 'Spokesperson'] },

  { id: 'dutch-angle', name: 'Dutch Angle', category: 'composition', description: '通过倾斜画面制造不稳定与心理偏移。', useWhen: '需要提示风险、错位或人物失衡时。', avoidWhen: '产品展示、理性讲解和高端品牌稳定感场景。', parameters: [{ key: 'angle', recommended: 'Dutch' }, { key: 'framing', recommended: 'MS' }], externalAdapters: adapters('resolve', 'adobe'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { angle: 'Dutch', framing: 'MS' }, sequenceMatch: ['Problem', 'Conflict', 'Shift'] },
  { id: 'symmetry', name: 'Symmetry', category: 'composition', description: '用对称构图强化控制力、仪式感和品牌秩序。', useWhen: '需要高端、规整、权威或品牌性的画面时。', avoidWhen: '想强调随机性和自然临场时。', parameters: [{ key: 'framing', recommended: 'WS' }, { key: 'angle', recommended: 'Centered' }], externalAdapters: adapters('resolve', 'adobe', 'cinematch'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { framing: 'WS', angle: 'Centered' }, sequenceMatch: ['Hook', 'CTA', 'Feature'] },
  { id: 'one-point-perspective', name: 'One-Point Perspective', category: 'composition', description: '单点透视把观众视线强制引向主体。', useWhen: '需要明确视觉中心与空间深度时。', avoidWhen: '画面信息太多且主体不止一个时。', parameters: [{ key: 'focalLength', recommended: '24mm' }, { key: 'framing', recommended: 'WS' }], externalAdapters: adapters('resolve', 'adobe'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { focalLength: 24, framing: 'WS' }, sequenceMatch: ['Establish', 'Reveal', 'Hook'] },
  { id: 'frame-within-frame', name: 'Frame Within Frame', category: 'composition', description: '利用门窗、屏幕等结构做二次取景。', useWhen: '想让画面更有层次与窥视感时。', avoidWhen: '空间本身不支持自然前景框架时。', parameters: [{ key: 'framing', recommended: 'MS' }, { key: 'lighting', recommended: 'Directional' }], externalAdapters: adapters('resolve', 'mocha'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { framing: 'MS', lightingType: 'Spotlight' }, sequenceMatch: ['Observe', 'Opening', 'Reflection'] },
  { id: 'negative-space', name: 'Negative Space', category: 'composition', description: '让留白成为情绪的一部分，强化孤独或品牌主张。', useWhen: '需要突出人物微小感、缺失感或极简产品语言时。', avoidWhen: '信息必须密集且直给时。', parameters: [{ key: 'framing', recommended: 'WS' }, { key: 'angle', recommended: 'Off Center' }], externalAdapters: adapters('resolve', 'adobe'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { framing: 'WS', angle: 'Off Center' }, sequenceMatch: ['Problem', 'Opening', 'Emotional Shift'] },
  { id: 'offscreen-space', name: 'Offscreen Space', category: 'composition', description: '把关键动作留在画外，让观众补全空间。', useWhen: '需要制造悬念或让画外世界更大时。', avoidWhen: '卖点需要完整看清时。', parameters: [{ key: 'framing', recommended: 'MS' }, { key: 'movement', recommended: 'Static' }], externalAdapters: adapters('resolve', 'adobe'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { framing: 'MS', movement: 'Static' }, sequenceMatch: ['Problem', 'Shift', 'Conflict'] },
  { id: 'shallow-depth', name: 'Shallow Depth', category: 'composition', description: '浅景深把注意力从环境剥离到主体。', useWhen: '要突出人物眼神、产品细节或主观情绪时。', avoidWhen: '空间信息同样重要时。', parameters: [{ key: 'aperture', recommended: 'f/2.0' }, { key: 'focalLength', recommended: '85mm' }], externalAdapters: adapters('looks', 'dehancer', 'runway'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { aperture: 'f/2.0', focalLength: 85 }, sequenceMatch: ['Close-up', 'Feature', 'Emotion'] },
  { id: 'deep-focus', name: 'Deep Focus', category: 'composition', description: '深焦让前中后景都成为叙事信息。', useWhen: '需要同时交代人物与空间关系时。', avoidWhen: '希望把背景全部抹掉时。', parameters: [{ key: 'aperture', recommended: 'f/8' }, { key: 'focalLength', recommended: '28mm' }], externalAdapters: adapters('resolve', 'cinematch'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { aperture: 'f/8', focalLength: 28 }, sequenceMatch: ['Establish', 'Feature', 'Documentary'] },

  { id: 'match-cut', name: 'Match Cut', category: 'editing-logic', description: '通过动作、形状或构图相似性实现有意识的连接。', useWhen: '两个段落之间需要优雅且聪明地过渡时。', avoidWhen: '镜头本身关联很弱、硬做会显得刻意时。', parameters: [{ key: 'transition', recommended: 'match-cut' }, { key: 'pacing', recommended: 'medium' }], externalAdapters: adapters('resolve', 'adobe', 'otio'), userActions: ['apply', 'compare', 'ignore'], applyTarget: 'sequence', transition: 'match-cut', pacing: 'medium', sequenceMatch: ['Solution', 'Resolution', 'CTA'] },
  { id: 'cross-cutting', name: 'Cross Cutting', category: 'editing-logic', description: '交叉剪辑拉起并行事件的张力。', useWhen: '要展示两条行动线相互逼近时。', avoidWhen: '只有单一行动线时。', parameters: [{ key: 'transition', recommended: 'cut' }, { key: 'pacing', recommended: 'fast' }], externalAdapters: adapters('resolve', 'adobe', 'otio'), userActions: ['apply', 'compare', 'ignore'], applyTarget: 'sequence', transition: 'cut', pacing: 'fast', sequenceMatch: ['Problem', 'Escalation', 'CTA'] },
  { id: 'jump-cut', name: 'Jump Cut', category: 'editing-logic', description: '故意打破连续性，制造断裂与推进感。', useWhen: '短视频、爆款节奏或人物心绪碎片化时。', avoidWhen: '品牌片需要平滑和高级感时。', parameters: [{ key: 'transition', recommended: 'jump-cut' }, { key: 'pacing', recommended: 'fast' }], externalAdapters: adapters('adobe', 'resolve', 'otio'), userActions: ['apply', 'compare', 'ignore'], applyTarget: 'sequence', transition: 'jump-cut', pacing: 'fast', sequenceMatch: ['Hook', 'Problem', 'Montage'] },
  { id: 'montage', name: 'Montage', category: 'editing-logic', description: '用片段堆叠制造过程和情绪推进。', useWhen: '想快速推进时间、训练、成长或卖点堆叠时。', avoidWhen: '每个镜头都需要完整展开时。', parameters: [{ key: 'transition', recommended: 'cut' }, { key: 'pacing', recommended: 'fast' }], externalAdapters: adapters('resolve', 'adobe', 'otio'), userActions: ['apply', 'compare', 'ignore'], applyTarget: 'sequence', transition: 'cut', pacing: 'fast', sequenceMatch: ['Solution', 'Feature', 'Payoff'] },
  { id: 'invisible-cut', name: 'Invisible Cut', category: 'editing-logic', description: '让剪辑隐身，保留连续沉浸。', useWhen: '希望观众感受一气呵成而不是被剪辑提醒时。', avoidWhen: '需要明显节奏切换时。', parameters: [{ key: 'transition', recommended: 'dissolve' }, { key: 'pacing', recommended: 'medium' }], externalAdapters: adapters('resolve', 'adobe', 'continuum'), userActions: ['apply', 'compare', 'ignore'], applyTarget: 'sequence', transition: 'dissolve', pacing: 'medium', sequenceMatch: ['Opening', 'Observe', 'Establish'] },
  { id: 'kuleshov-effect', name: 'Kuleshov Effect', category: 'editing-logic', description: '利用镜头并置让观众自行补全情绪意义。', useWhen: '你希望表情与对象之间产生新的解释层时。', avoidWhen: '信息必须单义且直接时。', parameters: [{ key: 'transition', recommended: 'cut' }, { key: 'pacing', recommended: 'medium' }], externalAdapters: adapters('resolve', 'adobe', 'otio'), userActions: ['apply', 'compare', 'ignore'], applyTarget: 'sequence', transition: 'cut', pacing: 'medium', sequenceMatch: ['Opening', 'Reflection', 'Emotional Shift'] },
  { id: 'flashback-flashforward', name: 'Flashback / Flashforward', category: 'editing-logic', description: '用时间跳切组织因果与预示。', useWhen: '叙事需要回溯或提前埋伏笔时。', avoidWhen: '结构已经足够复杂时。', parameters: [{ key: 'transition', recommended: 'dissolve' }, { key: 'pacing', recommended: 'slow' }], externalAdapters: adapters('resolve', 'adobe', 'otio'), userActions: ['apply', 'compare', 'ignore'], applyTarget: 'sequence', transition: 'dissolve', pacing: 'slow', sequenceMatch: ['Opening', 'Resolution', 'Reflection'] },

  { id: 'pov', name: 'POV', category: 'perspective', description: '让镜头直接等同于角色视线。', useWhen: '需要把观众放进角色感知里时。', avoidWhen: '你不希望观众只站在单一视角上时。', parameters: [{ key: 'angle', recommended: 'POV' }, { key: 'movement', recommended: 'Eye Trace' }], externalAdapters: adapters('resolve', 'runway', 'kling'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { angle: 'POV', movement: 'Eye Trace' }, sequenceMatch: ['Problem', 'Feature', 'Observe'] },
  { id: 'over-the-shoulder', name: 'Over the Shoulder', category: 'perspective', description: '通过肩后视角建立关系与对话权力。', useWhen: '人物互动、指导关系或产品示范时。', avoidWhen: '镜头需要完全客观或极简正面时。', parameters: [{ key: 'angle', recommended: 'OTS' }, { key: 'framing', recommended: 'MS' }], externalAdapters: adapters('resolve', 'adobe'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { angle: 'OTS', framing: 'MS' }, sequenceMatch: ['Dialogue', 'Resolution', 'Feature'] },
  { id: 'gods-eye-view', name: 'God’s Eye View', category: 'perspective', description: '俯瞰视角强调结构、秩序或命运感。', useWhen: '需要把人物纳入更大的图案和空间里时。', avoidWhen: '你希望观众保持贴身视角时。', parameters: [{ key: 'angle', recommended: 'Bird Eye' }, { key: 'framing', recommended: 'WS' }], externalAdapters: adapters('resolve', 'adobe', 'seedance'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { angle: 'Bird Eye', framing: 'WS' }, sequenceMatch: ['Establish', 'Hook', 'CTA'] },
  { id: 'fourth-wall-perspective', name: 'Fourth-Wall Perspective', category: 'perspective', description: '镜头像一个被角色承认的观察者。', useWhen: '需要让品牌发声、角色自述或制造表演感时。', avoidWhen: '完全写实和沉浸的场景。', parameters: [{ key: 'angle', recommended: 'Lens Address' }, { key: 'framing', recommended: 'MCU' }], externalAdapters: adapters('adobe', 'resolve', 'runway'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { angle: 'Lens Address', framing: 'MCU' }, sequenceMatch: ['CTA', 'Spokesperson', 'Hook'] },

  { id: 'film-emulation', name: 'Film Emulation', category: 'color-look', description: '用胶片基底建立稳定而高级的整体色彩。', useWhen: '品牌片、电影感短片或想统一多个镜头风格时。', avoidWhen: '你故意需要非常生冷的数字质感时。', parameters: [{ key: 'colorLUT', recommended: 'Cinematic' }, { key: 'texture', recommended: 'Fine Grain' }], externalAdapters: adapters('dehancer', 'filmconvert', 'resolve'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { colorLUT: 'Cinematic' }, sequenceMatch: ['Opening', 'Resolution', 'CTA'] },
  { id: 'bleach-bypass', name: 'Bleach Bypass', category: 'color-look', description: '高反差低饱和，强化冷硬冲突感。', useWhen: '冲突、压迫或工业气质更重要时。', avoidWhen: '要温暖、亲和或商品友好时。', parameters: [{ key: 'colorLUT', recommended: 'Bleach Bypass' }, { key: 'contrast', recommended: 'High' }], externalAdapters: adapters('looks', 'resolve', 'sapphire'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { colorLUT: 'Bleach Bypass', contrast: 74 }, sequenceMatch: ['Problem', 'Conflict', 'Shift'] },
  { id: 'commercial-clean', name: 'Commercial Clean', category: 'color-look', description: '高亮、干净、可读性强的商业色彩。', useWhen: '产品展示、功能说明和品牌 CTA 时。', avoidWhen: '你需要颗粒感和强烈作者表达时。', parameters: [{ key: 'colorLUT', recommended: 'Rec.709' }, { key: 'contrast', recommended: 'Balanced' }], externalAdapters: adapters('cinematch', 'resolve', 'looks'), userActions: ['apply', 'compare', 'ignore'], applyPreset: { colorLUT: 'Rec.709', contrast: 58 }, sequenceMatch: ['Feature', 'Solution', 'CTA'] },
]

const PANEL_FILTERS: Record<SkillPanelId, (skill: CinematicSkill) => boolean> = {
  camera: (skill) => skill.category === 'camera-language',
  composition: (skill) => skill.category === 'composition',
  perspective: (skill) => skill.category === 'perspective',
  movement: (skill) => skill.id === 'long-take' || skill.id === 'one-shot' || skill.id === 'handheld' || skill.id === 'slow-motion' || skill.id === 'high-speed-low-speed' || skill.id === 'snorricam-bodycam',
  effects: (skill) => skill.id === 'bullet-time' || skill.id === 'timelapse' || skill.id === 'high-speed-low-speed' || skill.id === 'fourth-wall',
  color: (skill) => skill.category === 'color-look',
  editing: (skill) => skill.category === 'editing-logic',
}

function scoreSkill(skill: CinematicSkill, sequence: Sequence | undefined, template: ProjectTemplate | undefined) {
  let score = 0
  const text = `${sequence?.name ?? ''} ${sequence?.goal ?? ''} ${template?.recommendedStyle ?? ''} ${template?.recommendedPacing ?? ''}`.toLowerCase()
  if (skill.sequenceMatch?.some((hint) => text.includes(hint.toLowerCase()))) score += 3
  if (template?.recommendedStyle && skill.description.includes('品牌')) score += 1
  if (template?.recommendedPacing?.includes('fast') && skill.pacing === 'fast') score += 1
  if (template?.recommendedPacing?.includes('slow') && skill.pacing === 'slow') score += 1
  return score
}

function ensureUnique(ids: string[] = [], nextId?: string) {
  if (!nextId) return ids
  return ids.includes(nextId) ? ids : [...ids, nextId]
}

export function applyCinematicSkillToShot(shot: Shot, skill: CinematicSkill): Shot {
  return {
    ...shot,
    presetParams: { ...(shot.presetParams ?? {}), ...(skill.applyPreset ?? {}) },
    cinematicSkillIds: ensureUnique(shot.cinematicSkillIds, skill.id),
  }
}

export function applyCinematicSkillToClip(clip: EditorClip, skill: CinematicSkill): EditorClip {
  return {
    ...clip,
    transition: skill.transition ?? clip.transition,
    pacing: skill.pacing ?? clip.pacing,
    cinematicSkillIds: ensureUnique(clip.cinematicSkillIds, skill.id),
  }
}

function buildSkillCompareFields(args: {
  shot: Shot
  sequence?: Sequence
  skill: CinematicSkill
  clip?: EditorClip | null
}) {
  const { shot, sequence, skill, clip } = args
  const params = shot.presetParams ?? {}
  const nextParams = { ...params, ...(skill.applyPreset ?? {}) }
  const isEditing = skill.applyTarget === 'sequence' || skill.applyTarget === 'editor-clip'

  if (isEditing) {
    return [
      { label: '电影语言', original: sequence?.cinematicSkillIds?.join(' / ') || clip?.cinematicSkillIds?.join(' / ') || '未指定', suggested: skill.name },
      { label: '作用段落', original: sequence?.name ?? shot.label, suggested: sequence?.name ?? shot.label },
      { label: '段落目标', original: sequence?.goal ?? shot.intent ?? '待定义', suggested: sequence?.goal ?? shot.intent ?? '待定义' },
      { label: '转场策略', original: clip?.transition ?? '手动决定', suggested: skill.transition ?? '保留手动决定' },
      { label: '节奏策略', original: clip?.pacing ?? '手动决定', suggested: skill.pacing ?? '保留手动决定' },
    ]
  }

  return [
    { label: '电影语言', original: shot.cinematicSkillIds?.join(' / ') || '未指定', suggested: skill.name },
    { label: '镜头类型', original: params.shotType ?? params.framing ?? 'medium', suggested: nextParams.shotType ?? nextParams.framing ?? 'medium' },
    { label: '角度', original: params.angle ?? 'Eye Level', suggested: nextParams.angle ?? 'Eye Level' },
    { label: '运动', original: params.movement ?? 'Static', suggested: nextParams.movement ?? 'Static' },
    { label: '色彩', original: params.colorLUT ?? 'Rec.709', suggested: nextParams.colorLUT ?? 'Rec.709' },
  ]
}

export function buildCinematicSkillSuggestions(args: {
  panel: SkillPanelId
  shot: Shot
  narrative: Narrative | null
  projectTemplate?: ProjectTemplate
  editorClip?: EditorClip | null
}): ShotSuggestion[] {
  const { panel, shot, narrative, projectTemplate, editorClip } = args
  const sequence = narrative?.sequences.find((item) => item.id === shot.sequenceId)
  const filtered = CINEMATIC_SKILLS
    .filter(PANEL_FILTERS[panel])
    .sort((a, b) => scoreSkill(b, sequence, projectTemplate) - scoreSkill(a, sequence, projectTemplate))
    .slice(0, 4)

  return filtered.map((skill) => {
    const nextShot = applyCinematicSkillToShot(shot, skill)
    return {
      id: `skill-${panel}-${shot.id}-${skill.id}`,
      kind: 'creative',
      shotId: shot.id,
      shotLabel: shot.label,
      title: skill.name,
      intent: shot.intent ?? sequence?.suggestedIntent ?? '建立环境',
      styleNote: skill.description,
      description: skill.description,
      reasoning: sequence
        ? `当前段落「${sequence.name}」的目标是${sequence.goal}，${skill.name}更适合在这个位置承担${skill.useWhen}`
        : `${skill.name} 适合在当前镜头里承担更明确的电影语言角色。`,
      fitsSequence: sequence ? `适配 ${sequence.name} · ${sequence.goal}` : undefined,
      expectedEffect: projectTemplate
        ? `更贴近 ${projectTemplate.name} 的 ${projectTemplate.recommendedStyle} / ${projectTemplate.recommendedPacing} 方向。`
        : `帮助当前镜头更明确地落在 ${skill.category} 语言上。`,
      useWhen: skill.useWhen,
      avoidWhen: skill.avoidWhen,
      externalAdapters: skill.externalAdapters,
      userActions: skill.userActions,
      cinematicSkillId: skill.id,
      cinematicSkillCategory: skill.category,
      applyTarget: skill.applyTarget ?? 'shot',
      targetSequenceId: sequence?.id,
      targetClipId: editorClip?.id,
      compareFields: buildSkillCompareFields({ shot, sequence, skill, clip: editorClip }),
      originalShot: {
        idea: shot.idea,
        style: shot.style,
        intent: shot.intent,
        presetParams: shot.presetParams,
        cameraBrand: shot.cameraBrand,
        cameraModel: shot.cameraModel,
        lensBrand: shot.lensBrand,
        lensModel: shot.lensModel,
      },
      suggestedShot: {
        idea: shot.idea,
        style: shot.style,
        intent: shot.intent,
        presetParams: nextShot.presetParams,
        cameraBrand: shot.cameraBrand,
        cameraModel: shot.cameraModel,
        lensBrand: shot.lensBrand,
        lensModel: shot.lensModel,
      },
    }
  })
}
