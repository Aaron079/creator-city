import type { CreatorSkillEvidence, CreatorSkillIssue } from '../types'
import type { SceneBreakdownPayload, ScriptSceneDraft } from './types'

const MAX_SCENES = 40
const CHINESE_NUMBER = '[0-9零〇一二三四五六七八九十百千万两]+'
const CHINESE_NUMBERED_HEADING = new RegExp(
  `^(?:第${CHINESE_NUMBER}场|场景\\s*${CHINESE_NUMBER})(?:\\s+|[：:、]\\s*|$)`,
)
const CHINESE_SETTING_MARKER = /^(内外景|内景|外景)(?:\s+|[：:、]\s*|$)/
const ENGLISH_HEADING = /^(INT\/EXT\.|INT\.|EXT\.|I\/E\.)(?:\s*|$)(.*)$/i
const CHINESE_TIME_TOKENS = new Set([
  '日',
  '夜',
  '白天',
  '晚上',
  '早晨',
  '清晨',
  '中午',
  '午后',
  '黄昏',
  '傍晚',
  '深夜',
  '黎明',
])
const LATIN_NAME = /^\p{Lu}[\p{Script=Latin}\p{M}]*(?:['\u2019-]\p{Script=Latin}[\p{Script=Latin}\p{M}]*)*(?:\s+\p{Lu}[\p{Script=Latin}\p{M}]*(?:['\u2019-]\p{Script=Latin}[\p{Script=Latin}\p{M}]*)*)?$/u
const CHINESE_BASE_NAME = /^\p{Script=Han}{2,4}$/u
const COLON_CUE = /^([^:：]+)\s*[:：]\s*(.*)$/u
const TRANSITION_LABEL = /^(?:FADE(?:\s+(?:IN|OUT|TO(?:\s+\S+){0,3}))?|CUT(?:\s+TO(?:\s+\S+){0,3})?|DISSOLVE(?:\s+TO(?:\s+\S+){0,3})?|SMASH\s+CUT(?:\s+TO(?:\s+\S+){0,3})?|MATCH\s+CUT(?:\s+TO(?:\s+\S+){0,3})?|JUMP\s+CUT(?:\s+TO(?:\s+\S+){0,3})?|WIPE(?:\s+TO(?:\s+\S+){0,3})?|IRIS\s+(?:IN|OUT))$/i
const CUE_QUALIFIER = /\s+\((?:V\.O\.|O\.S\.|CONT'D)\)$/iu
const PRODUCTION_LABELS = new Set([
  'ANGLE',
  'CAMERA',
  'CAPTION',
  'CHYRON',
  'CREDITS',
  'FX',
  'INSERT',
  'INTERCUT',
  'MONTAGE',
  'MUSIC',
  'OS',
  'POV',
  'SFX',
  'SHOT',
  'SOUND',
  'SUBTITLE',
  'SUPER',
  'TITLE',
  'VFX',
  'VO',
])
const LATIN_ARTICLES = new Set(['A', 'AN', 'THE'])
const LATIN_ACTION_WORDS = new Set([
  'CLOSE',
  'CLOSED',
  'CLOSES',
  'CRIED',
  'CRIES',
  'CRY',
  'ENTER',
  'ENTERED',
  'ENTERS',
  'EXIT',
  'EXITED',
  'EXITS',
  'LAUGH',
  'LAUGHED',
  'LAUGHS',
  'LEAVE',
  'LEAVES',
  'LEFT',
  'LOOK',
  'LOOKED',
  'LOOKS',
  'MOVE',
  'MOVED',
  'MOVES',
  'OPEN',
  'OPENED',
  'OPENS',
  'PULL',
  'PULLED',
  'PULLS',
  'PUSH',
  'PUSHED',
  'PUSHES',
  'RAN',
  'RUN',
  'RUNS',
  'SAT',
  'SIT',
  'SITS',
  'STAND',
  'STANDS',
  'STOOD',
  'TURN',
  'TURNED',
  'TURNS',
  'WALK',
  'WALKED',
  'WALKS',
])
const EXPLICIT_LATIN_ACTION_WORDS = new Set([
  'CLOSES',
  'CRIES',
  'ENTERS',
  'EXITS',
  'LAUGHS',
  'LEAVES',
  'LOOKS',
  'MOVES',
  'OPENS',
  'PULLS',
  'PUSHES',
  'RUNS',
  'SITS',
  'SMILES',
  'STANDS',
  'TURNS',
  'WALKS',
])
const COMMON_CHINESE_SURNAMES = new Set(Array.from(
  '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏窦章云苏潘葛范彭郎鲁韦昌马苗方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余顾孟平黄穆萧尹姚邵湛汪祁毛禹狄米贝臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万柯管卢莫房解应宗丁宣邓郁单杭洪包诸左石崔吉龚程邢裴陆荣翁荀惠甄曲家封芮储靳段富巫乌焦巴弓牧山谷车侯全班仰秋仲伊宫宁栾甘厉祖武符刘景詹龙叶幸司黎白怀蒲鄂赖卓蔺屠蒙池乔党翟谭贡劳姬申冉桑桂牛边燕冀浦尚农温庄晏柴瞿阎连茹习艾鱼容向古易慎戈廖庾居衡步都耿满弘匡国文寇广东欧沃利蔚越隆师聂晁勾敖融冷辛阚那简饶曾沙鞠关查荆红游权盖益桓',
))
const CHINESE_ROLE_SUFFIXES = [
  '老师',
  '医生',
  '警察',
  '警官',
  '师傅',
  '经理',
  '老板',
  '导演',
  '店员',
  '司机',
  '保安',
  '护士',
  '队长',
  '主任',
  '教授',
  '教练',
  '演员',
  '记者',
  '主持人',
  '服务员',
  '旁白',
  '父亲',
  '母亲',
  '爸爸',
  '妈妈',
  '爷爷',
  '奶奶',
  '哥哥',
  '姐姐',
  '弟弟',
  '妹妹',
  '叔叔',
  '阿姨',
  '舅舅',
  '姑姑',
]
const CHINESE_NICKNAME_PREFIXES = ['小', '老', '阿']
const CHINESE_ACTION_HINTS = [
  '打开',
  '关闭',
  '进入',
  '离开',
  '转身',
  '走',
  '跑',
  '看',
  '推',
  '拉',
  '坐',
  '站',
  '笑',
  '哭',
  '冲',
]

type HeadingInfo = {
  heading: string
  location?: string
  timeOfDay?: string
}

type SceneRange = {
  start: number
  end: number
  headingIndex?: number
  heading?: HeadingInfo
}

type SceneLineKind = 'heading' | 'blank' | 'transition' | 'cue' | 'dialogue' | 'action'

type SceneClassification = {
  characters: string[]
  lineKinds: Map<number, SceneLineKind>
}

export type ScriptSegmentationParseResult = {
  payload: SceneBreakdownPayload
  evidence: CreatorSkillEvidence[]
  warnings: CreatorSkillIssue[]
}

function parseEnglishHeading(heading: string): HeadingInfo | null {
  const match = heading.match(ENGLISH_HEADING)
  if (!match) return null

  const body = match[2]!.trim()
  const separatedTokens = body.match(/^(.*?)\s+-\s+(.+)$/)
  const location = (separatedTokens?.[1] ?? body).trim()
  const timeOfDay = separatedTokens?.[2]?.trim()

  return {
    heading,
    ...(location ? { location } : {}),
    ...(timeOfDay ? { timeOfDay } : {}),
  }
}

function parseChineseHeading(heading: string): HeadingInfo | null {
  const numberedMatch = heading.match(CHINESE_NUMBERED_HEADING)
  let rest = numberedMatch ? heading.slice(numberedMatch[0].length) : heading
  const englishHeading = numberedMatch ? parseEnglishHeading(rest.trim()) : null
  if (englishHeading) {
    return {
      ...englishHeading,
      heading,
    }
  }
  const settingMatch = rest.match(CHINESE_SETTING_MARKER)

  if (!numberedMatch && !settingMatch) return null
  if (!settingMatch) return { heading }

  rest = rest.slice(settingMatch[0].length).trim()
  if (!rest) return { heading }

  const tokens = rest.split(/\s+/)
  const finalToken = tokens[tokens.length - 1]!
  const hasTime = CHINESE_TIME_TOKENS.has(finalToken)
  const location = tokens.slice(0, hasTime ? -1 : undefined).join(' ').trim()

  return {
    heading,
    ...(location ? { location } : {}),
    ...(hasTime ? { timeOfDay: finalToken } : {}),
  }
}

function parseHeading(line: string): HeadingInfo | null {
  const heading = line.trim()
  if (!heading) return null
  return parseEnglishHeading(heading) ?? parseChineseHeading(heading)
}

function isTransition(line: string) {
  const label = line
    .trim()
    .split(/[:：]/, 1)[0]!
    .replace(/[.!?。！？]+$/u, '')
    .trim()
  return TRANSITION_LABEL.test(label)
}

function stripCueQualifier(name: string) {
  return name.trim().replace(CUE_QUALIFIER, '').trim()
}

function containsProductionLabel(name: string) {
  return name
    .toUpperCase()
    .split(/\s+/)
    .some((token) => PRODUCTION_LABELS.has(token))
}

function isPlausibleStandaloneLatinName(name: string) {
  if (!LATIN_NAME.test(name)) return false
  if (name !== name.toUpperCase()) return false

  const tokens = name.toUpperCase().split(/\s+/)
  return !LATIN_ARTICLES.has(tokens[0]!)
    && !tokens.some((token) => LATIN_ACTION_WORDS.has(token))
    && !containsProductionLabel(name)
}

function hasChineseSurnameOrRoleStructure(name: string) {
  return COMMON_CHINESE_SURNAMES.has(Array.from(name)[0]!)
    || CHINESE_ROLE_SUFFIXES.some((suffix) => name.endsWith(suffix))
}

function hasExplicitChinesePersonStructure(name: string) {
  return hasChineseSurnameOrRoleStructure(name)
    || CHINESE_NICKNAME_PREFIXES.some((prefix) => name.startsWith(prefix))
}

function hasChineseActionHint(name: string) {
  return CHINESE_ACTION_HINTS.some((hint) => name.includes(hint))
}

function isPlausibleStandaloneChineseName(name: string) {
  if (!CHINESE_BASE_NAME.test(name)) return false
  if (CHINESE_ACTION_HINTS.some((hint) => name.includes(hint))) return false

  return hasChineseSurnameOrRoleStructure(name)
}

function isPlausibleExplicitLatinName(name: string) {
  if (!LATIN_NAME.test(name)) return false

  const tokens = name.toUpperCase().split(/\s+/)
  return !LATIN_ARTICLES.has(tokens[0]!)
    && !tokens.some((token) => EXPLICIT_LATIN_ACTION_WORDS.has(token))
}

function isPlausibleExplicitChineseName(name: string) {
  if (!CHINESE_BASE_NAME.test(name)) return false
  return hasExplicitChinesePersonStructure(name) || !hasChineseActionHint(name)
}

function normalizeExplicitCueName(rawName: string) {
  const name = stripCueQualifier(rawName)
  if (!name || Array.from(name).length > 40 || isTransition(name)) return null
  if (containsProductionLabel(name)) return null
  if (isPlausibleExplicitLatinName(name) || isPlausibleExplicitChineseName(name)) {
    return name
  }
  return null
}

function normalizeStandaloneCueName(rawName: string) {
  const name = stripCueQualifier(rawName)
  if (!name || Array.from(name).length > 40 || isTransition(name)) return null
  if (isPlausibleStandaloneLatinName(name) || isPlausibleStandaloneChineseName(name)) {
    return name
  }
  return null
}

function extractColonCue(line: string) {
  const match = line.trim().match(COLON_CUE)
  return normalizeExplicitCueName(match?.[1] ?? '')
}

function extractStandaloneCue(line: string) {
  const cue = line.trim()
  if (!cue || cue.length > 40 || isTransition(cue)) return null
  return normalizeStandaloneCueName(cue)
}

function characterKey(name: string) {
  return name.toUpperCase()
}

function canStartDialogueBlock(
  lines: readonly string[],
  range: SceneRange,
  index: number,
) {
  if (index > range.end || index === range.headingIndex) return false
  const line = lines[index]!
  if (!line.trim() || isTransition(line) || extractColonCue(line)) return false
  return !extractStandaloneCue(line)
}

function classifyScene(
  lines: readonly string[],
  range: SceneRange,
): SceneClassification {
  const characters: string[] = []
  const seen = new Set<string>()
  const lineKinds = new Map<number, SceneLineKind>()
  let inDialogueBlock = false

  const addCharacter = (name: string) => {
    const key = characterKey(name)
    if (seen.has(key)) return
    seen.add(key)
    characters.push(name)
  }

  for (let index = range.start; index <= range.end; index += 1) {
    if (index === range.headingIndex) {
      lineKinds.set(index, 'heading')
      inDialogueBlock = false
      continue
    }

    const line = lines[index]!
    if (!line.trim()) {
      lineKinds.set(index, 'blank')
      inDialogueBlock = false
      continue
    }

    const colonCue = extractColonCue(line)
    if (colonCue) {
      lineKinds.set(index, 'cue')
      addCharacter(colonCue)
      inDialogueBlock = true
      continue
    }

    const standaloneCue = extractStandaloneCue(line)
    if (standaloneCue && canStartDialogueBlock(lines, range, index + 1)) {
      lineKinds.set(index, 'cue')
      addCharacter(standaloneCue)
      inDialogueBlock = true
      continue
    }

    if (isTransition(line)) {
      lineKinds.set(index, 'transition')
      inDialogueBlock = false
      continue
    }

    if (inDialogueBlock) {
      lineKinds.set(index, 'dialogue')
      continue
    }

    lineKinds.set(index, 'action')
  }

  return { characters, lineKinds }
}

function collectHeadings(lines: readonly string[]) {
  const headings: Array<{ index: number; info: HeadingInfo }> = []
  for (let index = 0; index < lines.length; index += 1) {
    const info = parseHeading(lines[index]!)
    if (info) headings.push({ index, info })
  }
  return headings
}

function createHeadedRanges(
  lines: readonly string[],
  headings: Array<{ index: number; info: HeadingInfo }>,
) {
  const hasPreamble = lines
    .slice(0, headings[0]!.index)
    .some((line) => line.trim().length > 0)

  const ranges = headings.map((heading, index): SceneRange => ({
    start: index === 0 && hasPreamble ? 0 : heading.index,
    end: (headings[index + 1]?.index ?? lines.length) - 1,
    headingIndex: heading.index,
    heading: heading.info,
  }))

  return { ranges, hasPreamble }
}

function createFallbackRanges(lines: readonly string[]) {
  const ranges: SceneRange[] = []
  let index = 0

  while (index < lines.length) {
    while (index < lines.length && !lines[index]!.trim()) index += 1
    if (index >= lines.length) break

    const start = index
    while (index < lines.length && lines[index]!.trim()) index += 1
    ranges.push({ start, end: index - 1 })
  }

  return ranges
}

function createScene(
  lines: readonly string[],
  range: SceneRange,
  index: number,
): ScriptSceneDraft {
  const order = index + 1
  const classification = classifyScene(lines, range)
  let actionSummary = ''
  for (let lineIndex = range.start; lineIndex <= range.end; lineIndex += 1) {
    if (classification.lineKinds.get(lineIndex) === 'action') {
      actionSummary = lines[lineIndex]!.trim()
      break
    }
  }

  return {
    sceneId: `scene-${String(order).padStart(3, '0')}`,
    order,
    heading: range.heading?.heading ?? '',
    ...(range.heading?.location ? { location: range.heading.location } : {}),
    ...(range.heading?.timeOfDay ? { timeOfDay: range.heading.timeOfDay } : {}),
    characters: classification.characters,
    actionSummary,
    sourceText: lines.slice(range.start, range.end + 1).join('\n'),
    lineStart: range.start + 1,
    lineEnd: range.end + 1,
    reviewStatus: 'pending',
  }
}

export function normalizeScriptSource(sourceText: string) {
  return sourceText.replace(/\r\n/g, '\n')
}

export function parseScriptScenes(
  sourceText: string,
  sourceNodeId: string,
): ScriptSegmentationParseResult {
  const normalizedSource = normalizeScriptSource(sourceText)
  const lines = normalizedSource.split('\n')
  const headings = collectHeadings(lines)
  const format = headings.length > 0 ? 'headed-script' : 'paragraph-fallback'
  const headed = headings.length > 0
    ? createHeadedRanges(lines, headings)
    : null
  const allRanges = headed?.ranges ?? createFallbackRanges(lines)
  const ranges = allRanges.slice(0, MAX_SCENES)
  const scenes = ranges.map((range, index) => createScene(lines, range, index))
  const warnings: CreatorSkillIssue[] = []

  if (!headed) {
    warnings.push({
      code: 'FALLBACK_SCENE_BOUNDARIES',
      message: 'No explicit scene headings were found; paragraph boundaries require review.',
      sourceNodeId,
    })
  } else if (headed.hasPreamble) {
    warnings.push({
      code: 'PRE_HEADING_CONTENT_INCLUDED',
      message: 'Content before the first heading was included in the first scene and requires review.',
      sourceNodeId,
    })
  }

  if (allRanges.length > MAX_SCENES) {
    warnings.push({
      code: 'SCENE_LIMIT_REACHED',
      message: `Only the first ${MAX_SCENES} scenes were included.`,
      sourceNodeId,
    })
  }

  const evidence = scenes.map((scene): CreatorSkillEvidence => ({
    evidenceId: `scene-evidence-${String(scene.order).padStart(3, '0')}`,
    ruleId: headed ? 'HEADED_SCENE_BOUNDARY' : 'FALLBACK_PARAGRAPH_BOUNDARY',
    sourceNodeId,
    lineStart: scene.lineStart,
    lineEnd: scene.lineEnd,
    excerpt: scene.sourceText,
    explanation: headed
      ? `Scene ${scene.order} follows an explicit script heading.`
      : `Scene ${scene.order} uses a paragraph fallback boundary and requires review.`,
  }))

  return {
    payload: { format, scenes },
    evidence,
    warnings,
  }
}
