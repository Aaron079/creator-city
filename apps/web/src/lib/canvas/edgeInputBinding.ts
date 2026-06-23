export type CanvasInputRole = 'primary' | 'reference' | 'mask' | 'control' | 'style' | 'audio'

export interface EdgeInputBinding {
  version: 1
  role: CanvasInputRole
  createdAt: string
}

export const DEFAULT_INPUT_ROLE: CanvasInputRole = 'primary'

export function getEdgeRole(metadataJson: unknown): CanvasInputRole {
  if (
    metadataJson !== null &&
    typeof metadataJson === 'object' &&
    'inputBinding' in (metadataJson as object)
  ) {
    const binding = (metadataJson as { inputBinding?: unknown }).inputBinding
    if (
      binding !== null &&
      typeof binding === 'object' &&
      'role' in (binding as object)
    ) {
      return ((binding as { role: CanvasInputRole }).role) ?? DEFAULT_INPUT_ROLE
    }
  }
  return DEFAULT_INPUT_ROLE
}
