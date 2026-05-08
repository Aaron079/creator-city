import type { CompileNodePromptInput, CompiledNodePrompt } from './types'
import { EDGE_DIRECTOR_LABELS, type EdgeDirective } from '@/lib/canvas/edge-director'
import type { CharacterProfile, CharacterReferenceAsset } from '@/lib/characters'
import { CHARACTER_REFERENCE_KIND_LABELS, getHeroReference } from '@/lib/characters'
import { formatSceneEditTasksForPrompt, formatSceneEditsForPrompt, type SceneProfile } from '@/lib/scenes'
import type { ProjectStyleBible } from '@/lib/skills'

function lines(items: Array<string | false | null | undefined>) {
  return items.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
}

function truncate(value: string, limit = 1800) {
  const trimmed = value.trim()
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed
}

function formatStyleBible(styleBible?: ProjectStyleBible | null) {
  if (!styleBible) return ''
  const referenceKeywords = Array.isArray(styleBible.referenceKeywords)
    ? styleBible.referenceKeywords.filter(Boolean).join(', ')
    : ''
  return lines([
    styleBible.logline && `项目一句话：${styleBible.logline}`,
    styleBible.storyWorld && `世界观：${styleBible.storyWorld}`,
    styleBible.visualStyle && `视觉风格：${styleBible.visualStyle}`,
    styleBible.colorPalette && `色彩方案：${styleBible.colorPalette}`,
    styleBible.cameraLanguage && `镜头语言：${styleBible.cameraLanguage}`,
    styleBible.characterRules && `人物一致性：${styleBible.characterRules}`,
    styleBible.sceneRules && `场景一致性：${styleBible.sceneRules}`,
    styleBible.negativeRules && `禁止项：${styleBible.negativeRules}`,
    referenceKeywords && `参考关键词：${referenceKeywords}`,
  ]).join('\n')
}

function buildSystem(input: CompileNodePromptInput, styleText: string) {
  const skillSystem = input.enabledSkills
    .filter((skill) => skill.appliesTo.includes(input.nodeKind))
    .map((skill) => `- ${skill.name}: ${skill.systemInstruction}`)
    .join('\n')
  return lines([
    'You are Creator City Prompt Compiler. Convert creative intent into production-ready generation prompts while preserving the original user intent.',
    `Target node: ${input.nodeKind}. Provider: ${input.providerId || 'default'}.`,
    styleText && `Project Style Bible:\n${styleText}`,
    skillSystem && `Enabled skills:\n${skillSystem}`,
    'Never contradict explicit user instructions. Preserve continuity, project style, character identity, scene structure, and visual tone.',
  ]).join('\n\n')
}

function yesNo(value: boolean) {
  return value ? '是' : '否'
}

function edgeTypeStrategy(directive: EdgeDirective) {
  const type = directive.config.type
  if (type === 'story-to-visual') {
    return '策略：把上游文本转化为视觉元素，包括人物、场景、情绪、构图、色彩和镜头。'
  }
  if (type === 'image-to-video') {
    return '策略：保持上游图片的主体、构图、风格、色调和场景结构，并根据镜头运动添加运动描述。'
  }
  if (type === 'style-lock') {
    return '策略：强制保持项目 Style Bible 和上游风格，不允许大幅偏离。'
  }
  if (type === 'character-lock') {
    return '策略：强调人物外貌、服装、身份和道具一致。'
  }
  if (type === 'scene-continuity') {
    return '策略：强调场景结构、天气、时代背景和空间关系一致。'
  }
  if (type === 'camera-motion') {
    return '策略：把连接重点转化为明确镜头运动、景别、速度和机位要求。'
  }
  if (type === 'variant') {
    return '策略：基于上游内容生成同主题变体，保留核心意图但允许局部变化。'
  }
  if (type === 'reference') {
    return '策略：把上游内容作为参考引用，提取可用特征但不必逐项复制。'
  }
  return '策略：按普通上下游连续性使用该连接。'
}

