import type { CameraTrack, Vec3 } from './types'

export type StudioTool = 'calibration' | 'lighting' | 'performance' | 'multicamera' | 'comparison'
export type PoseJoint = 'head' | 'leftHand' | 'rightHand' | 'leftFoot' | 'rightFoot'
export type ActorPose = { yaw: number; hipHeight: number } & Record<PoseJoint, Vec3>
export type PoseKey = { id: string; timeSec: number; pose: ActorPose }
export type StudioLight = {
  id: string
  name: string
  kind: 'spot' | 'sun'
  enabled: boolean
  position: Vec3
  target: Vec3
  intensity: number
  temperature: number
  angle: number
  softness: number
}
export type StudioCamera = { name: string; track: CameraTrack }
export type StudioCut = { id: string; timeSec: number; cameraId: string }
export type ReviewNote = {
  referenceId?: string | null
  localFileName?: string | null
  id: string
  startSec: number
  endSec: number
  category: 'composition' | 'actor' | 'scene' | 'lighting' | 'timing'
  text: string
  resolved: boolean
}
export type SpatialStudio = {
  version: 1
  programEnabled?: boolean
  calibration: { referenceId: string | null; opacity: number; verifiedEntityIds: string[]; editedEntityIds: string[] }
  lighting: { enabled: boolean; ambient: number; lights: StudioLight[] }
  performances: { actorId: string; keys: PoseKey[] }[]
  cameras: StudioCamera[]
  cuts: StudioCut[]
  review: { referenceId: string | null; offsetSec: number; notes: ReviewNote[] }
}
