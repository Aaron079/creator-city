import {
  DEFAULT_PROJECT_REGION,
  DEFAULT_USER_REGION,
  PROVIDER_REGION_REGISTRY,
  STORAGE_REGION_REGISTRY,
  normalizeProviderAdapterId,
  normalizeStorageAdapterId,
} from './registry'
import type {
  CrossRegionJobInput,
  GenerationRegionDecision,
  ProviderRegion,
  ProviderRegionConfig,
  Region,
  ResolveGenerationRegionInput,
  ResolveStorageProviderInput,
  StorageProviderDecision,
  StorageRegion,
  StorageRegionConfig,
} from './types'

function normalizeRegion(region?: Region | null): Region | null {
  return region === 'cn' || region === 'global' ? region : null
}

export function getDefaultRegionForUser(): Region {
  return DEFAULT_USER_REGION
}

export function getDefaultRegionForProject(): Region {
  return DEFAULT_PROJECT_REGION
}

export function getProviderRegion(provider?: string | null): ProviderRegion {
  const adapterId = normalizeProviderAdapterId(provider)
  return adapterId ? PROVIDER_REGION_REGISTRY[adapterId].region : getDefaultRegionForProject()
}

export function getProviderRegionConfig(provider?: string | null): ProviderRegionConfig | null {
  const adapterId = normalizeProviderAdapterId(provider)
  return adapterId ? PROVIDER_REGION_REGISTRY[adapterId] : null
}

export function getStorageRegion(storageProvider?: string | null): StorageRegion {
  const adapterId = normalizeStorageAdapterId(storageProvider)
  return adapterId ? STORAGE_REGION_REGISTRY[adapterId].region : getDefaultRegionForProject()
}

export function getStorageRegionConfig(storageProvider?: string | null): StorageRegionConfig | null {
  const adapterId = normalizeStorageAdapterId(storageProvider)
  return adapterId ? STORAGE_REGION_REGISTRY[adapterId] : null
}

export function resolveGenerationRegion(input: ResolveGenerationRegionInput = {}): GenerationRegionDecision {
  const userRegion = normalizeRegion(input.userRegion) ?? getDefaultRegionForUser()
  const projectRegion = normalizeRegion(input.projectRegion) ?? getDefaultRegionForProject()
  const providerConfig = getProviderRegionConfig(input.provider)
  const providerRegion = providerConfig?.region ?? projectRegion
  const region = projectRegion
  const crossRegion = isCrossRegionJob({ userRegion, projectRegion, providerRegion })

  return {
    region,
    userRegion,
    projectRegion,
    providerRegion,
    providerConfig: providerConfig ?? undefined,
    crossRegion,
    shouldUseAsyncExecutor: shouldUseAsyncExecutor({ userRegion, projectRegion, providerRegion }),
  }
}

export function resolveStorageProvider(input: ResolveStorageProviderInput = {}): StorageProviderDecision {
  const projectRegion = normalizeRegion(input.projectRegion) ?? getDefaultRegionForProject()
  const providerRegion = normalizeRegion(input.providerRegion) ?? projectRegion
  const preferredStorage = getStorageRegionConfig(input.preferredStorageProvider)

  if (preferredStorage && preferredStorage.region === projectRegion) {
    return {
      storageProvider: preferredStorage.id,
      storageRegion: preferredStorage.region,
      storageConfig: preferredStorage,
      crossRegion: preferredStorage.region !== providerRegion,
    }
  }

  const fallback = Object.values(STORAGE_REGION_REGISTRY).find((storage) => storage.region === projectRegion)
    ?? STORAGE_REGION_REGISTRY.aliyun_oss

  return {
    storageProvider: fallback.id,
    storageRegion: fallback.region,
    storageConfig: fallback,
    crossRegion: fallback.region !== providerRegion,
  }
}

export function isCrossRegionJob(input: CrossRegionJobInput = {}): boolean {
  const userRegion = normalizeRegion(input.userRegion)
  const projectRegion = normalizeRegion(input.projectRegion) ?? getDefaultRegionForProject()
  const providerRegion = normalizeRegion(input.providerRegion)
  const storageRegion = normalizeRegion(input.storageRegion)
  return Boolean(
    (userRegion && userRegion !== projectRegion)
    || (providerRegion && providerRegion !== projectRegion)
    || (storageRegion && storageRegion !== projectRegion),
  )
}

export function shouldUseAsyncExecutor(input: CrossRegionJobInput = {}): boolean {
  return isCrossRegionJob(input)
}
