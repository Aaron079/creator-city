export type Region = 'cn' | 'global'

export type ProviderRegion = Region

export type ExecutionRegion = Region

export type StorageRegion = Region

export type ExecutorKind = 'aliyun_fc' | 'vercel' | 'global_executor' | 'none'

export type ProviderAdapterId =
  | 'volcengine_seedream'
  | 'volcengine_seedance'
  | 'jimeng'
  | 'deepseek'
  | 'openai'
  | 'runway'
  | 'replicate'
  | 'fal'
  | 'stability'
  | 'google'
  | 'midjourney'
  | 'kling_global'

export type StorageAdapterId =
  | 'aliyun_oss'
  | 's3'
  | 'cloudflare_r2'
  | 'vercel_blob'

export type AdapterAvailability = 'active' | 'future'

export type ProviderRegionConfig = {
  id: ProviderAdapterId
  region: ProviderRegion
  availability: AdapterAvailability
  runtimeProviderIds: string[]
  label: string
  notes?: string
}

export type StorageRegionConfig = {
  id: StorageAdapterId
  region: StorageRegion
  availability: AdapterAvailability
  runtimeStorageProviders: string[]
  label: string
  notes?: string
}

export type RegionDecisionSource =
  | 'user'
  | 'project'
  | 'provider'
  | 'storage'
  | 'default'

export type RegionDecision = {
  region: Region
  source: RegionDecisionSource
}

export type ResolveGenerationRegionInput = {
  userRegion?: Region | null
  projectRegion?: Region | null
  provider?: string | null
}

export type GenerationRegionDecision = {
  region: Region
  userRegion: Region
  projectRegion: Region
  providerRegion: ProviderRegion
  providerConfig?: ProviderRegionConfig
  crossRegion: boolean
  shouldUseAsyncExecutor: boolean
}

export type ResolveStorageProviderInput = {
  projectRegion?: Region | null
  providerRegion?: ProviderRegion | null
  preferredStorageProvider?: string | null
}

export type StorageProviderDecision = {
  storageProvider: StorageAdapterId
  storageRegion: StorageRegion
  storageConfig: StorageRegionConfig
  crossRegion: boolean
}

export type CrossRegionJobInput = {
  userRegion?: Region | null
  projectRegion?: Region | null
  providerRegion?: ProviderRegion | null
  storageRegion?: StorageRegion | null
}
