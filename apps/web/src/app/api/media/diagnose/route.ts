import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { diagnoseMediaUrl } from '@/lib/assets/media-diagnostics'
import { getNodeImageUrlSources, getNodeVideoUrlSources } from '@/lib/canvas/media-urls'

export const dynamic = 'force-dynamic'

type DiagnoseBody = {
  url?: unknown
  type?: unknown
  nodeId?: unknown
  node?: unknown
  metadataJson?: unknown
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function proxyRoundTrip(url: string) {
  const proxiedUrl = `/api/media/proxy?url=${encodeURIComponent(url)}`
  const decoded = new URL(`http://local${proxiedUrl}`).searchParams.get('url') ?? ''
  return {
    proxiedUrl,
    proxyDecodedUrl: decoded,
    proxyUrlRoundTripMatches: decoded === url,
    queryPreserved: decoded === url,
  }
}

export async function POST(request: NextRequest) {
  let body: DiagnoseBody
  try {
    body = await request.json() as DiagnoseBody
  } catch {
    return NextResponse.json({
      success: false,
      errorCode: 'INVALID_JSON',
      message: '请求体不是合法 JSON。',
    }, { status: 400 })
  }

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  if (!url) {
    return NextResponse.json({
      success: false,
      errorCode: 'MEDIA_URL_EMPTY',
      message: '当前节点没有可诊断的媒体 URL。',
    }, { status: 400 })
  }

  const metadataJson = body.metadataJson ?? recordValue(body.node).metadataJson
  const nodeRecord = recordValue(body.node)
  const nodeLike = {
    resultImageUrl: stringValue(nodeRecord.resultImageUrl) || (body.type === 'image' ? url : ''),
    resultVideoUrl: stringValue(nodeRecord.resultVideoUrl) || (body.type === 'video' ? url : ''),
    preview: recordValue(nodeRecord.preview),
    metadataJson,
  }
  const candidateSources = body.type === 'video'
    ? getNodeVideoUrlSources(nodeLike)
    : getNodeImageUrlSources(nodeLike)
  const metadata = recordValue(metadataJson)
  const diagnostic = await diagnoseMediaUrl(url)
  const candidateUrls = []
  for (const candidate of candidateSources) {
    const candidateDiagnostic = await diagnoseMediaUrl(candidate.url)
    candidateUrls.push({
      ...candidate,
      ...proxyRoundTrip(candidate.url),
      proxyStatus: candidateDiagnostic.status,
      upstreamStatus: candidateDiagnostic.upstreamStatus,
      reachable: candidateDiagnostic.reachable,
      contentType: candidateDiagnostic.contentType,
      contentLength: candidateDiagnostic.contentLength,
      message: candidateDiagnostic.message,
    })
  }
  const selectedWorking = candidateUrls.find((candidate) => candidate.reachable)
  const roundTrip = proxyRoundTrip(url)
  console.log('[media-diagnose]', {
    nodeId: body.nodeId,
    type: body.type,
    originalUrl: url,
    metadataJson,
    candidateUrls,
    selectedWorkingUrl: selectedWorking?.url ?? '',
    proxiedUrl: roundTrip.proxiedUrl,
    proxyStatus: diagnostic.status,
    upstreamStatus: diagnostic.upstreamStatus,
    proxyUrlRoundTripMatches: roundTrip.proxyUrlRoundTripMatches,
    queryPreserved: roundTrip.queryPreserved,
    hasAssetUrl: Boolean(stringValue(metadata.assetUrl)),
    hasAssetId: Boolean(stringValue(metadata.assetId)),
    hasMediaPersistence: Boolean(metadata.mediaPersistence),
  })
  return NextResponse.json({
    success: true,
    ...diagnostic,
    ...roundTrip,
    proxyStatus: diagnostic.status,
    upstreamStatus: diagnostic.upstreamStatus,
    candidateUrls,
    selectedWorkingUrl: selectedWorking?.url,
    selectedWorkingSource: selectedWorking?.source,
    hasAssetUrl: Boolean(stringValue(metadata.assetUrl)),
    hasAssetId: Boolean(stringValue(metadata.assetId)),
    hasMediaPersistence: Boolean(metadata.mediaPersistence),
    legacyStableAssetMissing: !stringValue(metadata.assetUrl) && !stringValue(metadata.assetId) && !metadata.mediaPersistence,
  }, { status: 200 })
}
