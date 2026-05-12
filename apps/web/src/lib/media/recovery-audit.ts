import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'
import { getNodeImageUrlSources, getNodeVideoUrlSources, type MediaUrlSource } from '@/lib/canvas/media-urls'
import { isRenderableMediaUrl } from '@/lib/media/renderable-url'

export type MediaRecoveryAuditNode = {
  id?: string
  kind?: string
  title?: string
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  metadataJson?: unknown
}

export type MediaRecoveryAudit = {
  hasStableAsset: boolean
  hasProviderUrl: boolean
  proxyReachable: boolean
  assetReachable: boolean
  likelyRecoverable: boolean
  diagnosis: string
  candidateUrls: MediaRecoveryCandidateAudit[]
  stableAssetUrl?: string
  providerUrl?: string
  currentUrl?: string
  selectedWorkingUrl?: string
  selectedWorkingSource?: string
  currentReachable?: boolean
  providerReachable?: boolean
  proxyStatus?: number
  upstreamStatus?: number
  assetStatus?: number
  providerStatus?: number
}

export type MediaRecoveryCandidateAudit = MediaUrlSource & {
  proxiedUrl: string
  proxyReachable: boolean
  proxyStatus: number
  upstreamStatus?: number
  contentType?: string
  contentLength?: string
  message?: string
}

type MediaKind = 'image' | 'video'

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function getMediaKind(node: MediaRecoveryAuditNode, preferredKind?: MediaKind): MediaKind {
  if (preferredKind) return preferredKind
  return node.kind === 'video' ? 'video' : 'image'
}

function getCurrentMediaUrl(node: MediaRecoveryAuditNode, kind: MediaKind) {
  return kind === 'video'
    ? stringValue(node.resultVideoUrl)
    : stringValue(node.resultImageUrl)
}

function getProviderUrl(metadata: Record<string, unknown>, kind: MediaKind, currentUrl: string) {
  const candidates: Array<[string, string]> = [
    kind === 'video'
      ? ['metadata.originalProviderVideoUrl', stringValue(metadata.originalProviderVideoUrl)]
      : ['metadata.originalProviderImageUrl', stringValue(metadata.originalProviderImageUrl)],
    ['metadata.originalProviderUrl', stringValue(metadata.originalProviderUrl)],
    ['metadata.providerUrl', stringValue(metadata.providerUrl)],
    ['metadata.sourceProviderUrl', stringValue(metadata.sourceProviderUrl)],
    ['currentUrl', currentUrl],
  ]
  return candidates.find(([source, url]) => url && isRenderableMediaUrl(url, { source }).ok)?.[1] ?? ''
}

async function diagnoseUrl(url: string) {
  if (!url) return { reachable: false, status: 0 }
  if (url.startsWith('data:')) return { reachable: true, status: 200 }
  if (!isHttpUrl(url)) return { reachable: false, status: 0 }
  try {
    const response = await fetch('/api/media/diagnose', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url }),
    })
    const data = await response.json().catch(() => ({})) as { reachable?: unknown; status?: unknown }
    const status = typeof data.status === 'number' ? data.status : response.status
    return {
      reachable: response.ok && data.reachable === true,
      status,
    }
  } catch {
    return { reachable: false, status: 0 }
  }
}

async function checkProxy(url: string): Promise<MediaRecoveryCandidateAudit> {
  const proxiedUrl = getProxiedMediaUrl(url)
  if (!url) {
    return {
      source: '',
      url,
      proxiedUrl,
      proxyReachable: false,
      proxyStatus: 0,
      upstreamStatus: 0,
    }
  }
  if (url.startsWith('data:')) {
    return {
      source: '',
      url,
      proxiedUrl,
      proxyReachable: true,
      proxyStatus: 200,
      upstreamStatus: 200,
    }
  }
  if (!isHttpUrl(url)) {
    return {
      source: '',
      url,
      proxiedUrl,
      proxyReachable: false,
      proxyStatus: 0,
      upstreamStatus: 0,
    }
  }
  const mediaCandidate = isRenderableMediaUrl(url)
  if (!mediaCandidate.ok) {
    return {
      source: '',
      url,
      proxiedUrl,
      proxyReachable: false,
      proxyStatus: 0,
      upstreamStatus: 0,
      message: mediaCandidate.reason,
    }
  }
  try {
    const response = await fetch(proxiedUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: { Range: 'bytes=0-1' },
    })
    const upstreamStatusHeader = response.headers.get('x-media-proxy-upstream-status')
    const upstreamStatus = upstreamStatusHeader ? Number(upstreamStatusHeader) : response.status
    return {
      source: '',
      url,
      proxiedUrl,
      proxyReachable: (response.ok || response.status === 206),
      proxyStatus: response.status,
      upstreamStatus: Number.isFinite(upstreamStatus) ? upstreamStatus : response.status,
      contentType: response.headers.get('content-type') ?? undefined,
      contentLength: response.headers.get('content-length') ?? undefined,
    }
  } catch (error) {
    return {
      source: '',
      url,
      proxiedUrl,
      proxyReachable: false,
      proxyStatus: 0,
      upstreamStatus: 0,
      message: error instanceof Error ? error.message : 'Proxy fetch failed.',
    }
  }
}

