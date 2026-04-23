import type { ProjectTemplateRecommendation, ProjectWorkflowTemplate } from '@/lib/templates/projectTemplates'
import { getActionTarget } from '@/lib/routing/actions'

export interface ProjectKickoffAction {
  id: string
  label: string
  href: string
  detail: string
}

export interface ProjectKickoffSummary {
  projectId: string
  projectTitle: string
  templateId: string
  templateName: string
  templateCategory: ProjectWorkflowTemplate['category']
  summary: string
  recommendedRoles: string[]
  recommendedFirstSteps: string[]
  recommendedOutputs: string[]
  riskFocus: string[]
  nextSuggestedAction: string
  aiSummary: string
  quickActions: ProjectKickoffAction[]
}

function humanizeWorkflowTab(tab: ProjectWorkflowTemplate['defaultWorkflowTabs'][number]) {
  switch (tab) {
    case 'canvas':
      return '创作画布'
    case 'previs':
      return '分镜预演'
    case 'footage':
      return '视频镜头'
    case 'editor':
      return '剪辑台'
    case 'audio':
      return '声音台'
    case 'delivery':
      return '交付'
    default:
      return tab
  }
}

function buildRecommendedFirstSteps(input: {
  template: ProjectWorkflowTemplate
  currentStage?: string
  hasShotIdeas?: boolean
  hasDeliveryPackage?: boolean
}) {
  const steps: string[] = []

  if (!input.hasShotIdeas) {
    steps.push('先把项目 brief 和核心创意写清楚，再进入模板对应的第一段结构。')
  }

  steps.push(`优先确认 ${input.template.recommendedRoles.slice(0, 3).join(' / ')} 是否需要尽早介入。`)
  steps.push(`先从 ${input.template.defaultWorkflowTabs.slice(0, 3).map(humanizeWorkflowTab).join(' → ')} 开始，建立起项目的第一轮产出骨架。`)

  if (input.currentStage && input.currentStage !== 'idea') {
    steps.push(`当前项目已经在 ${input.currentStage} 阶段，Kickoff 更适合作为补充对齐单，而不是完全从零启动。`)
  } else {
    steps.push('在进入 review / delivery 之前，先用模板风险重点检查一次项目是否偏航。')
  }

  if (input.hasDeliveryPackage) {
    steps.push('当前项目已经存在交付包，启动建议要优先与现有交付结构对齐。')
  }

  return steps.slice(0, 3)
}

export function buildProjectKickoffSummary(input: {
  projectId: string
  projectTitle: string
  template: ProjectWorkflowTemplate
  currentStage?: string
  hasShotIdeas?: boolean
  hasDeliveryPackage?: boolean
  recommendation?: ProjectTemplateRecommendation
}): ProjectKickoffSummary {
  const recommendedFirstSteps = buildRecommendedFirstSteps({
    template: input.template,
    currentStage: input.currentStage,
    hasShotIdeas: input.hasShotIdeas,
    hasDeliveryPackage: input.hasDeliveryPackage,
  })

  const quickActions: ProjectKickoffAction[] = [
    {
      id: 'kickoff-create',
      label: '去开始创作',
      href: getActionTarget({ actionType: 'project-workspace', projectId: input.projectId }).actionHref,
      detail: '继续在当前模板上下文里推进创作。',
    },
    {
      id: 'kickoff-home',
      label: '去看项目首页',
      href: getActionTarget({ actionType: 'project-home', projectId: input.projectId }).actionHref,
      detail: '查看项目首页里的角色化摘要和后续入口。',
    },
    {
      id: 'kickoff-team',
      label: '去邀请团队',
      href: getActionTarget({ actionType: 'project-team', projectId: input.projectId }).actionHref,
      detail: '如果你是 producer，可从这里开始补角色。',
    },
  ]

  const nextSuggestedAction = recommendedFirstSteps[0] ?? '先完成项目 brief 和第一轮创作方向确认。'
  const aiSummary = input.recommendation
    ? `${input.template.name} 适合当前项目；优先注意 ${input.template.riskFocus[0]}，并先推进 ${recommendedFirstSteps[0] ?? '项目骨架搭建'}。`
    : `当前模板建议先推进 ${recommendedFirstSteps[0] ?? '项目骨架搭建'}，同时重点关注 ${input.template.riskFocus[0]}。`

  return {
    projectId: input.projectId,
    projectTitle: input.projectTitle,
    templateId: input.template.id,
    templateName: input.template.name,
    templateCategory: input.template.category,
    summary: input.template.summary,
    recommendedRoles: input.template.recommendedRoles,
    recommendedFirstSteps,
    recommendedOutputs: input.template.recommendedOutputs,
    riskFocus: input.template.riskFocus,
    nextSuggestedAction,
    aiSummary,
    quickActions,
  }
}
