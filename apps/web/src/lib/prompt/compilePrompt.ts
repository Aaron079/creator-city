import type { CompileNodePromptInput, CompiledNodePrompt } from './types'
import { EDGE_DIRECTOR_LABELS, type EdgeDirective } from '@/lib/canvas/edge-director'
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

function buildNodePrompt(input: CompileNodePromptInput, styleText: string, edgeDirectorText: string) {
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
    styleText && `项目风格圣经，必须保留：\n${styleText}`,
    skillPrompt && `启用技能约束：\n${skillPrompt}`,
    '输出要求：明确主体动作、镜头运动、景别、速度、光影和情绪；保持与上游图像/文本的连续性；不要改变角色身份、服装或场景结构。',
  ]).join('\n\n')
}

export function compileNodePrompt(input: CompileNodePromptInput): CompiledNodePrompt {
  const styleText = formatStyleBible(input.styleBible)
  const appliedSkills = input.enabledSkills.filter((skill) => skill.appliesTo.includes(input.nodeKind))
  const edgeDirectorText = formatEdgeDirectives(input.edgeDirectives)
  const prompt = buildNodePrompt(input, styleText, edgeDirectorText)
  const system = buildSystem(input, styleText)

  return {
    prompt,
    system,
    debug: {
      userPrompt: input.userPrompt,
      upstreamTextIncluded: Boolean(input.upstreamText?.trim()),
      upstreamImageIncluded: Boolean(input.upstreamImageUrl?.trim()),
      styleBibleIncluded: Boolean(styleText),
      skillsApplied: appliedSkills.map((skill) => skill.id),
      edgeDirectivesApplied: (input.edgeDirectives ?? []).map((directive) => ({
        sourceNodeId: directive.sourceNodeId,
        targetNodeId: directive.targetNodeId,
        type: directive.config.type,
        influenceWeight: directive.config.influenceWeight,
      })),
    },
  }
}
