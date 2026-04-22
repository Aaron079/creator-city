import { create } from 'zustand'
import type { CanvasNode, CanvasEdge } from './canvas.store'
import type { ProParams } from '@/lib/ai/prompts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShotSnapshot {
  idea: string
  style: string
  intent?: string
  presetParams?: Partial<ProParams>
  cameraBrand?: string
  cameraModel?: string
  lensBrand?: string
  lensModel?: string
}

export interface SuggestionContext {
  templateId?: string
  templateCategory?: string
  narrativeType?: NarrativeType
  sequenceId?: string
  sequenceName?: string
  sequenceGoal?: string
  recommendedStyle?: string
  recommendedPacing?: string
  existingShots: Array<{
    id: string
    label: string
    idea: string
    intent?: string
  }>
}

export interface SequenceSuggestion {
  id: string
  title: string
  reasoning: string
  params: Partial<ProParams>
  intent: string
  fitsSequence: string
  expectedEffect: string
}

export interface InsightContext {
  templateId?: string
  templateCategory?: string
  narrativeType?: NarrativeType
  sequences: Array<{
    id: string
    name: string
    goal: string
    suggestedIntent?: string
    shotCount: number
  }>
  shots: Array<{
    id: string
    sequenceId: string
    label: string
    idea: string
    style: string
    intent?: string
    presetParams?: Partial<ProParams>
  }>
  recommendedStyle?: string
  recommendedPacing?: string
}

export interface NarrativeInsight {
  id: string
  level: 'info' | 'warning' | 'strong'
  type:
    | 'missing-sequence'
    | 'weak-sequence'
    | 'rhythm-problem'
    | 'style-mismatch'
    | 'intent-missing'
    | 'shot-repetition'
    | 'movement-repetition'
    | 'contrast-missing'
    | 'flat-rhythm'
    | 'weak-climax'
  title: string
  message: string
  targetSequenceId?: string
  targetShotId?: string
  suggestedAction: {
    label: string
    kind: 'open-suggestion' | 'focus-sequence' | 'focus-shot'
    panel?: 'ai' | 'insight' | 'gear' | 'camera' | 'lighting' | 'color' | 'movement' | 'style' | 'reference'
  }
}

export interface ShotSuggestion {
  id: string
  kind?: 'creative' | 'gear'
  shotId: string
  shotLabel: string
  title: string
  intent: string
  styleNote: string
  reasoning: string
  params?: Partial<ProParams>
  fitsSequence?: string
  expectedEffect?: string
  description?: string
  useWhen?: string
  avoidWhen?: string
  characteristics?: string[]
  bestFor?: string[]
  lookTags?: string[]
  externalAdapters?: Array<{
    name: string
    type: 'plugin' | 'api' | 'host-export'
    supportedHosts: string[]
    notes: string
  }>
  userActions?: string[]
  cinematicSkillId?: string
  cinematicSkillCategory?: 'vfx-motion' | 'composition' | 'editing-logic' | 'perspective' | 'color-look' | 'camera-language'
  applyTarget?: 'shot' | 'sequence' | 'editor-clip'
  targetSequenceId?: string
  targetClipId?: string
  compareFields?: Array<{
    label: string
    original: string
    suggested: string
  }>
  context?: SuggestionContext
  originalShot: ShotSnapshot
  suggestedShot: ShotSnapshot
}

export interface AppliedSuggestionResult {
  suggestionId: string
  appliedAt: string
  result: ShotSnapshot
}

export interface StoryboardFrame {
  id: string
  timecode: string
  sequenceId: string
  description: string
  intent?: string
  shotType: string
  angle: string
  movement: string
  focalLength: number
  lighting: string
  colorGrade: string
  imagePrompt: string
  imageUrl?: string
  status: 'draft' | 'selected' | 'discarded'
  linkedShotId?: string
  roleBibleId?: string
  consistencyKey?: string
  cameraBrand?: string
  cameraModel?: string
  lensBrand?: string
  lensModel?: string
  createdAt: string
}

export interface StoryboardPrevis {
  id: string
  sourceType: 'prompt' | 'image'
  sourcePrompt?: string
  sourceImageUrl?: string
  duration: number
  frameStyle: 'comic' | 'storyboard' | 'cinematic'
  aspectRatio: '16:9' | '9:16' | '1:1'
  frames: StoryboardFrame[]
  status: 'draft' | 'curated'
}