function formatEdgeDirectives(edgeDirectives?: EdgeDirective[]) {
  const directives = edgeDirectives?.filter((directive) => directive.config) ?? []
  if (!directives.length) return ''
  return [
    '【连接导演】',
    '以下是上游节点如何影响当前节点的创作规则：',
    ...directives.map((directive, index) => {
      const config = directive.config
      return lines([
        `连接 ${index + 1}: ${directive.sourceKind || 'unknown'}(${directive.sourceNodeId}) → ${directive.targetKind || 'unknown'}(${directive.targetNodeId})`,
        `- 连接类型：${EDGE_DIRECTOR_LABELS[config.type] ?? config.type}`,
        `- 继承故事：${yesNo(config.inheritStory)}`,
        `- 继承角色：${yesNo(config.inheritCharacter)}`,
        `- 继承场景：${yesNo(config.inheritScene)}`,
        `- 继承色调：${yesNo(config.inheritColor)}`,
        `- 继承镜头语言：${yesNo(config.inheritCamera)}`,
        `- 锁定风格：${yesNo(config.lockStyle)}`,
        `- 影响权重：${Math.round(config.influenceWeight * 100)}%`,
        config.cameraMotion && `- 镜头运动：${config.cameraMotion}`,
        config.customInstruction && `- 自定义导演指令：${config.customInstruction}`,
        config.negativeInstruction && `- 禁止项：${config.negativeInstruction}`,
        directive.sourceSummary && `- 上游摘要：${truncate(directive.sourceSummary, 600)}`,
        edgeTypeStrategy(directive),
      ]).join('\n')
    }),
  ].join('\n\n')
}

function keywordText(character: CharacterProfile) {
  return Array.isArray(character.referenceKeywords)
    ? character.referenceKeywords.filter(Boolean).join(', ')
    : ''
}

function formatCharacterItem(character: CharacterProfile) {
  return lines([
    `- 角色名：${character.name}`,
    character.role && `  - 身份：${character.role}`,
    character.logline && `  - 一句话身份：${character.logline}`,
    character.appearance && `  - 外貌：${character.appearance}`,
    character.ageAndTemperament && `  - 年龄/气质：${character.ageAndTemperament}`,
    character.costume && `  - 服装：${character.costume}`,
    character.hairstyle && `  - 发型：${character.hairstyle}`,
    character.props && `  - 关键道具：${character.props}`,
    character.behaviorRules && `  - 行为规则：${character.behaviorRules}`,
    character.negativeRules && `  - 禁止变化项：${character.negativeRules}`,
    keywordText(character) && `  - 参考关键词：${keywordText(character)}`,
  ]).join('\n')
}

function nodeCharacterStrategy(input: CompileNodePromptInput) {
  const lockText = input.edgeCharacterDirectives?.lockCharacterConsistency
    ? '5. Edge Director 已开启角色锁定，角色一致性的优先级提高。'
    : ''
  if (input.nodeKind === 'text') {
    return lines([
      '生成要求：',
      '1. 角色可影响故事、行为、台词和身份。',
      '2. 不强制堆叠视觉细节，但必须保留角色核心身份与不可变化项。',
      '3. 不要随意改变年龄、身份、关键道具或行为规则。',
      lockText,
    ]).join('\n')
  }
  if (input.nodeKind === 'image') {
    return lines([
      '生成要求：',
      '1. 必须保持这些角色特征。',
      '2. 强注入外貌、服装、发型、关键道具和禁止变化项。',
      '3. 角色外观必须在不同图片中保持一致。',
      '4. 不要随意改变年龄、服装、发型、道具。',
      lockText,
    ]).join('\n')
  }
  return lines([
    '生成要求：',
    '1. 必须保持上游图片一致性和角色一致性。',
    '2. 不要改变角色服装、外貌、发型、年龄和关键道具。',
    '3. 只增加运动、镜头、情绪和时间变化。',
    '4. 如果生成视频，角色外观必须保持一致。',
    lockText,
  ]).join('\n')
}

