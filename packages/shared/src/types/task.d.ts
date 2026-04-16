export type AgentTaskType = 'WRITE_SCRIPT' | 'GENERATE_OUTLINE' | 'COMPOSE_MUSIC' | 'EDIT_VIDEO' | 'CREATE_VFX' | 'MARKET_ANALYSIS' | 'RESEARCH' | 'REVIEW';
export type AgentTaskStatus = 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export interface AgentTask {
    id: string;
    agentId: string;
    projectId: string;
    type: AgentTaskType;
    status: AgentTaskStatus;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    errorMessage?: string;
    startedAt?: Date;
    completedAt?: Date;
    estimatedDurationMs: number;
    actualDurationMs?: number;
    createdAt: Date;
}
export type PhaseTaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type PhaseTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export interface PhaseTask {
    id: string;
    phaseId: string;
    title: string;
    assignedAgentId?: string;
    assignedUserId?: string;
    status: PhaseTaskStatus;
    priority: PhaseTaskPriority;
    dueDate?: Date;
}
export interface TaskQueueItem<T = Record<string, unknown>> {
    id: string;
    type: string;
    payload: T;
    priority: number;
    attempts: number;
    maxAttempts: number;
    scheduledAt: Date;
    processedAt?: Date;
}
//# sourceMappingURL=task.d.ts.map