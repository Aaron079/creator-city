/**
 * Asset Transform Artifact Registry — approved model weights for Creator City executors.
 *
 * SECURITY CONTRACT:
 *  No artifact is used in production until ALL of the following are true:
 *    - status === 'APPROVED'
 *    - sha256Status === 'VERIFIED'   (checksum verified against actual downloaded file)
 *    - licenseStatus === 'VERIFIED'  (license confirmed commercial-use-permitted from actual release)
 *
 *  CANDIDATE entries are listed for tracking and review. They MUST NOT be mapped to
 *  executor capability available=true. Use isArtifactApproved() as the single gate.
 *
 *  Current state (2026-06-21): No artifact is APPROVED. All entries are CANDIDATE.
 *  Production capabilities are therefore all false.
 */

import type { AssetTransformKind } from './assetTransformTypes'

// ─── Approved Artifact IDs ───────────────────────────────────────────────────
// Listing an ID here does NOT mean it is approved — it means it is under review.
// Check isArtifactApproved(id) before any production use.

export type ApprovedTransformArtifactId =
  | 'sam2.1-hiera-base-plus'  // CANDIDATE — remove-background (主体抠图)
  | 'swinir-realworld-x4'     // CANDIDATE — upscale (高清重建)

// ─── Verification Status ─────────────────────────────────────────────────────

export type ArtifactStatus = 'APPROVED' | 'CANDIDATE' | 'BLOCKED'
export type VerificationStatus = 'VERIFIED' | 'PENDING' | 'BLOCKED'

// ─── Artifact Descriptor ─────────────────────────────────────────────────────

export interface TransformArtifact {
  id: ApprovedTransformArtifactId
  displayName: string
  kind: AssetTransformKind
  /**
   * Overall approval gate. Must be 'APPROVED' for any production deployment.
   * 'CANDIDATE' = under review; 'BLOCKED' = not permitted.
   */
  status: ArtifactStatus
  /**
   * Has the SHA-256 checksum been verified against the actual downloaded weight file?
   * Must be 'VERIFIED' before production.
   */
  sha256Status: VerificationStatus
  /**
   * Has the model license been read from the actual artifact release (not inferred from
   * code repo) and confirmed to permit commercial use?
   */
  licenseStatus: VerificationStatus
  notes: string
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const TRANSFORM_ARTIFACT_REGISTRY: TransformArtifact[] = [
  {
    id: 'sam2.1-hiera-base-plus',
    displayName: 'SAM 2.1 Hiera Base+',
    kind: 'remove-background',
    status: 'CANDIDATE',
    sha256Status: 'PENDING',
    licenseStatus: 'PENDING',
    notes:
      'CANDIDATE / SHA256_PENDING. Apache-2.0 claimed for SAM2 code and official checkpoints. ' +
      'PENDING: download the specific checkpoint, verify SHA-256 against actual file, ' +
      'confirm LICENSE file in release matches Apache-2.0. ' +
      'Do not deploy until artifact registry entry is complete with approval sign-off.',
  },
  {
    id: 'swinir-realworld-x4',
    displayName: 'SwinIR Real-World ×4',
    kind: 'upscale',
    status: 'CANDIDATE',
    sha256Status: 'PENDING',
    licenseStatus: 'PENDING',
    notes:
      'CANDIDATE / LICENSE_AND_SHA256_PENDING. SwinIR code: Apache-2.0. ' +
      'Weight file license MUST be confirmed against actual release artifact ' +
      '(code license does not automatically cover model weights). ' +
      'Verify SHA-256 of downloaded file. Do not deploy until both verified and ' +
      'artifact registry entry is complete with approval sign-off.',
  },
]

// ─── Gates ───────────────────────────────────────────────────────────────────

/**
 * Returns true ONLY when ALL approval conditions are met for the given artifact.
 * This is the single production gate — CANDIDATE always returns false.
 */
export function isArtifactApproved(id: ApprovedTransformArtifactId): boolean {
  const artifact = TRANSFORM_ARTIFACT_REGISTRY.find((a) => a.id === id)
  if (!artifact) return false
  return (
    artifact.status === 'APPROVED' &&
    artifact.sha256Status === 'VERIFIED' &&
    artifact.licenseStatus === 'VERIFIED'
  )
}

/**
 * Returns true if at least one artifact for the given transform kind is fully approved.
 * Used by the capability gate — a kind cannot be available=true without an approved artifact.
 * Currently always returns false (no approved artifacts).
 */
export function hasApprovedArtifactForKind(kind: AssetTransformKind): boolean {
  return TRANSFORM_ARTIFACT_REGISTRY.some(
    (a) => a.kind === kind && isArtifactApproved(a.id),
  )
}
