// ─── City & World ─────────────────────────────────────────────────────────────

export type BuildingType =
  | 'STUDIO'
  | 'OFFICE'
  | 'LAB'
  | 'GALLERY'
  | 'THEATER'
  | 'MARKET'
  | 'ARCHIVE'

export type BuildingLevel = 1 | 2 | 3 | 4 | 5

export interface CityBase {
  id: string
  ownerId: string
  name: string
  description?: string
  position: WorldPosition
  buildings: Building[]
  reputation: number
  createdAt: Date
  updatedAt: Date
}

export interface Building {
  id: string
  baseId: string
  type: BuildingType
  level: BuildingLevel
  name: string
  position: LocalPosition
  capacity: number
  isUnlocked: boolean
  upgradeCost?: BuildingCost
  benefits: BuildingBenefits
}

export interface WorldPosition {
  x: number
  y: number
  zoneId: string
}

export interface LocalPosition {
  x: number
  y: number
  z: number
}

export interface BuildingCost {
  credits: number
  materials?: Record<string, number>
  timeSeconds?: number
}

export interface BuildingBenefits {
  productionBoost?: number
  agentSlots?: number
  storageCapacity?: number
  collaborationRadius?: number
}

export interface CityZone {
  id: string
  name: string
  theme: string
  maxBases: number
  currentBases: number
  unlockRequirement?: ZoneRequirement
}

export interface ZoneRequirement {
  minReputation: number
  minLevel: number
}