export interface ShotDerivativeJob {
  id: string
  storyboardFrameId: string
  sourceImageUrl?: string
  videoPrompt: string
  provider: 'mock' | 'runway' | 'seedance' | 'happyhorse' | 'kling'
  duration: 5 | 10 | 15
  movement: string
  motionStrength: number
  characterConsistency: boolean
  characterConsistencyScore: number
  styleConsistency: number
  roleBibleId?: string
  consistencyKey?: string
  status: 'idle' | 'queued' | 'running' | 'done' | 'failed'
  videoUrl?: string
  error?: string
}

export interface EditorClip {
  id: string
  sourceJobId: string
  sourceFrameId: string
  videoUrl: string
  title: string
  description: string
  order: number
  duration: number
  transition: 'cut' | 'fade' | 'dissolve' | 'match-cut' | 'jump-cut'
  pacing: 'slow' | 'medium' | 'fast'
  note?: string
  cinematicSkillIds?: string[]
}

export interface EditorTimeline {
  id: string
  clips: EditorClip[]
  pacingGoal: 'commercial-fast' | 'cinematic-slow' | 'emotional-wave' | 'documentary-natural'
  musicDirection?: string
  status: 'draft' | 'review' | 'locked'
}

export interface EditSuggestion {
  id: string
  type: 'opening-shot' | 'reorder' | 'transition' | 'pacing' | 'remove-repetition' | 'music-direction'
  title: string
  message: string
  targetClipId?: string
  suggestedAction: string
}

export interface ClipReviewIssue {
  id: string
  type: 'character-drift' | 'style-mismatch' | 'motion-artifact' | 'weak-narrative-fit' | 'editing-risk'
  message: string
  severity: 'info' | 'warning' | 'strong'
}

export interface ClipReviewRecommendation {
  id: string
  label: string
  action: 'accept' | 'regenerate' | 'adjust-motion' | 'change-provider' | 'edit-prompt' | 'send-to-editor' | 'open-casting'
  message: string
}

export interface ClipReview {
  id: string
  clipId: string
  sourceJobId: string
  sourceFrameId: string
  roleBibleId?: string
  consistencyKey?: string
  scores: {
    characterConsistency: number
    styleConsistency: number
    motionQuality: number
    narrativeFit: number
    editFit: number
    overall: number
  }
  status: 'usable' | 'needs-adjustment' | 'needs-regenerate' | 'not-recommended'
  issues: ClipReviewIssue[]
  recommendations: ClipReviewRecommendation[]
  createdAt: string
}

export interface CharacterBible {
  id: string
  name: string
  faceReference?: string
  wardrobe: string
  hair: string
  bodyType?: string
  visualTags: string[]
  consistencyKey: string
}

export interface RoleBible {
  id: string
  name: string
  roleType: 'lead' | 'supporting' | 'villain' | 'brand-spokesperson' | 'extra'
  personality: string
  motivation: string
  emotionalArc: string
  appearance: {
    ageRange: string
    hair: string
    wardrobe: string
    bodyType?: string
    visualTags: string[]
  }
  performanceStyle: {
    energy: 'low' | 'medium' | 'high'
    expression: 'subtle' | 'natural' | 'dramatic' | 'commercial'
    actingStyle: 'cinematic' | 'documentary' | 'advertising' | 'short-drama'
  }
  consistencyKey: string
  referenceImageUrl?: string
  status: 'draft' | 'locked'
}

export interface CastingSuggestion {
  id: string
  title: string
  roleType: RoleBible['roleType']
  personality: string
  appearanceDirection: string
  wardrobeDirection: string
  performanceDirection: string
  reasoning: string
  expectedEffect: string
  suggestedRoleBible: RoleBible
}

export interface StyleBible {
  id: string
  name: string
  colorGrade: string
  lighting: string
  cameraSignature?: string
  lensSignature?: string
  texture: string
  promptPrefix: string
}

export type NarrativeType = 'commercial' | 'story' | 'product' | 'cinematic'

export interface Sequence {
  id: string
  structureId: string
  name: string
  goal: string
  suggestedIntent?: string
  cinematicSkillIds?: string[]
  shotIds: string[]
}

export interface Narrative {
  id: string
  type: NarrativeType
  structure: string
  templateId?: string
  sequences: Sequence[]
}