function collectCharacterReferences(input: CompileNodePromptInput): CharacterReferenceAsset[] {
  if (input.characterReferences?.length) return input.characterReferences
  const characters = input.characters?.filter((c) => c.name?.trim()) ?? []
  return characters
    .map((c) => getHeroReference(c))
    .filter((ref): ref is CharacterReferenceAsset => ref !== null)
}

function formatCharacterReferenceSection(input: CompileNodePromptInput) {
  const refs = collectCharacterReferences(input)
  if (!refs.length) return ''
  const kindLabel = (ref: CharacterReferenceAsset) =>
    CHARACTER_REFERENCE_KIND_LABELS[ref.kind] ?? ref.kind
  const characterMap = new Map((input.characters ?? []).map((c) => [c.id, c]))
  return [
    '【角色参考图】',
    '当前节点使用以下角色参考图，生成时必须保持图中角色的视觉一致性：',
    ...refs.map((ref) => {
      const character = characterMap.get(ref.characterId)
      return lines([
        `- 角色：${character?.name ?? ref.characterId}`,
        `  - 参考类型：${kindLabel(ref)}`,
        ref.label && `  - 标签：${ref.label}`,
        `  - 参考图 URL：${ref.imageUrl}`,
        ref.sourceNodeId ? `  - 来源节点：${ref.sourceNodeId}` : null,
        `  - 一致性要求：保持脸型、发型、肤色、服装、气质、关键道具一致。不要改变年龄、发型、服装或道具。`,
      ]).join('\n')
    }),
    input.nodeKind === 'image'
      ? '生成要求：强制以上述参考图为视觉锚点，角色外貌必须与参考图高度一致。'
      : input.nodeKind === 'video'
        ? '生成要求：角色外观和服装必须与参考图一致。只增加运动、镜头、情绪和时间变化，不改变角色外貌。'
        : '生成要求：角色外貌需参考上述图片，保持视觉一致性。',
    input.edgeCharacterDirectives?.lockCharacterConsistency
      ? 'Edge Director 已开启角色锁定，角色参考图的优先级最高，必须严格遵守。'
      : null,
  ].filter(Boolean).join('\n\n')
}

function formatCharacterConsistency(input: CompileNodePromptInput) {
  const characters = input.characters?.filter((character) => character.name?.trim()) ?? []
  if (!characters.length) return ''
  return [
    '【角色一致性】',
    '当前节点绑定角色：',
    ...characters.map(formatCharacterItem),
    nodeCharacterStrategy(input),
  ].join('\n\n')
}

function sceneKeywordText(scene: SceneProfile) {
  return Array.isArray(scene.referenceKeywords)
    ? scene.referenceKeywords.filter(Boolean).join(', ')
    : ''
}

function formatSceneItem(scene: SceneProfile) {
  return lines([
    `- 场景名：${scene.name}`,
    scene.logline && `  - 一句话描述：${scene.logline}`,
    scene.location && `  - 地点：${scene.location}`,
    scene.era && `  - 时代：${scene.era}`,
    scene.atmosphere && `  - 氛围：${scene.atmosphere}`,
    scene.architecture && `  - 建筑/空间结构：${scene.architecture}`,
    scene.lighting && `  - 光线：${scene.lighting}`,
    scene.weather && `  - 天气：${scene.weather}`,
    scene.colorRules && `  - 色彩规则：${scene.colorRules}`,
    scene.keyObjects && `  - 关键物件：${scene.keyObjects}`,
    scene.continuityRules && `  - 连续性规则：${scene.continuityRules}`,
    scene.negativeRules && `  - 禁止变化项：${scene.negativeRules}`,
    sceneKeywordText(scene) && `  - 参考关键词：${sceneKeywordText(scene)}`,
  ]).join('\n')
}

