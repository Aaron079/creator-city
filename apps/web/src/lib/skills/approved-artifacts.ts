import { cloneCreatorSkillArtifact } from './artifacts'
import type { CreatorSkillArtifact, CreatorSkillIssue } from './types'

export type ApprovedArtifactReadResult =
  | { status: 'absent' }
  | { status: 'valid'; artifact: CreatorSkillArtifact }
  | { status: 'invalid'; issue: CreatorSkillIssue }

function invalidApprovedArtifact(): ApprovedArtifactReadResult {
  return {
    status: 'invalid',
    issue: {
      code: 'APPROVED_ARTIFACT_INVALID',
      message: 'Approved Creator Skill artifact metadata is invalid',
    },
  }
}

type PropertyReadResult =
  | { status: 'absent' }
  | { status: 'accessor' }
  | { status: 'value'; value: unknown }

function readOwnDataProperty(value: object, key: PropertyKey): PropertyReadResult {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor) return { status: 'absent' }
  if (!('value' in descriptor)) return { status: 'accessor' }
  return { status: 'value', value: descriptor.value }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function readApprovedCreatorSkillArtifact(
  metadataJson: unknown,
): ApprovedArtifactReadResult {
  if (!metadataJson || typeof metadataJson !== 'object') return { status: 'absent' }

  try {
    const creatorSkill = readOwnDataProperty(metadataJson, 'creatorSkill')
    if (creatorSkill.status === 'absent') return { status: 'absent' }
    if (creatorSkill.status !== 'value'
      || !isPlainRecord(metadataJson)
      || !isPlainRecord(creatorSkill.value)) {
      return invalidApprovedArtifact()
    }

    const approvedArtifact = readOwnDataProperty(creatorSkill.value, 'approvedArtifact')
    if (approvedArtifact.status === 'absent') return { status: 'absent' }
    if (approvedArtifact.status !== 'value') return invalidApprovedArtifact()

    return {
      status: 'valid',
      artifact: cloneCreatorSkillArtifact(approvedArtifact.value),
    }
  } catch {
    return invalidApprovedArtifact()
  }
}
