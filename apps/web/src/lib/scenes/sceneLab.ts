import { createSceneProfile } from './sceneBible'
import type { SceneProfile } from './types'

export type SceneSourceNode = {
  nodeId: string
  kind: 'image' | 'video'
  title?: string
  prompt?: string
  resultImageUrl?: string
  resultVideoUrl?: string
  compiledPromptPreview?: string
  providerId?: string
  model?: string
  metadataJson?: unknown
}

export type SceneEditBrief = {
  sourceNodeId: string
  sourceKind: 'image' | 'video'
  targetTime?: string
  targetWeather?: string
  targetColorPalette?: string
  targetArchitecture?: string
  targetAtmosphere?: string
  preserveElements?: string
  removeElements?: string
  customInstruction?: string
  negativeRules?: string
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function compactText(value: string, limit: number) {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

function sourceText(sourceNode: SceneSourceNode) {
  const metadata = recordValue(sourceNode.metadataJson)
  return [
    sourceNode.title,
    sourceNode.prompt,
    sourceNode.compiledPromptPreview,
    stringValue(metadata.compiledPromptPreview),
    stringValue(metadata.resultText),
  ].filter(Boolean).join('\n')
}

function firstMatch(text: string, candidates: string[]) {
  return candidates.find((candidate) => text.includes(candidate)) ?? ''
}

function inferLocation(text: string) {
  const normalized = text.toLowerCase()
  if (text.includes('城市') || normalized.includes('city')) return text.includes('未来') || normalized.includes('future') ? '未来城市' : '城市'
  if (text.includes('街') || normalized.includes('street')) return '街道'
  if (text.includes('房间') || text.includes('室内') || normalized.includes('room') || normalized.includes('interior')) return '室内空间'
  if (text.includes('商业区')) return '商业区'
  if (text.includes('森林') || normalized.includes('forest')) return '森林'
  if (text.includes('海边') || normalized.includes('beach')) return '海边'
  return ''
}

function inferAtmosphere(text: string) {
  const values = [
    firstMatch(text, ['电影感', '孤独', '紧张', '温暖', '冷峻', '潮湿', '梦幻', '压抑', '神秘', '赛博朋克']),
    firstMatch(text.toLowerCase(), ['cinematic', 'lonely', 'tense', 'warm', 'cold', 'moody', 'cyberpunk']),
  ].filter(Boolean)
  return [...new Set(values)].join('、')
}

function inferLighting(text: string) {
  const values = [
    firstMatch(text, ['霓虹', '日光', '月光', '逆光', '高反差', '柔光', '硬光', '蓝紫', '暖光', '湿地反光']),
    firstMatch(text.toLowerCase(), ['neon', 'sunlight', 'moonlight', 'backlight', 'high contrast', 'soft light']),
  ].filter(Boolean)
  return [...new Set(values)].join('、')
}

function inferWeather(text: string) {
  const lower = text.toLowerCase()
  if (text.includes('雨夜')) return '雨夜'
  if (text.includes('雨') || lower.includes('rain')) return '雨天'
  if (text.includes('晴') || lower.includes('sunny')) return '晴天'
  if (text.includes('雾') || lower.includes('fog')) return '雾'
  if (text.includes('雪') || lower.includes('snow')) return '雪'
  if (text.includes('黄昏') || lower.includes('dusk')) return '黄昏'
  if (text.includes('夜') || lower.includes('night')) return '夜晚'
  return ''
}

function inferColorRules(text: string) {
  const values = [
    firstMatch(text, ['蓝紫', '暖橙', '冷色', '黑金', '暖金', '高饱和', '低饱和', '霓虹']),
    firstMatch(text.toLowerCase(), ['blue purple', 'warm orange', 'cool tone', 'black gold', 'neon']),
  ].filter(Boolean)
  return [...new Set(values)].join('、')
}

function inferArchitecture(text: string) {
  const values = [
    firstMatch(text, ['高楼', '玻璃幕墙', '窄街', '广告牌', '室内', '走廊', '房间', '广场', '桥', '天台']),
    firstMatch(text.toLowerCase(), ['skyscraper', 'glass facade', 'street', 'billboard', 'interior', 'corridor', 'room']),
  ].filter(Boolean)
  return [...new Set(values)].join('、')
}

function inferKeyObjects(text: string) {
  const values = ['悬浮车', '广告屏', '雨伞', '湿润街道', '霓虹灯', '玻璃幕墙', '街灯', '车辆']
    .filter((item) => text.includes(item))
  return values.join('、')
}

export function summarizeSceneSource(sourceNode: SceneSourceNode) {
  const generatedUrl = sourceNode.resultImageUrl || sourceNode.resultVideoUrl || ''
  return [
    `${sourceNode.kind === 'image' ? 'Image' : 'Video'} 节点：${sourceNode.title || sourceNode.nodeId}`,
    sourceNode.prompt && `原始提示词：${compactText(sourceNode.prompt, 180)}`,
    sourceNode.compiledPromptPreview && `Compiled Prompt：${compactText(sourceNode.compiledPromptPreview, 220)}`,
    generatedUrl && `已生成结果：${generatedUrl}`,
    sourceNode.providerId && `Provider：${sourceNode.providerId}`,
    sourceNode.model && `Model：${sourceNode.model}`,
  ].filter(Boolean).join('\n')
}

export function buildSceneProfileDraftFromNode(sourceNode: SceneSourceNode): SceneProfile {
  const text = sourceText(sourceNode)
  const title = sourceNode.title || ''
  const location = inferLocation(text)
  const weather = inferWeather(text)
  const atmosphere = inferAtmosphere(text)
  const lighting = inferLighting(text)
  const colorRules = inferColorRules(text)
  const architecture = inferArchitecture(text)
  const keyObjects = inferKeyObjects(text)
  const nameParts = [location, weather || atmosphere].filter(Boolean).join(' · ')

  return createSceneProfile({
    name: nameParts ? `未命名场景 - ${nameParts}` : `未命名场景 - ${title || '来源节点'}`,
    logline: compactText(text || summarizeSceneSource(sourceNode), 180),
    location,
    era: text.includes('未来') || text.toLowerCase().includes('future') ? '近未来' : undefined,
    atmosphere,
    architecture,
    lighting,
    weather,
    colorRules,
    keyObjects,
    continuityRules: '保持该场景的空间结构、光线、天气、色调和主要环境元素一致。',
    negativeRules: '不要改变场景时代，不要改变主要建筑结构，不要改变昼夜和天气，除非用户明确要求。',
  })
}

export function buildSceneEditPrompt(
  sourceNode: SceneSourceNode,
  sceneProfile: SceneProfile,
  editBrief: SceneEditBrief,
) {
  const generatedUrl = sourceNode.resultImageUrl || sourceNode.resultVideoUrl || '未记录'
  const negativeRules = [
    editBrief.negativeRules,
    sceneProfile.negativeRules,
    editBrief.removeElements && `移除元素：${editBrief.removeElements}`,
  ].filter(Boolean).join('\n')

  return [
    '【场景编辑任务】',
    '基于来源节点的场景，进行场景改造。',
    '',
    '【来源场景】',
    `- 来源节点：${sourceNode.title || sourceNode.nodeId} (${sourceNode.kind})`,
    `- 原始提示词：${sourceNode.prompt || '未记录'}`,
    `- 已生成结果：${generatedUrl}`,
    `- 场景描述：${sceneProfile.logline || '未填写'}`,
    `- 光线：${sceneProfile.lighting || '未填写'}`,
    `- 天气：${sceneProfile.weather || '未填写'}`,
    `- 色彩：${sceneProfile.colorRules || '未填写'}`,
    `- 建筑/空间：${sceneProfile.architecture || '未填写'}`,
    `- 关键物件：${sceneProfile.keyObjects || '未填写'}`,
    '',
    '【需要保留】',
    editBrief.preserveElements || sceneProfile.continuityRules || '保持来源场景的主要空间结构、构图关系和世界观。',
    '',
    '【需要改变】',
    `- 时间：${editBrief.targetTime || '不指定'}`,
    `- 天气：${editBrief.targetWeather || '不指定'}`,
    `- 色调：${editBrief.targetColorPalette || '不指定'}`,
    `- 建筑/空间：${editBrief.targetArchitecture || '不指定'}`,
    `- 氛围：${editBrief.targetAtmosphere || '不指定'}`,
    `- 自定义要求：${editBrief.customInstruction || '无'}`,
    '',
    '【禁止改变】',
    negativeRules || '不要改变来源场景的主要空间结构。',
    '',
    '【生成要求】',
    '1. 保持原场景的空间连续性。',
    '2. 保持主要构图和世界观。',
    '3. 只改变用户指定的场景属性。',
    '4. 输出适合图片生成模型的中文提示词。',
    '5. 不要输出解释，只输出最终画面描述。',
  ].join('\n')
}