async function auditCandidate(candidate: MediaUrlSource): Promise<MediaRecoveryCandidateAudit> {
  const checked = await checkProxy(candidate.url)
  return {
    ...checked,
    source: candidate.source,
  }
}

export async function auditNodeMedia(
  node: MediaRecoveryAuditNode,
  preferredKind?: MediaKind,
): Promise<MediaRecoveryAudit> {
  const kind = getMediaKind(node, preferredKind)
  const metadata = recordValue(node.metadataJson)
  const stableAssetUrl = stringValue(metadata.assetUrl)
  const currentUrl = getCurrentMediaUrl(node, kind)
  const providerUrl = getProviderUrl(metadata, kind, currentUrl)
  const candidateSources = kind === 'video' ? getNodeVideoUrlSources(node) : getNodeImageUrlSources(node)
  const candidateUrls: MediaRecoveryCandidateAudit[] = []
  let selectedWorkingCandidate: MediaRecoveryCandidateAudit | undefined

  for (const candidate of candidateSources) {
    const audited = await auditCandidate(candidate)
    candidateUrls.push(audited)
    if (!selectedWorkingCandidate && audited.proxyReachable) {
      selectedWorkingCandidate = audited
    }
  }

  const [assetDiagnostic, providerDiagnostic] = await Promise.all([
    stableAssetUrl ? diagnoseUrl(stableAssetUrl) : Promise.resolve({ reachable: false, status: 0 }),
    providerUrl ? diagnoseUrl(providerUrl) : Promise.resolve({ reachable: false, status: 0 }),
  ])

  const hasStableAsset = Boolean(stableAssetUrl)
  const hasProviderUrl = Boolean(providerUrl)
  const assetReachable = hasStableAsset && assetDiagnostic.reachable
  const currentProxy = candidateUrls.find((candidate) => candidate.url === currentUrl)
  const proxyReachable = Boolean(currentProxy?.proxyReachable)
  const providerReachable = hasProviderUrl && providerDiagnostic.reachable
  const likelyRecoverable = assetReachable || Boolean(selectedWorkingCandidate) || providerReachable
  const diagnosis = assetReachable
    ? 'Stable asset is reachable and can be used for display.'
    : selectedWorkingCandidate
      ? 'A recorded media URL is reachable through the media proxy.'
    : providerReachable
      ? 'Provider URL is still reachable and can be resynced into a stable asset.'
      : hasStableAsset || hasProviderUrl || candidateUrls.length
        ? 'Media URLs are present, but proxy/provider checks failed.'
        : 'No stable asset or provider URL is recorded for this node.'

  return {
    hasStableAsset,
    hasProviderUrl,
    proxyReachable,
    assetReachable,
    likelyRecoverable,
    diagnosis,
    candidateUrls,
    stableAssetUrl: stableAssetUrl || undefined,
    providerUrl: providerUrl || undefined,
    currentUrl: currentUrl || undefined,
    selectedWorkingUrl: selectedWorkingCandidate?.url,
    selectedWorkingSource: selectedWorkingCandidate?.source,
    currentReachable: proxyReachable,
    providerReachable,
    proxyStatus: currentProxy?.proxyStatus ?? selectedWorkingCandidate?.proxyStatus ?? 0,
    upstreamStatus: currentProxy?.upstreamStatus ?? selectedWorkingCandidate?.upstreamStatus,
    assetStatus: assetDiagnostic.status,
    providerStatus: providerDiagnostic.status,
  }
}