function nodeSceneStrategy(input: CompileNodePromptInput) {
  const lockText = input.edgeSceneDirectives?.lockSceneConsistency
    ? '5. Edge Director 已开启场景连续，场景一致性的优先级提高。'
    : ''
  if (input.nodeKind === 'text') {
    return lines([
      '生成要求：',
      '1. 场景影响故事发生地点、氛围和事件设计。',
      '2. 必须保持场景结构、天气、光线、色彩和时代一致。',
      '3. 不要随意改变地点、昼夜、建筑类型或氛围。',
      lockText,
    ]).join('\n')
  }
  if (input.nodeKind === 'image') {
    return lines([
      '生成要求：',
      '1. 场景强影响视觉空间、光影、天气和建筑。',
      '2. 必须保持场景结构、天气、光线、色彩和时代一致。',
      '3. 如果生成图片，场景风格必须连续。',
      '4. 不要随意改变地点、昼夜、建筑类型或氛围。',
      lockText,
    ]).join('\n')
  }
  return lines([
    '生成要求：',
    '1. 场景强影响镜头运动中的空间连续性和环境动态。',
    '2. 必须保持场景结构、天气、光线、色彩和时代一致。',
    '3. 如果生成视频，场景风格必须连续。',
    '4. 不要随意改变地点、昼夜、建筑类型或氛围。',
    lockText,
  ]).join('\n')
}

function formatSceneConsistency(input: CompileNodePromptInput) {
  const scenes = input.scenes?.filter((scene) => scene.name?.trim()) ?? []
  if (!scenes.length) return ''
  return [
    '【场景一致性】',
    '当前节点绑定场景：',
    ...scenes.map(formatSceneItem),
    nodeSceneStrategy(input),
  ].join('\n\n')
}

function buildNodePrompt(input: CompileNodePromptInput, styleText: string, edgeDirectorText: string, characterText: string, characterRefText: string, sceneText: string, sceneEditText: string) {
  const userPrompt = input.userPrompt.trim()
  const upstreamText = truncate(input.upstreamText ?? '')
  const skillPrompt = input.enabledSkills
    .filter((skill) => skill.appliesTo.includes(input.nodeKind))
    .map((skill) => `- ${skill.name}: ${skill.promptInstruction}`)
    .join('\n')

  if (input.nodeKind === 'text') {
    return lines([
      '任务：生成可服务下游 Image / Video 的故事、脚本或分镜文本。',
      userPrompt && `用户原始需求：\n${userPrompt}`,
      upstreamText && `上游文本上下文：\n${upstreamText}`,
      edgeDirectorText,
      characterRefText,
      characterText,
      sceneText,
      sceneEditText,
      styleText && `项目风格圣经：\n${styleText}`,
      skillPrompt && `启用技能约束：\n${skillPrompt}`,
      '输出要求：结构清晰，保留人物、世界观、场景与因果连续性；如涉及分镜，请给出可直接转化为画面和镜头的描述。',
    ]).join('\n\n')
  }

  if (input.nodeKind === 'image') {
    return lines([
      '任务：生成适合图片生成模型的高质量视觉 prompt。',
      userPrompt && `用户原始需求：\n${userPrompt}`,
      upstreamText && `上游文本，请转化为具体视觉提示：\n${upstreamText}`,
      edgeDirectorText,
      characterRefText,
      characterText,
      sceneText,
      sceneEditText,
      styleText && `项目风格圣经，必须保留：\n${styleText}`,
      skillPrompt && `启用技能约束：\n${skillPrompt}`,
      '输出要求：聚焦主体、场景、构图、光线、色彩、质感、镜头和风格；保持人物/场景连续性；避免无关解释。',
    ]).join('\n\n')
  }

  return lines([
    '任务：生成适合视频生成模型的高质量镜头 prompt。',
    userPrompt && `用户原始需求：\n${userPrompt}`,
    upstreamText && `上游文本，作为动作、情绪和镜头描述：\n${upstreamText}`,
    input.upstreamImageUrl && `上游图片参考：保持该图像主体、构图、色调和场景关系一致。图片 URL: ${input.upstreamImageUrl}`,
    edgeDirectorText,
    characterRefText,
    characterText,
    sceneText,
    sceneEditText,
    styleText && `项目风格圣经，必须保留：\n${styleText}`,
    skillPrompt && `启用技能约束：\n${skillPrompt}`,
    '输出要求：明确主体动作、镜头运动、景别、速度、光影和情绪；保持与上游图像/文本的连续性；不要改变角色身份、服装或场景结构。',
  ]).join('\n\n')
}

