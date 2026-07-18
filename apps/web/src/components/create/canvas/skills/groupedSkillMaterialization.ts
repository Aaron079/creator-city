import type {
  CreatorSkillArtifact,
  CreatorSkillEvidence,
  CreatorSkillNodeMetadata,
  CreatorSkillRunResult,
} from '../../../../lib/skills/types'
import type {
  NarrativeBeatDraft,
  NarrativeBeatType,
} from '../../../../lib/skills/narrative-beat-analysis/types'
import type {
  PlannedShotSize,
  ShotOutputKind,
  ShotPlanDraft,
} from '../../../../lib/skills/shot-planning/types'

const RUN_FINGERPRINT = /^csf1_[0-9a-f]{8}$/

type ApprovalContext = {
  runFingerprint: string
  sourceArtifactId: string
}

type ExistingNode = { metadataJson?: unknown }

export type ApprovedNarrativeBeat = Omit<NarrativeBeatDraft, 'reviewStatus'> & {
  reviewStatus: 'approved'
}

export type ApprovedNarrativeBeatScene = {
  sceneId: string
  order: number
  heading: string
  beats: ApprovedNarrativeBeat[]
}

export type ApprovedShotPlan = Omit<ShotPlanDraft, 'reviewStatus'> & {
  reviewStatus: 'approved'
}

export type ApprovedShotPlanScene = {
  sceneId: string
  order: number
  heading: string
  shots: ApprovedShotPlan[]
}

export type GroupedSkillNodePlan = {
  resultId: string
  title: string
  prompt: string
  metadataJson: CreatorSkillNodeMetadata & {
    creatorSkill: CreatorSkillNodeMetadata['creatorSkill'] & {
      resultType: 'narrative-beat-map' | 'shot-plan'
      approvedArtifact: CreatorSkillArtifact
    }
  }
}

export type GroupedMaterializationResult = {
  create: GroupedSkillNodePlan[]
  duplicates: string[]
}

export type NarrativeBeatMaterializationInput = {
  result: CreatorSkillRunResult
  approvalContext: ApprovalContext
  approvedScenes: ApprovedNarrativeBeatScene[]
  existingNodes: ExistingNode[]
}

export type ShotPlanMaterializationInput = {
  result: CreatorSkillRunResult
  approvalContext: ApprovalContext
  approvedScenes: ApprovedShotPlanScene[]
  existingNodes: ExistingNode[]
}

type OptionalString = { present: boolean; value: string | undefined }

type BeatSnapshot = {
  beatId: string
  sceneId: string
  order: number
  type: NarrativeBeatType
  sourceText: string
  summary: string
  lineStart: number
  lineEnd: number
  reviewStatus: 'pending' | 'approved'
  needsReviewReason: OptionalString
}

type NarrativeSceneSnapshot = {
  sceneId: string
  order: number
  heading: string
  beats: BeatSnapshot[]
}

type ShotSnapshot = {
  shotId: string
  sceneId: string
  beatId: OptionalString
  order: number
  objective: string
  subject: string
  action: string
  suggestedShotSize: PlannedShotSize
  sourceText: string
  lineStart: number
  lineEnd: number
  outputKind: ShotOutputKind
  duration: 5 | 10
  reviewStatus: 'pending' | 'approved'
  needsReviewReason: OptionalString
}

type ShotSceneSnapshot = {
  sceneId: string
  order: number
  heading: string
  shots: ShotSnapshot[]
}

type ArtifactSnapshot<TScene> = {
  artifactId: string
  sourceNodeIds: string[]
  scenes: TScene[]
}

type ResultSnapshot = {
  skillId: string
  skillVersion: string
  runFingerprint: string
  status: string
  artifacts: unknown
  evidence: unknown
}

const MISSING = Symbol('missing')

function fail(message: string): never {
  throw new TypeError(message)
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requireRecord(value: unknown, field: string): Record<PropertyKey, unknown> {
  if (!isRecord(value)) fail(`${field} must be an object`)
  return value
}

function ownData(record: object, key: PropertyKey, field: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    fail(`${field} must be an own data property`)
  }
  return descriptor.value
}

