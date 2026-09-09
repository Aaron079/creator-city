import type { CoverageCorridor, SpatialCoverage, Vec3 } from './types'

export type AuthoringRisk = {
  code: 'CAMERA_OUTSIDE_COVERAGE' | 'CAMERA_IN_UNAVAILABLE_COVERAGE'
  message: string
  remedy: string
  blocking: false
}

function isWithinCorridor(position: Vec3, corridor: CoverageCorridor) {
  return position.x >= corridor.min.x && position.x <= corridor.max.x
    && position.y >= corridor.min.y && position.y <= corridor.max.y
    && position.z >= corridor.min.z && position.z <= corridor.max.z
}

export function assessAuthoringRisks(coverage: SpatialCoverage, cameraPositions: Vec3[]): AuthoringRisk[] {
  if (coverage.mode === 'verified') return []

  if (coverage.mode === 'unavailable') {
    return cameraPositions.length === 0
      ? []
      : [{
          code: 'CAMERA_IN_UNAVAILABLE_COVERAGE',
          message: 'Camera positions cannot be validated because scene coverage is unavailable.',
          remedy: 'Use a source with spatial coverage before relying on the camera path.',
          blocking: false,
        }]
  }

  return cameraPositions.some((position) => !isWithinCorridor(position, coverage.corridor))
    ? [{
        code: 'CAMERA_OUTSIDE_COVERAGE',
        message: 'A camera position is outside the constrained coverage corridor.',
        remedy: 'Keep camera positions inside the coverage corridor or change the source coverage.',
        blocking: false,
      }]
    : []
}
