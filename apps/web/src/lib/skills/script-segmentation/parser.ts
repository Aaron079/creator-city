import type { CreatorSkillEvidence, CreatorSkillIssue } from '../types'
import type { SceneBreakdownPayload, ScriptSceneDraft } from './types'

const MAX_SCENES = 40
const CHINESE_NUMBER = '[0-9零〇一二三四五六七八九十百千万两]+'
const CHINESE_NUMBERED_HEADING = new RegExp(
  `^(?:第${CHINESE_NUMBER}场|场景\\s*${CHINESE_NUMBER})(?:\\s+|$)`,
)
const CHINESE_SETTING_MARKER = /^(内外景|内景|外景)(?:\s+|$)/
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
const STANDALONE_LATIN_CUE = /^(?=.*[A-Z])[A-Z0-9 ._'-]{1,40}$/
const COLON_CUE = /^([^:：]{1,40})\s*[:：]/
const CUE_NAME = /^[\p{L}\p{N} ._'-]+$/u

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

function extractColonCue(line: string) {
  const match = line.trim().match(COLON_CUE)
  const name = match?.[1]?.trim() ?? ''
  if (!name || !CUE_NAME.test(name)) return null
  return name
}

function extractStandaloneCue(line: string) {
  const cue = line.trim()
  return STANDALONE_LATIN_CUE.test(cue) ? cue : null
}

function characterKey(name: string) {
  const isAscii = Array.from(name).every((character) => character.codePointAt(0)! <= 0x7f)
  return isAscii ? name.toUpperCase() : name
}

function extractCharacters(
  lines: readonly string[],
  range: SceneRange,
) {
  const characters: string[] = []
  const seen = new Set<string>()

  for (let index = range.start; index <= range.end; index += 1) {
    if (index === range.headingIndex) continue
    const line = lines[index]!
    const name = extractColonCue(line) ?? extractStandaloneCue(line)
    if (!name) continue
    const key = characterKey(name)
    if (seen.has(key)) continue
    seen.add(key)
    characters.push(name)
  }

  return characters
}

function extractActionSummary(
  lines: readonly string[],
  range: SceneRange,
) {
  for (let index = range.start; index <= range.end; index += 1) {
    if (index === range.headingIndex) continue
    const line = lines[index]!.trim()
    if (!line || extractColonCue(line) || extractStandaloneCue(line)) continue
    return line
  }
  return ''
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
  return {
    sceneId: `scene-${String(order).padStart(3, '0')}`,
    order,
    heading: range.heading?.heading ?? '',
    ...(range.heading?.location ? { location: range.heading.location } : {}),
    ...(range.heading?.timeOfDay ? { timeOfDay: range.heading.timeOfDay } : {}),
    characters: extractCharacters(lines, range),
    actionSummary: extractActionSummary(lines, range),
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
