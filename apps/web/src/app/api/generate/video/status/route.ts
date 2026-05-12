import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSeedanceVideoStatus } from '@/lib/providers/china/volcengine'
import { getCurrentUser } from '@/lib/auth/current-user'
import { persistGeneratedMedia, type PersistGeneratedMediaResult } from '@/lib/assets/persist-generated-media'
import { analyzeAssetIntelligence } from '@/lib/asset-intelligence'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function visiblePersistenceErrorCode(errorCode: string) {
  if (errorCode === 'provider_media_download_failed' || errorCode === 'MEDIA_FETCH_FAILED' || errorCode === 'ASSET_DOWNLOAD_FAILED' || errorCode === 'ASSET_DOWNLOAD_ERROR' || errorCode === 'ASSET_DOWNLOAD_TIMEOUT' || errorCode === 'PROVIDER_MEDIA_DOWNLOAD_FAILED') return 'provider_media_download_failed'
  if (errorCode === 'oss_upload_timeout' || errorCode === 'oss_upload_error' || errorCode === 'oss_auth_error' || errorCode === 'oss_permission_error' || errorCode === 'oss_config_error') return errorCode
  if (errorCode === 'MEDIA_UPLOAD_FAILED') return 'oss_upload_error'
  if (errorCode === 'canvas_save_error') return 'canvas_save_error'
  if (errorCode === 'MEDIA_ASSET_CREATE_FAILED' || errorCode === 'MEDIA_PERSISTENCE_FAILED' || errorCode === 'MEDIA_PERSIST_FAILED' || errorCode === 'MEDIA_PERSIST_TIMEOUT') return 'asset_persistence_error'
  return errorCode
}