export function compileNodePrompt(input: CompileNodePromptInput): CompiledNodePrompt {
  const styleText = formatStyleBible(input.styleBible)
  const appliedSkills = input.enabledSkills.filter((skill) => skill.appliesTo.includes(input.nodeKind))
  const edgeDirectorText = formatEdgeDirectives(input.edgeDirectives)
  const characterText = formatCharacterConsistency(input)
  const characterRefText = formatCharacterReferenceSection(input)
  const appliedRefs = collectCharacterReferences(input)
  const sceneText = formatSceneConsistency(input)
  const sceneEditText = formatSceneEditTasksForPrompt(input.sceneEditTasks ?? []) || formatSceneEditsForPrompt(input.sceneEdits ?? [])
  const prompt = buildNodePrompt(input, styleText, edgeDirectorText, characterText, characterRefText, sceneText, sceneEditText)
  const system = buildSystem(input, styleText)
  const characterMap = new Map((input.characters ?? []).map((c) => [c.id, c]))

  return {
    prompt,
    system,
    debug: {
      userPrompt: input.userPrompt,
      upstreamTextIncluded: Boolean(input.upstreamText?.trim()),
      upstreamImageIncluded: Boolean(input.upstreamImageUrl?.trim()),
      styleBibleIncluded: Boolean(styleText),
      skillsApplied: appliedSkills.map((skill) => skill.id),
      charactersApplied: (input.characters ?? []).map((character) => ({
        id: character.id,
        name: character.name,
      })),
      scenesApplied: (input.scenes ?? []).map((scene) => ({
        id: scene.id,
        name: scene.name,
      })),
      sceneEditsApplied: (input.sceneEdits ?? []).map((edit) => ({
        id: edit.id,
        tool: edit.tool,
        label: edit.label,
      })),
      sceneEditTasksApplied: (input.sceneEditTasks ?? []).map((task) => ({
        id: task.id,
        type: task.type,
        label: task.label,
      })),
      inheritedCharacterIdsFromEdges: input.edgeCharacterDirectives?.inheritedCharacterIdsFromEdges,
      inheritedSceneIdsFromEdges: input.edgeSceneDirectives?.inheritedSceneIdsFromEdges,
      characterConsistencyLocked: Boolean(input.edgeCharacterDirectives?.lockCharacterConsistency),
      sceneConsistencyLocked: Boolean(input.edgeSceneDirectives?.lockSceneConsistency),
      edgeDirectivesApplied: (input.edgeDirectives ?? []).map((directive) => ({
        sourceNodeId: directive.sourceNodeId,
        targetNodeId: directive.targetNodeId,
        type: directive.config.type,
        influenceWeight: directive.config.influenceWeight,
      })),
      characterReferencesApplied: appliedRefs.length
        ? appliedRefs.map((ref) => ({
            referenceId: ref.id,
            characterId: ref.characterId,
            characterName: characterMap.get(ref.characterId)?.name,
            kind: ref.kind,
            label: ref.label,
            imageUrl: ref.imageUrl,
            isHero: ref.isHero,
          }))
        : undefined,
    },
  }
}