export interface Shot {
  id: string
  label: string
  sequenceId: string
  /** Creative idea text for this shot */
  idea: string
  /** Visual style (e.g. "商业广告") */
  style: string
  /** Narrative purpose of this shot */
  intent?: string
  /** Explicit ordering index (default: array position) */
  order?: number
  /** Clip duration in seconds (derived from pro params) */
  duration?: number
  /** Per-shot camera/visual presets from template or manual override */
  presetParams?: Partial<ProParams>
  /** Output video URL from the video node */
  videoUrl?: string
  /** Keyframe thumbnail from the camera node */
  thumbnailUrl?: string
  /** Snapshot before AI suggestions are applied */
  originalVersion?: ShotSnapshot
  /** Pending AI suggestion candidates for this shot */
  suggestions?: ShotSuggestion[]
  /** Pending gear signature candidates for this shot */
  gearSuggestions?: ShotSuggestion[]
  /** Last applied suggestion result */
  appliedSuggestion?: AppliedSuggestionResult
  /** Last applied gear signature result */
  appliedGearSuggestion?: AppliedSuggestionResult
  /** Applied camera signature */
  cameraBrand?: string
  cameraModel?: string
  /** Applied lens signature */
  lensBrand?: string
  lensModel?: string
  /** Applied cinematic language skill registry ids */
  cinematicSkillIds?: string[]
  /** True when a full generation cycle has completed */
  isDone: boolean
  /** Serialized canvas node state for this shot */
  nodes: CanvasNode[]
  /** Serialized canvas edge state for this shot */
  edges: CanvasEdge[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 8)
}

function buildDefaultSequences(): Sequence[] {
  return [
    { id: `seq-${uid()}`, structureId: 'hook', name: 'Hook', goal: '快速建立注意力与第一印象', suggestedIntent: '建立环境', shotIds: [] },
    { id: `seq-${uid()}`, structureId: 'problem', name: 'Problem', goal: '明确问题、冲突或用户痛点', suggestedIntent: '制造冲突', shotIds: [] },
    { id: `seq-${uid()}`, structureId: 'solution', name: 'Solution', goal: '展示解决方案与价值兑现', suggestedIntent: '产品特写', shotIds: [] },
    { id: `seq-${uid()}`, structureId: 'cta', name: 'CTA', goal: '收束信息并推动下一步行动', suggestedIntent: '品牌展示', shotIds: [] },
  ]
}

function buildDefaultNarrative(type: NarrativeType = 'commercial'): Narrative {
  return {
    id: `nar-${uid()}`,
    type,
    structure: 'Classic 4-Beat',
    templateId: 'commercial-ad',
    sequences: buildDefaultSequences(),
  }
}

