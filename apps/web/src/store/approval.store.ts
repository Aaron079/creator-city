import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ApprovalRole =
  | 'director'
  | 'client'
  | 'producer'
  | 'editor'
  | 'cinematographer'
  | 'creator'

export type ApprovalTargetType =
  | 'project-brief'
  | 'sequence'
  | 'shot'
  | 'storyboard-frame'
  | 'role-bible'
  | 'video-shot'
  | 'editor-clip'
  | 'editor-timeline'
  | 'audio-timeline'
  | 'delivery'

export interface ApprovalDecision {
  id: string
  approvalId: string
  role: ApprovalRole
  userId: string
  status: 'approved' | 'changes-requested' | 'rejected'
  comment?: string
  versionId?: string
  createdAt: string
}

export interface ApprovalRequest {
  id: string
  targetType: ApprovalTargetType
  targetId: string
  title: string
  description?: string
  requiredRoles: ApprovalRole[]
  status: 'pending' | 'approved' | 'changes-requested' | 'rejected' | 'stale'
  decisions: ApprovalDecision[]
  linkedVersionId?: string
  createdBy: string
  createdAt: string
  resolvedAt?: string
}

export interface ApprovalGate {
  id: string
  stage: 'idea' | 'storyboard' | 'shooting' | 'editing' | 'delivery'
  name: string
  requiredApprovals: ApprovalRole[]
  status: 'open' | 'ready' | 'blocked' | 'needs-review'
}

export interface ApprovalSystemMessage {
  id: string
  content: string
  createdAt: string
}

interface ApprovalState {
  approvals: ApprovalRequest[]
  gates: ApprovalGate[]
  systemMessages: ApprovalSystemMessage[]
  createApprovalRequest: (
    targetType: ApprovalTargetType,
    targetId: string,
    requiredRoles: ApprovalRole[],
    options?: {
      title?: string
      description?: string
      linkedVersionId?: string
      createdBy?: string
    },
  ) => ApprovalRequest
  addApprovalDecision: (
    approvalId: string,
    decision: Omit<ApprovalDecision, 'id' | 'approvalId' | 'createdAt'>,
  ) => ApprovalRequest | null
  getApprovalsForTarget: (targetType: ApprovalTargetType, targetId: string) => ApprovalRequest[]
  getPendingApprovals: () => ApprovalRequest[]
  getApprovalGateForStage: (stage: ApprovalGate['stage']) => ApprovalGate | null
  upsertApprovalGate: (gate: ApprovalGate) => void
  markApprovalStale: (targetType: ApprovalTargetType, targetId: string) => void
  addSystemMessage: (content: string) => void
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function deriveApprovalStatus(request: ApprovalRequest): ApprovalRequest['status'] {
  const effectiveDecisions = request.requiredRoles
    .map((role) => request.decisions.filter((decision) => decision.role === role).at(-1))
    .filter((decision): decision is ApprovalDecision => Boolean(decision))

  if (effectiveDecisions.some((decision) => decision.status === 'rejected')) return 'rejected'
  if (effectiveDecisions.some((decision) => decision.status === 'changes-requested')) return 'changes-requested'
  if (
    request.requiredRoles.length > 0
    && request.requiredRoles.every((role) => effectiveDecisions.some((decision) => decision.role === role && decision.status === 'approved'))
  ) {
    return 'approved'
  }
  return 'pending'
}

export const useApprovalStore = create<ApprovalState>()(
  persist(
    (set, get) => ({
      approvals: [],
      gates: [],
      systemMessages: [],

      createApprovalRequest: (targetType, targetId, requiredRoles, options) => {
        const next: ApprovalRequest = {
          id: uid('approval'),
          targetType,
          targetId,
          title: options?.title ?? `${targetType} 确认`,
          description: options?.description,
          requiredRoles,
          status: 'pending',
          decisions: [],
          linkedVersionId: options?.linkedVersionId,
          createdBy: options?.createdBy ?? '我',
          createdAt: new Date().toISOString(),
        }
        set((state) => ({
          approvals: [next, ...state.approvals],
        }))
        return next
      },

      addApprovalDecision: (approvalId, decision) => {
        const current = get().approvals.find((approval) => approval.id === approvalId)
        if (!current) return null
        const nextDecision: ApprovalDecision = {
          ...decision,
          id: uid('approval-decision'),
          approvalId,
          createdAt: new Date().toISOString(),
        }
        const nextApproval: ApprovalRequest = {
          ...current,
          decisions: [
            ...current.decisions.filter((item) => item.role !== decision.role),
            nextDecision,
          ],
        }
        nextApproval.status = deriveApprovalStatus(nextApproval)
        nextApproval.resolvedAt = nextApproval.status === 'approved' || nextApproval.status === 'rejected'
          ? new Date().toISOString()
          : undefined
        set((state) => ({
          approvals: state.approvals.map((approval) => approval.id === approvalId ? nextApproval : approval),
        }))
        return nextApproval
      },

      getApprovalsForTarget: (targetType, targetId) => (
        get()
          .approvals
          .filter((approval) => approval.targetType === targetType && approval.targetId === targetId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      ),

      getPendingApprovals: () => (
        get().approvals.filter((approval) => approval.status === 'pending' || approval.status === 'stale' || approval.status === 'changes-requested')
      ),

      getApprovalGateForStage: (stage) => (
        get().gates.find((gate) => gate.stage === stage) ?? null
      ),

      upsertApprovalGate: (gate) => {
        set((state) => ({
          gates: state.gates.some((item) => item.id === gate.id)
            ? state.gates.map((item) => item.id === gate.id ? gate : item)
            : [gate, ...state.gates.filter((item) => item.stage !== gate.stage)],
        }))
      },

      markApprovalStale: (targetType, targetId) => {
        set((state) => ({
          approvals: state.approvals.map((approval) => (
            approval.targetType === targetType
              && approval.targetId === targetId
              && approval.status !== 'rejected'
              && approval.status !== 'stale'
              ? {
                  ...approval,
                  status: 'stale',
                  resolvedAt: undefined,
                }
              : approval
          )),
        }))
      },

      addSystemMessage: (content) => {
        set((state) => ({
          systemMessages: [
            {
              id: uid('approval-msg'),
              content,
              createdAt: new Date().toISOString(),
            },
            ...state.systemMessages,
          ],
        }))
      },
    }),
    { name: 'cc:approval-v1' },
  ),
)
