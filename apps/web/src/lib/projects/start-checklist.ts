import type { ProjectWorkflowTemplate } from '@/lib/templates/projectTemplates'
import type { ProjectStartChecklistCompletion } from '@/store/project-template.store'
import { getActionTarget } from '@/lib/routing/actions'

export type ChecklistCategory = 'template' | 'roles' | 'narrative' | 'storyboard' | 'delivery' | 'risk'
export type ChecklistStatus = 'todo' | 'ready' | 'done'

export interface ChecklistItem {
  id: string
  label: string
  description: string
  category: ChecklistCategory
  status: ChecklistStatus
  isBlocking: boolean
  actionLabel: string
  actionHref: string
}

export interface ProjectStartChecklistSummary {
  totalCount: number
  readyCount: number
  doneCount: number
  blockingCount: number
  nextRequiredStep: string
  aiSummary: string
}

export interface ProjectStartChecklist {
  projectId: string
  templateId: string
  items: ChecklistItem[]
  summary: ProjectStartChecklistSummary
}

function resolveStatus(isReady: boolean, isDone: boolean): ChecklistStatus {
  if (isDone) return 'done'
  if (isReady) return 'ready'
  return 'todo'
}

export function buildProjectStartChecklist(input: {
  projectId: string
  projectTitle: string
  template: ProjectWorkflowTemplate
  idea?: string
  currentStage?: string
  firstWorkflowTab?: string
  checklistCompletion?: ProjectStartChecklistCompletion
  hasDeliveryPackage?: boolean
  hasAccessibleNextAction?: boolean
}) : ProjectStartChecklist {
  const doneSet = new Set(input.checklistCompletion?.doneItemIds ?? [])
  const firstTab = input.firstWorkflowTab ?? input.template.defaultWorkflowTabs[0]
  const nextActionHref = getActionTarget({ actionType: 'project-workspace', projectId: input.projectId }).actionHref

  const items: ChecklistItem[] = [
    {
      id: 'template-selected',
      label: '已选择项目模板',
      description: `当前项目已绑定 ${input.template.name}，后续启动建议都会围绕这个模板展开。`,
      category: 'template',
      status: resolveStatus(Boolean(input.template.id), doneSet.has('template-selected')),
      isBlocking: true,
      actionLabel: '查看模板',
      actionHref: '/create#project-template-summary',
    },
    {
      id: 'roles-clarified',
      label: '已明确推荐角色',
      description: `建议优先确认 ${input.template.recommendedRoles.slice(0, 3).join(' / ')} 是否需要先加入项目。`,
      category: 'roles',
      status: resolveStatus(input.template.recommendedRoles.length > 0, doneSet.has('roles-clarified')),
      isBlocking: true,
      actionLabel: '去邀请团队',
      actionHref: getActionTarget({ actionType: 'project-team', projectId: input.projectId }).actionHref,
    },
    {
      id: 'narrative-defined',
      label: 'narrative / idea 已存在',
      description: '至少要有一个明确的项目 idea 或 narrative 方向，后面的分镜和节奏判断才有依据。',
      category: 'narrative',
      status: resolveStatus(Boolean(input.idea?.trim()), doneSet.has('narrative-defined')),
      isBlocking: true,
      actionLabel: '去开始创作',
      actionHref: nextActionHref,
    },
    {
      id: 'first-workflow-tab',
      label: '已确定首个 workflow tab',
      description: `当前建议从 ${firstTab} 开始，而不是一开始就在所有工作区来回切换。`,
      category: 'storyboard',
      status: resolveStatus(Boolean(firstTab), doneSet.has('first-workflow-tab')),
      isBlocking: true,
      actionLabel: '查看 Kickoff',
      actionHref: '/create#project-kickoff-summary',
    },
    {
      id: 'delivery-target-defined',
      label: '已明确交付目标',
      description: `当前模板建议的交付形式是 ${input.template.recommendedOutputs.join(' / ')}。`,
      category: 'delivery',
      status: resolveStatus(input.template.recommendedOutputs.length > 0 || Boolean(input.hasDeliveryPackage), doneSet.has('delivery-target-defined')),
      isBlocking: true,
      actionLabel: '查看交付建议',
      actionHref: '/create#project-kickoff-summary',
    },
    {
      id: 'main-risk-known',
      label: '已知主要风险',
      description: `当前最需要先盯住的是：${input.template.riskFocus[0] ?? '项目方向还需要进一步明确'}。`,
      category: 'risk',
      status: resolveStatus(input.template.riskFocus.length > 0, doneSet.has('main-risk-known')),
      isBlocking: false,
      actionLabel: '查看风险重点',
      actionHref: '/create#project-kickoff-summary',
    },
    {
      id: 'next-action-available',
      label: '已有可进入的下一步动作',
      description: input.currentStage && input.currentStage !== 'idea'
        ? `当前项目已在 ${input.currentStage} 阶段，下一步动作应与现有状态对齐。`
        : '项目已经有一个可以立即进入的下一步入口，不需要从零摸索。',
      category: 'template',
      status: resolveStatus(Boolean(input.hasAccessibleNextAction ?? true), doneSet.has('next-action-available')),
      isBlocking: false,
      actionLabel: '继续推进',
      actionHref: nextActionHref,
    },
  ]

  const readyCount = items.filter((item) => item.status === 'ready').length
  const doneCount = items.filter((item) => item.status === 'done').length
  const blockingCount = items.filter((item) => item.isBlocking && item.status === 'todo').length
  const nextRequiredItem = items.find((item) => item.isBlocking && item.status !== 'done') ?? items.find((item) => item.status === 'ready') ?? items[0]
  const summary: ProjectStartChecklistSummary = {
    totalCount: items.length,
    readyCount,
    doneCount,
    blockingCount,
    nextRequiredStep: nextRequiredItem?.label ?? '继续推进当前项目',
    aiSummary: blockingCount > 0
      ? `当前还有 ${blockingCount} 项关键启动条件没补齐，优先处理“${nextRequiredItem?.label ?? '启动检查项'}”。`
      : doneCount > 0
        ? `启动检查已经开始收口，下一步建议继续确认“${nextRequiredItem?.label ?? '当前入口'}”。`
        : `模板和启动条件已具备基础结构，建议先补齐“${nextRequiredItem?.label ?? '当前入口'}”。`,
  }

  return {
    projectId: input.projectId,
    templateId: input.template.id,
    items,
    summary,
  }
}