function visibleProviderErrorCode(errorCode: string | undefined, upstreamStatus?: number, message = '') {
  const code = errorCode ?? ''
  const haystack = `${code} ${message}`.toLowerCase()
  if (code === 'PROVIDER_NOT_CONFIGURED' || code === 'provider_env_missing' || code.includes('MODEL_REQUIRED') || haystack.includes('not configured')) return 'provider_env_missing'
  if (code === 'provider_timeout' || code.includes('TIMEOUT') || /timeout|abort/.test(haystack)) return 'provider_timeout'
  if (code === 'provider_network_failed' || /fetch failed|failed to fetch|network|econn|enotfound|dns/.test(haystack)) return 'provider_network_failed'
  if (code === 'provider_response_parse_failed') return 'provider_response_parse_failed'
  if (code === 'provider_request_failed') return 'provider_request_failed'
  if (code === 'PROVIDER_AUTH_ERROR' || code === 'provider_auth_failed' || code === 'provider_auth_error' || upstreamStatus === 401 || upstreamStatus === 403 || /auth|unauthorized|forbidden|permission|access denied/.test(haystack)) return 'provider_auth_failed'
  if (code === 'provider_model_invalid' || /model.*(not exist|not found|invalid|does not exist)|endpoint.*(not exist|does not exist)|模型|接入点/.test(haystack)) return 'provider_model_invalid'
  if (code === 'PROVIDER_QUOTA_OR_BILLING_ERROR' || code === 'provider_quota_or_billing_error' || upstreamStatus === 402 || upstreamStatus === 429 || /quota|billing|credits|insufficient|余额|额度|rate limit/.test(haystack)) return 'provider_quota_or_billing_error'
  if (code === 'PROVIDER_INVALID_PARAMETER' || code === 'provider_invalid_parameter' || /invalid parameter|invalid_param|invalid request|bad request|parameter/.test(haystack)) return 'provider_invalid_parameter'
  if (code === 'PROVIDER_MEDIA_DOWNLOAD_FAILED' || code === 'provider_media_download_failed' || code === 'MEDIA_FETCH_FAILED' || code === 'ASSET_DOWNLOAD_FAILED' || code === 'ASSET_DOWNLOAD_ERROR' || /media download failed|download failed/.test(haystack)) return 'provider_media_download_failed'
  if (code === 'PROVIDER_NO_DOWNLOAD_URL' || code === 'provider_no_download_url' || code.includes('URL_EMPTY') || code.includes('URL_MISSING')) return 'provider_no_download_url'
  return code || 'generation_failed'
}

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({
      success: false,
      status: 'error',
      errorCode: 'UNAUTHORIZED',
      message: '请先登录后再查询视频任务。',
    }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const providerId = searchParams.get('providerId') ?? ''
  const taskId = searchParams.get('taskId') ?? ''
  const projectId = searchParams.get('projectId')?.trim() || undefined
  const workflowId = searchParams.get('workflowId')?.trim() || undefined
  const nodeId = searchParams.get('nodeId')?.trim() || undefined
  const prompt = searchParams.get('prompt')?.trim() || undefined
  const compiledPrompt = searchParams.get('compiledPrompt')?.trim() || undefined

  if (!taskId) {
    return NextResponse.json({
      success: false,
      status: 'error',
      errorCode: 'TASK_ID_REQUIRED',
      message: 'taskId is required',
    }, { status: 400 })
  }

  if (providerId !== 'volcengine-seedance-video') {
    return NextResponse.json({
      success: false,
      providerId,
      taskId,
      status: 'error',
      errorCode: 'PROVIDER_NOT_SUPPORTED',
      message: '该视频任务查询接口目前仅支持 volcengine-seedance-video。',
    }, { status: 200 })
  }

  const result = await getSeedanceVideoStatus(taskId)
  const submittedInput = result.submittedInput ?? {
    providerId,
    taskId,
    projectId: projectId ?? null,
    workflowId: workflowId ?? null,
    nodeId: nodeId ?? null,
    promptChars: prompt?.length ?? 0,
    compiledPromptChars: compiledPrompt?.length ?? 0,
  }
  const generationJob = await db.generationJob.findFirst({
    where: {
      userId: currentUser.id,
      providerJobId: taskId,
      providerId,
    },
    orderBy: { createdAt: 'desc' },
  }).catch(() => null)

  if (!result.success) {
    if (generationJob) {
      await db.generationJob.update({
        where: { id: generationJob.id },
        data: {
          status: 'FAILED',
          error: result.message,
          errorMessage: result.message.slice(0, 1000),
          completedAt: new Date(),
        },
      }).catch(() => undefined)
    }
    return NextResponse.json({
      success: false,
      providerId,
      taskId,
      status: 'error',
      errorCode: visibleProviderErrorCode(result.errorCode, result.upstreamStatus, result.message),
      message: result.message,
      model: result.model,
      upstreamStatus: result.upstreamStatus,
        upstreamMessage: result.upstreamMessage,
        rawCode: result.rawCode,
        requestId: result.requestId,
        providerEndpoint: result.providerEndpoint,
        providerRequestMethod: result.providerRequestMethod,
        providerHttpStatus: result.providerHttpStatus,
        providerFetchError: result.providerFetchError,
        providerFetchCause: result.providerFetchCause,
        submittedInput,
        providerResponse: result.providerResponse,
      }, { status: 200 })
  }

  if (result.status === 'done' && result.videoUrl) {
    const assetIntelligence = analyzeAssetIntelligence({
      mediaType: 'video',
      prompt,
      compiledPrompt,
      providerId,
      metadata: { model: result.model, taskId },
    })
    const persistence = await persistGeneratedMedia({
        url: result.videoUrl,
        type: 'video',
        projectId,
        workflowId,
        nodeId,
        filenameHint: 'generated-video.mp4',
        sourceProvider: providerId,
        userId: currentUser.id,
        metadata: {
          model: result.model,
          taskId,
          providerJobId: taskId,
          generationJobId: generationJob?.id,
          requestId: result.requestId,
          providerEndpoint: result.providerEndpoint,
          providerRequestMethod: result.providerRequestMethod,
          providerHttpStatus: result.providerHttpStatus,
          submittedInput,
          assetIntelligence,
        },
      }).catch((error: unknown): Extract<PersistGeneratedMediaResult, { ok: false }> => ({
        ok: false as const,
        stage: 'asset_create' as const,
        generationStage: 'asset_create' as const,
        errorCode: 'asset_persistence_error',
        rawErrorCode: 'MEDIA_PERSIST_FAILED',
        errorMessage: error instanceof Error ? error.message : '生成视频转存失败。',
        message: error instanceof Error ? error.message : '生成视频转存失败。',
      }))

    if (persistence.ok) {
      return NextResponse.json({
        success: true,
        providerId,
        taskId,
        status: 'done',
        resultVideoUrl: persistence.stableUrl,
        videoUrl: persistence.stableUrl,
        assetUrl: persistence.stableUrl,
        resolvedUrl: persistence.resolvedUrl ?? persistence.stableUrl,
        stableUrl: persistence.stableUrl,
        proxyUrl: persistence.proxyUrl ?? undefined,
        storageProvider: persistence.storageProvider,
        bucket: persistence.bucket,
        storageKey: persistence.storageKey,
        signedUrlAvailable: persistence.signedUrlAvailable,
        proxyAvailable: persistence.proxyAvailable,
        assetId: persistence.assetId,
        outputAssetId: persistence.assetId,
        generationJobId: generationJob?.id,
        generationStatus: 'generation_success',
        persistenceStatus: 'persistence_success',
        assetStatus: 'ready',
        asset: persistence.assetId ? {
          id: persistence.assetId,
          type: 'VIDEO',
          url: persistence.stableUrl,
          dataUrl: null,
          thumbnailUrl: null,
          providerId: 'generated-media-persistence',
          generationJobId: generationJob?.id,
          projectId,
          workflowId,
          nodeId,
        } : undefined,
        originalProviderVideoUrl: result.videoUrl,
        providerOriginalUrl: result.videoUrl,
        temporaryUrl: result.videoUrl,
        mediaPersistence: persistence,
        assetIntelligence,
        model: result.model,
        message: result.message,
        requestId: result.requestId,
        submittedInput,
        providerResponse: result.providerResponse,
        result: {
          videoUrl: persistence.stableUrl,
          previewUrl: persistence.stableUrl,
          metadata: {
            model: result.model,
            taskId,
            providerJobId: taskId,
            generationJobId: generationJob?.id,
            assetId: persistence.assetId,
            outputAssetId: persistence.assetId,
            assetUrl: persistence.stableUrl,
            resolvedUrl: persistence.resolvedUrl ?? persistence.stableUrl,
            stableUrl: persistence.stableUrl,
            ...(persistence.proxyUrl ? { proxyUrl: persistence.proxyUrl } : {}),
            storageProvider: persistence.storageProvider,
            bucket: persistence.bucket,
            storageKey: persistence.storageKey,
            signedUrlAvailable: persistence.signedUrlAvailable,
            proxyAvailable: persistence.proxyAvailable,
            originalProviderVideoUrl: result.videoUrl,
            providerOriginalUrl: result.videoUrl,
            temporaryUrl: result.videoUrl,
            generationStatus: 'generation_success',
            persistenceStatus: 'persistence_success',
            assetStatus: 'ready',
            submittedInput,
            providerResponse: result.providerResponse,
            mediaPersistence: persistence,
            assetIntelligence,
          },
        },
      }, { status: 200 })
    }

    const errorCode = visiblePersistenceErrorCode(persistence.errorCode)
    const displayUrl = persistence.providerOriginalUrl || persistence.temporaryUrl || result.videoUrl
    const persistencePending = persistence.persistenceStatus === 'pending_persistence'
    return NextResponse.json({
      success: true,
      providerId,
      taskId,
      status: persistencePending ? 'succeeded_with_persistence_pending' : 'done',
      videoUrl: displayUrl,
      resultVideoUrl: displayUrl,
      assetUrl: persistence.assetId && !persistencePending ? displayUrl : undefined,
      resolvedUrl: persistencePending ? undefined : displayUrl,
      stableUrl: displayUrl,
      assetId: persistence.assetId,
      outputAssetId: persistence.assetId,
      asset: persistence.assetId ? {
        id: persistence.assetId,
        type: 'VIDEO',
        url: displayUrl,
        dataUrl: null,
        thumbnailUrl: null,
        providerId: 'generated-media-persistence',
        generationJobId: generationJob?.id,
        projectId,
        workflowId,
        nodeId,
        status: persistencePending ? 'pending_persistence' : 'failed',
      } : undefined,
      generationStatus: 'generation_success',
      persistenceStatus: persistencePending ? 'pending_persistence' : 'persistence_failed',
      assetStatus: persistencePending ? 'pending_persistence' : 'failed',
      persistenceError: errorCode,
      errorCode: undefined,
      errorMessage: undefined,
      message: persistencePending ? '媒体已生成，资产库上传待重试。' : `视频生成成功，但媒体转存失败：${persistence.errorMessage || persistence.message}`,
      generationStage: persistence.generationStage,
      stage: persistence.stage,
      upstreamStatus: persistence.upstreamStatus,
      upstreamMessage: persistence.upstreamMessage,
      providerEndpoint: persistence.providerEndpoint ?? result.providerEndpoint,
      providerRequestMethod: persistence.providerRequestMethod ?? result.providerRequestMethod,
      providerHttpStatus: persistence.providerHttpStatus ?? result.providerHttpStatus,
      providerFetchError: persistence.providerFetchError,
      providerFetchCause: persistence.providerFetchCause,
      storageProvider: persistence.storageProvider,
      bucket: persistence.bucket,
      storageKey: persistence.storageKey,
      attemptedUploadKey: persistence.attemptedUploadKey,
      ossRequestId: persistence.ossRequestId,
      sourceUrl: persistence.sourceUrl,
      mediaDownloadUrl: persistence.mediaDownloadUrl,
      originalProviderVideoUrl: persistence.sourceUrl ?? undefined,
      providerOriginalUrl: result.videoUrl,
      temporaryUrl: result.videoUrl,
      retryPersistenceAvailable: persistence.retryPersistenceAvailable ?? Boolean(persistence.assetId),
      mediaPersistence: { status: persistencePending ? 'pending_persistence' : 'failed', ...persistence, errorCode },
      assetIntelligence,
      model: result.model,
      requestId: persistence.requestId ?? result.requestId,
      submittedInput,
      providerResponse: result.providerResponse,
      result: {
        videoUrl: displayUrl,
        previewUrl: displayUrl,
        metadata: {
          model: result.model,
          taskId,
          providerJobId: taskId,
          generationJobId: generationJob?.id,
          generationStatus: 'generation_success',
          persistenceStatus: persistencePending ? 'pending_persistence' : 'persistence_failed',
          assetStatus: persistencePending ? 'pending_persistence' : 'failed',
          providerOriginalUrl: result.videoUrl,
          temporaryUrl: result.videoUrl,
          originalProviderVideoUrl: result.videoUrl,
          ...(persistence.assetId ? { assetId: persistence.assetId, outputAssetId: persistence.assetId } : {}),
          ...(persistence.assetId && !persistencePending ? { assetUrl: displayUrl, resolvedUrl: displayUrl } : {}),
          stableUrl: displayUrl,
          storageProvider: persistence.storageProvider,
          bucket: persistence.bucket,
          storageKey: persistence.storageKey,
          persistenceError: errorCode,
          attemptedUploadKey: persistence.attemptedUploadKey,
          ossRequestId: persistence.ossRequestId,
          retryPersistenceAvailable: persistence.retryPersistenceAvailable ?? Boolean(persistence.assetId),
          nextAction: 'retry_persistence',
          lastGenerationError: null,
          submittedInput,
          providerResponse: result.providerResponse,
          mediaPersistence: { status: persistencePending ? 'pending_persistence' : 'failed', ...persistence, errorCode },
          assetIntelligence,
        },
      },
    }, { status: 200 })
  }

  return NextResponse.json({
    success: true,
    providerId,
    taskId,
    status: result.status,
    videoUrl: result.status === 'done' ? result.videoUrl : undefined,
    model: result.model,
    message: result.message,
  }, { status: 200 })
}