function makeShot(
  index: number,
  sequenceId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): Shot {
  return {
    id: `shot-${uid()}`,
    label: `Shot ${index + 1}`,
    sequenceId,
    idea: '',
    style: '商业广告',
    intent: '建立环境',
    videoUrl: undefined,
    thumbnailUrl: undefined,
    isDone: false,
    nodes: nodes.map((n) => ({ ...n })),
    edges: edges.map((e) => ({ ...e })),
  }
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface ShotsState {
  shots: Shot[]
  currentShotId: string
  narrative: Narrative | null

  /**
   * Called once from CanvasProvider on first mount.
   * Creates the first shot with the default canvas layout.
   */
  initShots: (defaultNodes: CanvasNode[], defaultEdges: CanvasEdge[]) => void

  /**
   * Add a new blank shot.
   * Returns the new shot's id (caller is responsible for switching to it).
   */
  addShot: (defaultNodes: CanvasNode[], defaultEdges: CanvasEdge[], sequenceId?: string) => string

  /**
   * Remove a shot. If it was the current shot, switches to the first remaining shot.
   * Does nothing when only one shot exists.
   */
  removeShot: (id: string) => void

  /** Serialize live canvas state into a shot snapshot. */
  saveCanvas: (id: string, nodes: CanvasNode[], edges: CanvasEdge[]) => void

  /** Update shot metadata (idea, style, order, duration, videoUrl, thumbnailUrl, isDone). */
  updateShot: (
    id: string,
    patch: Partial<Pick<Shot, 'idea' | 'style' | 'intent' | 'order' | 'duration' | 'videoUrl' | 'thumbnailUrl' | 'isDone' | 'presetParams' | 'originalVersion' | 'suggestions' | 'gearSuggestions' | 'appliedSuggestion' | 'appliedGearSuggestion' | 'cameraBrand' | 'cameraModel' | 'lensBrand' | 'lensModel' | 'cinematicSkillIds'>>
  ) => void

  /** Set the active shot id (does NOT load canvas — caller's responsibility). */
  setCurrentShotId: (id: string) => void
  setNarrativeType: (type: NarrativeType) => void
  setNarrative: (narrative: Narrative) => void

  /**
   * Wipe all shots and rebuild from template shot definitions.
   * Returns the id of the first new shot.
   */
  resetShots: (
    defs: Array<{ idea: string; label: string; intent?: string; presetParams?: Partial<ProParams>; sequenceStructureId?: string }>,
    style: string,
    defaultNodes: CanvasNode[],
    defaultEdges: CanvasEdge[],
    narrativeTemplate?: Omit<Narrative, 'id' | 'sequences'> & {
      sequences: Array<Omit<Sequence, 'id' | 'shotIds'>>
    }
  ) => string
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useShotsStore = create<ShotsState>((set, get) => ({
  shots: [],
  currentShotId: '',
  narrative: null,

  initShots: (defaultNodes, defaultEdges) => {
    if (get().shots.length > 0) return
    const narrative = buildDefaultNarrative('commercial')
    const firstSequence = narrative.sequences[0]
    const first = makeShot(0, firstSequence?.id ?? '', defaultNodes, defaultEdges)
    set({
      narrative: {
        ...narrative,
        sequences: narrative.sequences.map((sequence, index) =>
          index === 0 ? { ...sequence, shotIds: [first.id] } : sequence
        ),
      },
      shots: [first],
      currentShotId: first.id,
    })
  },

  addShot: (defaultNodes, defaultEdges, sequenceId) => {
    const { shots, narrative } = get()
    const targetSequenceId = sequenceId ?? narrative?.sequences[0]?.id ?? ''
    const next = makeShot(shots.length, targetSequenceId, defaultNodes, defaultEdges)
    set((s) => ({
      shots: [...s.shots, next],
      narrative: s.narrative
        ? {
            ...s.narrative,
            sequences: s.narrative.sequences.map((sequence) =>
              sequence.id === targetSequenceId
                ? { ...sequence, shotIds: [...sequence.shotIds, next.id] }
                : sequence
            ),
          }
        : s.narrative,
    }))
    return next.id
  },

  removeShot: (id) => {
    const { shots, currentShotId } = get()
    if (shots.length <= 1) return
    const remaining = shots.filter((s) => s.id !== id)
    const newCurrentId =
      currentShotId === id ? (remaining[0]?.id ?? '') : currentShotId
    set((s) => ({
      shots: remaining,
      currentShotId: newCurrentId,
      narrative: s.narrative
        ? {
            ...s.narrative,
            sequences: s.narrative.sequences.map((sequence) => ({
              ...sequence,
              shotIds: sequence.shotIds.filter((shotId) => shotId !== id),
            })),
          }
        : s.narrative,
    }))
  },

  saveCanvas: (id, nodes, edges) => {
    set((s) => ({
      shots: s.shots.map((shot) =>
        shot.id === id
          ? { ...shot, nodes: nodes.map((n) => ({ ...n })), edges: edges.map((e) => ({ ...e })) }
          : shot
      ),
    }))
  },

  updateShot: (id, patch) => {
    set((s) => ({
      shots: s.shots.map((shot) =>
        shot.id === id ? { ...shot, ...patch } : shot
      ),
    }))
  },

  setCurrentShotId: (id) => set({ currentShotId: id }),

  setNarrativeType: (type) => {
    set((s) => ({
      narrative: s.narrative ? { ...s.narrative, type } : buildDefaultNarrative(type),
    }))
  },

  setNarrative: (narrative) => set({ narrative }),

  resetShots: (defs, style, defaultNodes, defaultEdges, narrativeTemplate) => {
    const narrativeBase: Narrative = narrativeTemplate
      ? {
          id: `nar-${uid()}`,
          type: narrativeTemplate.type,
          structure: narrativeTemplate.structure,
          templateId: narrativeTemplate.templateId,
          sequences: narrativeTemplate.sequences.map((sequence) => ({
            ...sequence,
            id: `seq-${uid()}`,
            shotIds: [],
          })),
        }
      : buildDefaultNarrative('commercial')

    const newShots = defs.map((def, i) => {
      const matchedSequence = def.sequenceStructureId
        ? narrativeBase.sequences.find((sequence) => sequence.structureId === def.sequenceStructureId)
        : undefined
      const sequenceId = matchedSequence?.id
        ?? narrativeBase.sequences[Math.min(i, narrativeBase.sequences.length - 1)]?.id
        ?? narrativeBase.sequences[0]?.id
        ?? ''
      const sequenceIntent = narrativeBase.sequences.find((sequence) => sequence.id === sequenceId)?.suggestedIntent
      return {
        ...makeShot(i, sequenceId, defaultNodes, defaultEdges),
        label: def.label,
        idea: def.idea,
        style,
        intent: def.intent ?? sequenceIntent ?? '建立环境',
        presetParams: def.presetParams,
      }
    })
    const sequences = narrativeBase.sequences.map((sequence) => ({
      ...sequence,
      shotIds: newShots.filter((shot) => shot.sequenceId === sequence.id).map((shot) => shot.id),
    }))
    const firstId = newShots[0]?.id ?? ''
    set({ shots: newShots, currentShotId: firstId, narrative: { ...narrativeBase, sequences } })
    return firstId
  },
}))
