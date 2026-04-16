export type ProjectType = 'SHORT_FILM' | 'FEATURE_FILM' | 'WEB_SERIES' | 'DOCUMENTARY' | 'ANIMATION' | 'MUSIC_VIDEO' | 'COMMERCIAL' | 'INTERACTIVE';
export type ProjectStatus = 'DRAFT' | 'PRE_PRODUCTION' | 'IN_PRODUCTION' | 'POST_PRODUCTION' | 'COMPLETED' | 'PUBLISHED' | 'ARCHIVED';
export type ProjectVisibility = 'PRIVATE' | 'COLLABORATORS' | 'PUBLIC';
export type CollaboratorPermission = 'READ' | 'WRITE' | 'COMMENT' | 'MANAGE' | 'ADMIN';
export interface ProjectCollaborator {
    userId: string;
    role: string;
    permissions: CollaboratorPermission[];
    joinedAt: Date;
}
export interface ProductionPhase {
    id: string;
    projectId: string;
    name: string;
    order: number;
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
    startDate?: Date;
    endDate?: Date;
}
export interface ProjectBudget {
    total: number;
    spent: number;
    currency: 'CREDITS' | 'USD';
    breakdown: Record<string, number>;
}
export interface Milestone {
    id: string;
    title: string;
    dueDate: Date;
    completedAt?: Date;
    isCompleted: boolean;
}
export interface ProjectTimeline {
    startDate: Date;
    targetEndDate: Date;
    actualEndDate?: Date;
    milestones: Milestone[];
}
export interface ProjectStats {
    views: number;
    likes: number;
    shares: number;
    comments: number;
    rating: number;
    ratingCount: number;
}
export interface Project {
    id: string;
    title: string;
    description: string;
    type: ProjectType;
    status: ProjectStatus;
    visibility: ProjectVisibility;
    ownerId: string;
    collaborators: ProjectCollaborator[];
    phases: ProductionPhase[];
    assetIds: string[];
    tags: string[];
    genre: string[];
    budget?: ProjectBudget;
    timeline: ProjectTimeline;
    stats: ProjectStats;
    createdAt: Date;
    updatedAt: Date;
    publishedAt?: Date;
}
//# sourceMappingURL=project.d.ts.map