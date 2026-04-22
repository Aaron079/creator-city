import type { DeliveryAsset, DeliveryPackage } from '@/store/delivery-package.store'
import type { MusicCue, SoundEffectCue, VoiceTake } from '@/store/audio-desk.store'
import type { LicenseAssetType, LicenseRecord, LicenseStatus, LicenseUsageScope } from '@/store/licensing.store'
import { deriveLicensingRiskLevel, makeLicenseRecordId } from '@/store/licensing.store'

interface LicensingAggregationInput {
  voiceTakes: VoiceTake[]
  musicCues: MusicCue[]
  soundEffectCues: SoundEffectCue[]
  deliveryPackages: DeliveryPackage[]
}

function createRecord(input: {
  assetType: LicenseAssetType
  assetId: string
  title: string
  sourceProvider: string
  licenseStatus: LicenseStatus
  usageScope?: LicenseUsageScope
  expiresAt?: string
  note?: string
  proofUrl?: string
}): LicenseRecord {
  return {
    id: makeLicenseRecordId(input.assetType, input.assetId),
    assetType: input.assetType,
    assetId: input.assetId,
    title: input.title,
    sourceProvider: input.sourceProvider,
    licenseStatus: input.licenseStatus,
    usageScope: input.usageScope ?? 'commercial',
    expiresAt: input.expiresAt,
    note: input.note,
    proofUrl: input.proofUrl,
    riskLevel: deriveLicensingRiskLevel({
      ...input,
      usageScope: input.usageScope ?? 'commercial',
    }),
  }
}

function mapDeliveryAssetTypeToLicenseType(type: DeliveryAsset['type']): LicenseAssetType | null {
  switch (type) {
    case 'music-cue':
      return 'music-cue'
    case 'voice-take':
      return 'voice-take'
    case 'video-shot':
      return 'video-shot'
    case 'project-json':
      return 'project-json'
    default:
      return null
  }
}

function createDeliveryRecord(asset: DeliveryAsset): LicenseRecord | null {
  const assetType = mapDeliveryAssetTypeToLicenseType(asset.type)
  if (!assetType) return null
  return createRecord({
    assetType,
    assetId: asset.sourceId,
    title: asset.title,
    sourceProvider: assetType === 'video-shot' ? 'creator-city' : assetType === 'project-json' ? 'creator-city-export' : 'delivery-package',
    licenseStatus: asset.licenseStatus === 'commercial-cleared' ? 'commercial-cleared' : asset.licenseStatus === 'user-provided' ? 'user-provided' : 'unknown',
    usageScope: 'commercial',
    note: asset.description,
  })
}

export function buildLicenseRecords(input: LicensingAggregationInput): LicenseRecord[] {
  const records: LicenseRecord[] = []

  input.voiceTakes
    .filter((take) => take.status === 'selected')
    .forEach((take) => {
      records.push(createRecord({
        assetType: 'voice-take',
        assetId: take.id,
        title: `配音 · ${take.voiceId}`,
        sourceProvider: take.provider,
        licenseStatus: take.provider === 'mock' ? 'user-provided' : 'unknown',
        usageScope: 'commercial',
      }))
    })

  input.musicCues
    .filter((cue) => cue.status === 'selected')
    .forEach((cue) => {
      records.push(createRecord({
        assetType: 'music-cue',
        assetId: cue.id,
        title: `音乐 · ${cue.mood} / ${cue.tempo}`,
        sourceProvider: cue.provider,
        licenseStatus: cue.licenseStatus,
        usageScope: 'commercial',
      }))
    })

  input.soundEffectCues
    .filter((cue) => cue.status === 'selected')
    .forEach((cue) => {
      records.push(createRecord({
        assetType: 'sound-effect',
        assetId: cue.id,
        title: `音效 · ${cue.category}`,
        sourceProvider: cue.provider,
        licenseStatus: cue.provider === 'custom' ? 'user-provided' : 'unknown',
        usageScope: 'commercial',
      }))
    })

  input.deliveryPackages.forEach((pkg) => {
    pkg.assets
      .filter((asset) => asset.included)
      .forEach((asset) => {
        const record = createDeliveryRecord(asset)
        if (record) records.push(record)
      })
  })

  return Array.from(new Map(records.map((record) => [record.id, record])).values())
}

export function findLicensingRecordForDeliveryAsset(
  records: LicenseRecord[],
  asset: DeliveryAsset,
) {
  const assetType = mapDeliveryAssetTypeToLicenseType(asset.type)
  if (!assetType) return null
  return records.find((record) => record.assetType === assetType && record.assetId === asset.sourceId) ?? null
}