function tryOwnData(record: unknown, key: PropertyKey): unknown | typeof MISSING {
  if (!isRecord(record)) return MISSING
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key)
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      return MISSING
    }
    return descriptor.value
  } catch {
    return MISSING
  }
}

function stringValue(record: object, key: PropertyKey, field: string) {
  const value = ownData(record, key, field)
  if (typeof value !== 'string') fail(`${field} must be a string`)
  return value
}

function identifier(record: object, key: PropertyKey, field: string) {
  const value = stringValue(record, key, field)
  if (!value || value !== value.trim()) fail(`${field} must be a trimmed nonempty string`)
  return value
}

function positiveInteger(record: object, key: PropertyKey, field: string) {
  const value = ownData(record, key, field)
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    fail(`${field} must be a positive safe integer`)
  }
  return value as number
}

function enumString<T extends string>(
  record: object,
  key: PropertyKey,
  field: string,
  values: readonly T[],
): T {
  const value = stringValue(record, key, field)
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === value) return value as T
  }
  return fail(`${field} is invalid`)
}

function optionalString(record: object, key: PropertyKey, field: string): OptionalString {
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  if (!descriptor) {
    if (key in record) fail(`${field} must not be inherited`)
    return { present: false, value: undefined }
  }
  if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    fail(`${field} must be an own data property`)
  }
  if (descriptor.value !== undefined && typeof descriptor.value !== 'string') {
    fail(`${field} must be a string when present`)
  }
  return { present: true, value: descriptor.value as string | undefined }
}

