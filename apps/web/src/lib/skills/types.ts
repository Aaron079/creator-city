export type CreatorSkillCategory =
  | 'story'
  | 'visual'
  | 'color'
  | 'camera'
  | 'character'
  | 'scene'
  | 'continuity'

export type CreatorSkillTarget = 'text' | 'image' | 'video'

export type CreatorSkill = {
  id: string
  name: string
  category: CreatorSkillCategory
  description: string
  systemInstruction: string
  promptInstruction: string
  appliesTo: CreatorSkillTarget[]
  enabledByDefault: boolean
}

export type ProjectStyleBible = {
  logline?: string
  storyWorld?: string
  visualStyle?: string
  colorPalette?: string
  cameraLanguage?: string
  characterRules?: string
  sceneRules?: string
  negativeRules?: string
  referenceKeywords?: string[]
  updatedAt?: string
}

export type CreatorSkillExecutionPolicy =
  | 'deterministic-local'
  | 'self-hosted-optional'
  | 'external-media'

export type CreatorSkillRunStatus = 'ready' | 'needs-review' | 'blocked'

export type CreatorSkillReviewStatus = 'pending' | 'approved' | 'rejected'

export type CreatorSkillManifest = {
  id: string
  version: number
  name: string
  description: string
  category: string
  executionPolicy: CreatorSkillExecutionPolicy
  acceptedNodeKinds: string[]
  acceptedArtifactTypes: string[]
  outputArtifactTypes: string[]
  independentlyCallable: true
}

export type CreatorSkillSourceNode = {
  id: string
  kind: string
  title: string
  prompt: string
  resultText?: string
  metadataJson?: unknown
}

export type CreatorSkillProjectContext = {
  projectId?: string
  workflowId?: string
}

export type CreatorSkillArtifact<T = unknown> = {
  artifactId: string
  type: string
  version: number
  sourceNodeIds: string[]
  sourceArtifactIds: string[]
  payload: T
}

export type CreatorSkillEvidence = {
  evidenceId: string
  ruleId: string
  sourceNodeId: string
  lineStart: number
  lineEnd: number
  excerpt: string
  explanation: string
}

export type CreatorSkillIssue = {
  code: string
  message: string
  sourceNodeId?: string
  artifactId?: string
}

export type CreatorSkillRunInput = {
  sourceNodes: CreatorSkillSourceNode[]
  artifacts?: CreatorSkillArtifact[]
  projectContext?: CreatorSkillProjectContext
  options?: Record<string, unknown>
}

export type CreatorSkillRunResult = {
  skillId: string
  version: number
  fingerprint: string
  status: CreatorSkillRunStatus
  artifacts: CreatorSkillArtifact[]
  evidence: CreatorSkillEvidence[]
  warnings: CreatorSkillIssue[]
  blockers: CreatorSkillIssue[]
}

export type CreatorExecutableSkill = {
  manifest: CreatorSkillManifest
  run: (
    input: CreatorSkillRunInput,
    fingerprint: string,
  ) => CreatorSkillRunResult | Promise<CreatorSkillRunResult>
}