function denseArray<T>(value: unknown, field: string): T[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`)
  const length = ownData(value, 'length', `${field}.length`)
  if (!Number.isSafeInteger(length) || (length as number) < 0) {
    fail(`${field}.length is invalid`)
  }
  const result = new Array<T>(length as number)
  for (let index = 0; index < result.length; index += 1) {
    result[index] = ownData(value, index, `${field}[${index}]`) as T
  }
  return result
}

function identifierArray(value: unknown, field: string) {
  const values = denseArray<unknown>(value, field)
  const result = new Array<string>(values.length)
  let previous: string | undefined
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (typeof value !== 'string' || !value || value !== value.trim()) {
      fail(`${field} must contain trimmed nonempty strings`)
    }
    if (previous !== undefined && previous >= value) {
      fail(`${field} must be sorted and unique`)
    }
    result[index] = value
    previous = value
  }
  return result
}

function snapshotResult(value: unknown): ResultSnapshot {
  const result = requireRecord(value, 'result')
  return {
    skillId: identifier(result, 'skillId', 'result.skillId'),
    skillVersion: identifier(result, 'skillVersion', 'result.skillVersion'),
    runFingerprint: identifier(result, 'runFingerprint', 'result.runFingerprint'),
    status: stringValue(result, 'status', 'result.status'),
    artifacts: ownData(result, 'artifacts', 'result.artifacts'),
    evidence: ownData(result, 'evidence', 'result.evidence'),
  }
}

function snapshotContext(value: unknown): ApprovalContext {
  const context = requireRecord(value, 'approvalContext')
  return {
    runFingerprint: identifier(context, 'runFingerprint', 'approvalContext.runFingerprint'),
    sourceArtifactId: identifier(context, 'sourceArtifactId', 'approvalContext.sourceArtifactId'),
  }
}

function snapshotEvidence(value: unknown): CreatorSkillEvidence {
  const item = requireRecord(value, 'evidence')
  const lineStart = positiveInteger(item, 'lineStart', 'evidence.lineStart')
  const lineEnd = positiveInteger(item, 'lineEnd', 'evidence.lineEnd')
  if (lineEnd < lineStart) fail('evidence line range is invalid')
  return {
    evidenceId: identifier(item, 'evidenceId', 'evidence.evidenceId'),
    ruleId: identifier(item, 'ruleId', 'evidence.ruleId'),
    sourceNodeId: identifier(item, 'sourceNodeId', 'evidence.sourceNodeId'),
    lineStart,
    lineEnd,
    excerpt: stringValue(item, 'excerpt', 'evidence.excerpt'),
    explanation: stringValue(item, 'explanation', 'evidence.explanation'),
  }
}

function cloneEvidence(value: CreatorSkillEvidence): CreatorSkillEvidence {
  return { ...value }
}

function sameOptional(left: OptionalString, right: OptionalString) {
  return left.value === right.value
}

function snapshotBeat(value: unknown, status: 'pending' | 'approved'): BeatSnapshot {
  const beat = requireRecord(value, 'beat')
  const lineStart = positiveInteger(beat, 'lineStart', 'beat.lineStart')
  const lineEnd = positiveInteger(beat, 'lineEnd', 'beat.lineEnd')
  if (lineEnd < lineStart) fail('beat line range is invalid')
  const reviewStatus = enumString(beat, 'reviewStatus', 'beat.reviewStatus', ['pending', 'approved'] as const)
  if (reviewStatus !== status) fail(`beat.reviewStatus must be ${status}`)
  return {
    beatId: identifier(beat, 'beatId', 'beat.beatId'),
    sceneId: identifier(beat, 'sceneId', 'beat.sceneId'),
    order: positiveInteger(beat, 'order', 'beat.order'),
    type: enumString(beat, 'type', 'beat.type', [
      'setup', 'goal', 'action', 'reaction', 'turn', 'closure', 'unclassified',
    ] as const),
    sourceText: stringValue(beat, 'sourceText', 'beat.sourceText'),
    summary: stringValue(beat, 'summary', 'beat.summary'),
    lineStart,
    lineEnd,
    reviewStatus,
    needsReviewReason: optionalString(beat, 'needsReviewReason', 'beat.needsReviewReason'),
  }
}

function snapshotNarrativeScene(value: unknown, status: 'pending' | 'approved') {
  const scene = requireRecord(value, 'narrative scene')
  const sceneId = identifier(scene, 'sceneId', 'scene.sceneId')
  const beats = denseArray<unknown>(ownData(scene, 'beats', 'scene.beats'), 'scene.beats')
    .map((beat) => snapshotBeat(beat, status))
  const ids = new Set<string>()
  const orders = new Set<number>()
  for (let index = 0; index < beats.length; index += 1) {
    if (beats[index]!.sceneId !== sceneId) fail('beat scene identity is invalid')
    if (ids.has(beats[index]!.beatId) || orders.has(beats[index]!.order)) {
      fail('beat IDs and orders must be unique')
    }
    ids.add(beats[index]!.beatId)
    orders.add(beats[index]!.order)
  }
  return {
    sceneId,
    order: positiveInteger(scene, 'order', 'scene.order'),
    heading: stringValue(scene, 'heading', 'scene.heading'),
    beats,
  }
}

function snapshotShot(value: unknown, status: 'pending' | 'approved'): ShotSnapshot {
  const shot = requireRecord(value, 'shot')
  const lineStart = positiveInteger(shot, 'lineStart', 'shot.lineStart')
  const lineEnd = positiveInteger(shot, 'lineEnd', 'shot.lineEnd')
  if (lineEnd < lineStart) fail('shot line range is invalid')
  const reviewStatus = enumString(shot, 'reviewStatus', 'shot.reviewStatus', ['pending', 'approved'] as const)
  if (reviewStatus !== status) fail(`shot.reviewStatus must be ${status}`)
  const duration = ownData(shot, 'duration', 'shot.duration')
  if (duration !== 5 && duration !== 10) fail('shot.duration is invalid')
  return {
    shotId: identifier(shot, 'shotId', 'shot.shotId'),
    sceneId: identifier(shot, 'sceneId', 'shot.sceneId'),
    beatId: optionalString(shot, 'beatId', 'shot.beatId'),
    order: positiveInteger(shot, 'order', 'shot.order'),
    objective: stringValue(shot, 'objective', 'shot.objective'),
    subject: stringValue(shot, 'subject', 'shot.subject'),
    action: stringValue(shot, 'action', 'shot.action'),
    suggestedShotSize: enumString(shot, 'suggestedShotSize', 'shot.suggestedShotSize', [
      'wide', 'full', 'medium', 'close', 'extreme-close',
    ] as const),
    sourceText: stringValue(shot, 'sourceText', 'shot.sourceText'),
    lineStart,
    lineEnd,
    outputKind: enumString(shot, 'outputKind', 'shot.outputKind', ['image', 'video'] as const),
    duration,
    reviewStatus,
    needsReviewReason: optionalString(shot, 'needsReviewReason', 'shot.needsReviewReason'),
  }
}

function snapshotShotScene(value: unknown, status: 'pending' | 'approved') {
  const scene = requireRecord(value, 'shot scene')
  const sceneId = identifier(scene, 'sceneId', 'scene.sceneId')
  const shots = denseArray<unknown>(ownData(scene, 'shots', 'scene.shots'), 'scene.shots')
    .map((shot) => snapshotShot(shot, status))
  const ids = new Set<string>()
  const orders = new Set<number>()
  for (let index = 0; index < shots.length; index += 1) {
    if (shots[index]!.sceneId !== sceneId) fail('shot scene identity is invalid')
    if (ids.has(shots[index]!.shotId) || orders.has(shots[index]!.order)) {
      fail('shot IDs and orders must be unique')
    }
    ids.add(shots[index]!.shotId)
    orders.add(shots[index]!.order)
  }
  return {
    sceneId,
    order: positiveInteger(scene, 'order', 'scene.order'),
    heading: stringValue(scene, 'heading', 'scene.heading'),
    shots,
  }
}

function snapshotArtifact<TScene>(
  artifactsValue: unknown,
  artifactType: 'narrative-beat-map' | 'shot-plan',
  sceneKey: 'beats' | 'shots',
  sceneSnapshot: (value: unknown, status: 'pending') => TScene,
): ArtifactSnapshot<TScene> {
  const artifacts = denseArray<unknown>(artifactsValue, 'result.artifacts')
  let found: ArtifactSnapshot<TScene> | undefined
  for (let index = 0; index < artifacts.length; index += 1) {
    const candidate = artifacts[index]
    if (tryOwnData(candidate, 'artifactType') !== artifactType) continue
    if (found) fail(`result must contain exactly one ${artifactType} Artifact`)
    const artifact = requireRecord(candidate, `${artifactType} Artifact`)
    if (ownData(artifact, 'artifactVersion', 'Artifact.artifactVersion') !== 1) {
      fail('Artifact version is invalid')
    }
    const sourceNodeIds = identifierArray(
      ownData(artifact, 'sourceNodeIds', 'Artifact.sourceNodeIds'),
      'Artifact.sourceNodeIds',
    )
    if (sourceNodeIds.length === 0) fail('Artifact sourceNodeIds must be nonempty')
    identifierArray(
      ownData(artifact, 'sourceArtifactIds', 'Artifact.sourceArtifactIds'),
      'Artifact.sourceArtifactIds',
    )
    const payload = requireRecord(ownData(artifact, 'payload', 'Artifact.payload'), 'Artifact.payload')
    const scenesValue = denseArray<unknown>(
      ownData(payload, 'scenes', 'Artifact.payload.scenes'),
      'Artifact.payload.scenes',
    )
    if (scenesValue.length === 0) fail('Artifact scenes must be nonempty')
    const scenes = scenesValue.map((scene) => sceneSnapshot(scene, 'pending'))
    const sceneIds = new Set<string>()
    const sceneOrders = new Set<number>()
    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
      const scene = scenes[sceneIndex] as TScene & { sceneId: string; order: number }
      if (sceneIds.has(scene.sceneId) || sceneOrders.has(scene.order)) {
        fail('Artifact scene IDs and orders must be unique')
      }
      if (!Object.prototype.hasOwnProperty.call(scene, sceneKey)) fail('Artifact scene shape is invalid')
      sceneIds.add(scene.sceneId)
      sceneOrders.add(scene.order)
    }
    found = {
      artifactId: identifier(artifact, 'artifactId', 'Artifact.artifactId'),
      sourceNodeIds,
      scenes,
    }
  }
  if (!found) fail(`result must contain exactly one ${artifactType} Artifact`)
  return found
}

function validateIdentity(
  result: ResultSnapshot,
  context: ApprovalContext,
  artifactId: string,
  skillId: string,
) {
  if (result.skillId !== skillId || result.skillVersion !== '1.0.0') {
    fail('result Skill identity is invalid')
  }
  if (result.status !== 'ready' && result.status !== 'needs-review') {
    fail('result status is invalid for materialization')
  }
  if (!RUN_FINGERPRINT.test(result.runFingerprint)) fail('result fingerprint is invalid')
  if (context.runFingerprint !== result.runFingerprint || context.sourceArtifactId !== artifactId) {
    fail('approvalContext does not match the analyzed result')
  }
}

function evidenceById(value: unknown, sourceNodeIds: string[]) {
  const values = denseArray<unknown>(value, 'result.evidence')
  const result = new Map<string, CreatorSkillEvidence>()
  const allowedSources = new Set(sourceNodeIds)
  for (let index = 0; index < values.length; index += 1) {
    const item = snapshotEvidence(values[index])
    if (result.has(item.evidenceId)) fail('evidence IDs must be unique')
    if (!allowedSources.has(item.sourceNodeId)) fail('evidence source identity is invalid')
    result.set(item.evidenceId, item)
  }
  return result
}

function validateNarrativeEvidence(
  scenes: NarrativeSceneSnapshot[],
  evidence: Map<string, CreatorSkillEvidence>,
) {
  let expectedCount = 0
  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
    const scene = scenes[sceneIndex]!
    for (let beatIndex = 0; beatIndex < scene.beats.length; beatIndex += 1) {
      const beat = scene.beats[beatIndex]!
      requireItemEvidence(
        evidence,
        `narrative-beat-evidence-${String(scene.order).padStart(3, '0')}-${String(beat.order).padStart(3, '0')}`,
        beat.lineStart,
        beat.lineEnd,
        beat.sourceText,
      )
      expectedCount += 1
    }
  }
  if (evidence.size !== expectedCount) fail('result evidence must map one-to-one to Artifact beats')
}

function validateShotEvidence(
  scenes: ShotSceneSnapshot[],
  evidence: Map<string, CreatorSkillEvidence>,
) {
  let expectedCount = 0
  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
    const scene = scenes[sceneIndex]!
    for (let shotIndex = 0; shotIndex < scene.shots.length; shotIndex += 1) {
      const shot = scene.shots[shotIndex]!
      requireItemEvidence(
        evidence,
        `shot-plan-evidence-${String(scene.order).padStart(3, '0')}-${String(shot.order).padStart(3, '0')}`,
        shot.lineStart,
        shot.lineEnd,
        shot.sourceText,
      )
      expectedCount += 1
    }
  }
  if (evidence.size !== expectedCount) fail('result evidence must map one-to-one to Artifact shots')
}

function requireItemEvidence(
  evidence: Map<string, CreatorSkillEvidence>,
  evidenceId: string,
  lineStart: number,
  lineEnd: number,
  sourceText: string,
) {
  const item = evidence.get(evidenceId)
  if (!item
    || item.lineStart !== lineStart
    || item.lineEnd !== lineEnd
    || item.excerpt !== sourceText) {
    fail('evidence does not match its canonical Artifact item')
  }
  return item
}

function existingDuplicateIds(value: unknown, skillId: string, fingerprint: string) {
  const nodes = denseArray<unknown>(value, 'existingNodes')
  const result = new Set<string>()
  for (let index = 0; index < nodes.length; index += 1) {
    const metadata = tryOwnData(nodes[index], 'metadataJson')
    if (metadata === MISSING) continue
    const creatorSkill = tryOwnData(metadata, 'creatorSkill')
    if (creatorSkill === MISSING) continue
    if (tryOwnData(creatorSkill, 'skillId') === skillId
      && tryOwnData(creatorSkill, 'runFingerprint') === fingerprint) {
      const resultId = tryOwnData(creatorSkill, 'resultId')
      if (typeof resultId === 'string') result.add(resultId)
    }
  }
  return result
}

function beatImmutableFieldsMatch(approved: BeatSnapshot, source: BeatSnapshot) {
  return approved.beatId === source.beatId
    && approved.sceneId === source.sceneId
    && approved.order === source.order
    && approved.sourceText === source.sourceText
    && approved.lineStart === source.lineStart
    && approved.lineEnd === source.lineEnd
    && sameOptional(approved.needsReviewReason, source.needsReviewReason)
}

function shotImmutableFieldsMatch(approved: ShotSnapshot, source: ShotSnapshot) {
  return approved.shotId === source.shotId
    && approved.sceneId === source.sceneId
    && sameOptional(approved.beatId, source.beatId)
    && approved.order === source.order
    && approved.sourceText === source.sourceText
    && approved.lineStart === source.lineStart
    && approved.lineEnd === source.lineEnd
    && sameOptional(approved.needsReviewReason, source.needsReviewReason)
}

function narrativeBeatPayload(beat: BeatSnapshot) {
  return {
    beatId: beat.beatId,
    sceneId: beat.sceneId,
    order: beat.order,
    type: beat.type,
    sourceText: beat.sourceText,
    summary: beat.summary,
    lineStart: beat.lineStart,
    lineEnd: beat.lineEnd,
    reviewStatus: 'pending' as const,
    ...(beat.needsReviewReason.value !== undefined
      ? { needsReviewReason: beat.needsReviewReason.value }
      : {}),
  }
}

function shotPayload(shot: ShotSnapshot) {
  return {
    shotId: shot.shotId,
    sceneId: shot.sceneId,
    ...(shot.beatId.value !== undefined ? { beatId: shot.beatId.value } : {}),
    order: shot.order,
    objective: shot.objective,
    subject: shot.subject,
    action: shot.action,
    suggestedShotSize: shot.suggestedShotSize,
    sourceText: shot.sourceText,
    lineStart: shot.lineStart,
    lineEnd: shot.lineEnd,
    outputKind: shot.outputKind,
    duration: shot.duration,
    reviewStatus: 'pending' as const,
    ...(shot.needsReviewReason.value !== undefined
      ? { needsReviewReason: shot.needsReviewReason.value }
      : {}),
  }
}

function metadata(
  skillId: string,
  runFingerprint: string,
  sourceNodeIds: string[],
  sourceArtifactId: string,
  resultType: 'narrative-beat-map' | 'shot-plan',
  resultId: string,
  evidence: CreatorSkillEvidence[],
  approvedArtifact: CreatorSkillArtifact,
): GroupedSkillNodePlan['metadataJson'] {
  return {
    creatorSkill: {
      skillId,
      skillVersion: '1.0.0',
      runFingerprint,
      sourceNodeIds: sourceNodeIds.slice(),
      sourceArtifactIds: [sourceArtifactId],
      resultType,
      resultId,
      reviewStatus: 'approved',
      evidence: evidence.map(cloneEvidence),
      approvedArtifact,
    },
  }
}

function narrativePrompt(scene: NarrativeSceneSnapshot) {
  const lines = [`Scene: ${scene.heading || `Scene ${scene.order}`}`]
  for (let index = 0; index < scene.beats.length; index += 1) {
    const beat = scene.beats[index]!
    lines.push('', `Beat ${index + 1}`, `Type: ${beat.type}`, `Summary: ${beat.summary}`, `Source: ${beat.sourceText}`)
  }
  return lines.join('\n')
}

function shotPrompt(scene: ShotSceneSnapshot) {
  const lines = [`Scene: ${scene.heading || `Scene ${scene.order}`}`]
  for (let index = 0; index < scene.shots.length; index += 1) {
    const shot = scene.shots[index]!
    lines.push(
      '',
      `Shot ${index + 1}`,
      `Objective: ${shot.objective}`,
      `Subject: ${shot.subject}`,
      `Action: ${shot.action}`,
      `Shot Size: ${shot.suggestedShotSize}`,
      `Output: ${shot.outputKind}`,
      `Duration: ${shot.duration}s`,
      `Source: ${shot.sourceText}`,
    )
  }
  return lines.join('\n')
}

function planNarrative(inputValue: NarrativeBeatMaterializationInput) {
  const input = requireRecord(inputValue, 'materialization input')
  const result = snapshotResult(ownData(input, 'result', 'input.result'))
  const context = snapshotContext(ownData(input, 'approvalContext', 'input.approvalContext'))
  const artifact = snapshotArtifact(
    result.artifacts,
    'narrative-beat-map',
    'beats',
    snapshotNarrativeScene,
  )
  validateIdentity(result, context, artifact.artifactId, 'narrative-beat-analysis')
  const evidence = evidenceById(result.evidence, artifact.sourceNodeIds)
  validateNarrativeEvidence(artifact.scenes, evidence)
  const approvals = denseArray<unknown>(
    ownData(input, 'approvedScenes', 'input.approvedScenes'),
    'approvedScenes',
  ).map((scene) => snapshotNarrativeScene(scene, 'approved'))
  const existing = existingDuplicateIds(
    ownData(input, 'existingNodes', 'input.existingNodes'),
    result.skillId,
    result.runFingerprint,
  )
  const sourceScenes = new Map(artifact.scenes.map((scene) => [scene.sceneId, scene]))
  const approvedByScene = new Map<string, NarrativeSceneSnapshot>()
  for (let index = 0; index < approvals.length; index += 1) {
    const approved = approvals[index]!
    const source = sourceScenes.get(approved.sceneId)
    if (!source || source.order !== approved.order || source.heading !== approved.heading) {
      fail('approved scene identity does not match the Artifact')
    }
    if (approvedByScene.has(approved.sceneId)) fail('approved scene IDs must be unique')
    const sourceBeats = new Map(source.beats.map((beat) => [beat.beatId, beat]))
    for (let beatIndex = 0; beatIndex < approved.beats.length; beatIndex += 1) {
      const approvedBeat = approved.beats[beatIndex]!
      const sourceBeat = sourceBeats.get(approvedBeat.beatId)
      if (!sourceBeat || !beatImmutableFieldsMatch(approvedBeat, sourceBeat)) {
        fail('approved beat immutable fields do not match the Artifact')
      }
    }
    approvedByScene.set(approved.sceneId, approved)
  }

  const create: GroupedSkillNodePlan[] = []
  const duplicates: string[] = []
  for (let index = 0; index < artifact.scenes.length; index += 1) {
    const sourceScene = artifact.scenes[index]!
    const approved = approvedByScene.get(sourceScene.sceneId)
    if (!approved || approved.beats.length === 0) continue
    if (existing.has(sourceScene.sceneId)) {
      duplicates.push(sourceScene.sceneId)
      continue
    }
    const selectedEvidence = approved.beats.map((beat) => cloneEvidence(requireItemEvidence(
      evidence,
      `narrative-beat-evidence-${String(sourceScene.order).padStart(3, '0')}-${String(beat.order).padStart(3, '0')}`,
      beat.lineStart,
      beat.lineEnd,
      beat.sourceText,
    )))
    const approvedArtifact: CreatorSkillArtifact = {
      artifactId: `narrative-beat-map-${sourceScene.sceneId}-approved`,
      artifactType: 'narrative-beat-map',
      artifactVersion: 1,
      sourceNodeIds: artifact.sourceNodeIds.slice(),
      sourceArtifactIds: [artifact.artifactId],
      payload: {
        scenes: [{
          sceneId: approved.sceneId,
          order: approved.order,
          heading: approved.heading,
          beats: approved.beats.map(narrativeBeatPayload),
        }],
      },
    }
    create.push({
      resultId: sourceScene.sceneId,
      title: `${approved.heading.trim() || `Scene ${approved.order}`} · Narrative Beats`,
      prompt: narrativePrompt(approved),
      metadataJson: metadata(
        result.skillId,
        result.runFingerprint,
        artifact.sourceNodeIds,
        artifact.artifactId,
        'narrative-beat-map',
        sourceScene.sceneId,
        selectedEvidence,
        approvedArtifact,
      ),
    })
  }
  return { create, duplicates }
}

function planShots(inputValue: ShotPlanMaterializationInput) {
  const input = requireRecord(inputValue, 'materialization input')
  const result = snapshotResult(ownData(input, 'result', 'input.result'))
  const context = snapshotContext(ownData(input, 'approvalContext', 'input.approvalContext'))
  const artifact = snapshotArtifact(result.artifacts, 'shot-plan', 'shots', snapshotShotScene)
  validateIdentity(result, context, artifact.artifactId, 'shot-planning')
  const evidence = evidenceById(result.evidence, artifact.sourceNodeIds)
  validateShotEvidence(artifact.scenes, evidence)
  const approvals = denseArray<unknown>(
    ownData(input, 'approvedScenes', 'input.approvedScenes'),
    'approvedScenes',
  ).map((scene) => snapshotShotScene(scene, 'approved'))
  const existing = existingDuplicateIds(
    ownData(input, 'existingNodes', 'input.existingNodes'),
    result.skillId,
    result.runFingerprint,
  )
  const sourceScenes = new Map(artifact.scenes.map((scene) => [scene.sceneId, scene]))
  const approvedByScene = new Map<string, ShotSceneSnapshot>()
  for (let index = 0; index < approvals.length; index += 1) {
    const approved = approvals[index]!
    const source = sourceScenes.get(approved.sceneId)
    if (!source || source.order !== approved.order || source.heading !== approved.heading) {
      fail('approved scene identity does not match the Artifact')
    }
    if (approvedByScene.has(approved.sceneId)) fail('approved scene IDs must be unique')
    const sourceShots = new Map(source.shots.map((shot) => [shot.shotId, shot]))
    for (let shotIndex = 0; shotIndex < approved.shots.length; shotIndex += 1) {
      const approvedShot = approved.shots[shotIndex]!
      const sourceShot = sourceShots.get(approvedShot.shotId)
      if (!sourceShot || !shotImmutableFieldsMatch(approvedShot, sourceShot)) {
        fail('approved shot immutable fields do not match the Artifact')
      }
    }
    approvedByScene.set(approved.sceneId, approved)
  }

  const create: GroupedSkillNodePlan[] = []
  const duplicates: string[] = []
  for (let index = 0; index < artifact.scenes.length; index += 1) {
    const sourceScene = artifact.scenes[index]!
    const approved = approvedByScene.get(sourceScene.sceneId)
    if (!approved || approved.shots.length === 0) continue
    if (existing.has(sourceScene.sceneId)) {
      duplicates.push(sourceScene.sceneId)
      continue
    }
    const selectedEvidence = approved.shots.map((shot) => cloneEvidence(requireItemEvidence(
      evidence,
      `shot-plan-evidence-${String(sourceScene.order).padStart(3, '0')}-${String(shot.order).padStart(3, '0')}`,
      shot.lineStart,
      shot.lineEnd,
      shot.sourceText,
    )))
    const approvedArtifact: CreatorSkillArtifact = {
      artifactId: `shot-plan-${sourceScene.sceneId}-approved`,
      artifactType: 'shot-plan',
      artifactVersion: 1,
      sourceNodeIds: artifact.sourceNodeIds.slice(),
      sourceArtifactIds: [artifact.artifactId],
      payload: {
        scenes: [{
          sceneId: approved.sceneId,
          order: approved.order,
          heading: approved.heading,
          shots: approved.shots.map(shotPayload),
        }],
      },
    }
    create.push({
      resultId: sourceScene.sceneId,
      title: `${approved.heading.trim() || `Scene ${approved.order}`} · Shot Plan`,
      prompt: shotPrompt(approved),
      metadataJson: metadata(
        result.skillId,
        result.runFingerprint,
        artifact.sourceNodeIds,
        artifact.artifactId,
        'shot-plan',
        sourceScene.sceneId,
        selectedEvidence,
        approvedArtifact,
      ),
    })
  }
  return { create, duplicates }
}

export function planNarrativeBeatMaterialization(
  input: NarrativeBeatMaterializationInput,
): GroupedMaterializationResult {
  try {
    return planNarrative(input)
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw new TypeError('narrative materialization input could not be read')
  }
}

export function planShotPlanMaterialization(
  input: ShotPlanMaterializationInput,
): GroupedMaterializationResult {
  try {
    return planShots(input)
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw new TypeError('shot materialization input could not be read')
  }
}
