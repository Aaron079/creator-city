/**
 * Asset Transform Error codes — shared between API route and UI panels.
 *
 * Each code maps to a user-facing message in the panel. Panels must never
 * show the raw errorCode string to users.
 */

export type AssetTransformErrorCode =
  // Capability / executor
  | 'TRANSFORM_UNSUPPORTED'           // This kind is not supported by any registered executor
  | 'TRANSFORM_EXECUTOR_UNAVAILABLE'  // Executor service is unreachable or not configured
  // Auth / access
  | 'TRANSFORM_AUTH_FAILED'           // Auth token invalid for this executor
  | 'TRANSFORM_PROJECT_FORBIDDEN'     // Project does not belong to the authenticated user
  | 'TRANSFORM_SOURCE_NOT_FOUND'      // Source node does not exist in the project
  | 'TRANSFORM_RATE_LIMITED'          // Executor rate limit exceeded
  // Input validation
  | 'TRANSFORM_INPUT_INVALID'         // Source URL missing, dimensions out of range, etc.
  | 'TRANSFORM_INPUT_TOO_LARGE'       // Image exceeds executor's max input size
  // Network / timeout
  | 'TRANSFORM_TIMEOUT'               // Job exceeded max polling duration
  // Job lifecycle
  | 'TRANSFORM_OUTPUT_MISSING'        // Job completed but no output asset was produced
  | 'TRANSFORM_OUTPUT_INGESTION_BLOCKED' // Output received but could not be written to platform storage
  | 'TRANSFORM_CANCELLED'             // User or system cancelled the job
  // License / policy
  | 'TRANSFORM_LICENSE_BLOCKED'       // Model license prohibits this usage (e.g. non-commercial)
  // Catch-all
  | 'TRANSFORM_UNKNOWN'               // Unclassified error

// ─── User-facing messages ─────────────────────────────────────────────────────

export const TRANSFORM_ERROR_MESSAGES: Record<AssetTransformErrorCode, {
  title: string
  description: string
  canRetry: boolean
}> = {
  TRANSFORM_UNSUPPORTED: {
    title: '此功能暂不支持该类型',
    description: '当前执行器不支持此变换类型。请联系运营团队确认支持范围。',
    canRetry: false,
  },
  TRANSFORM_EXECUTOR_UNAVAILABLE: {
    title: '执行器未配置',
    description: '此工具需要专用 GPU 执行器支持。当前服务未配置此能力，请联系运营团队开通。',
    canRetry: false,
  },
  TRANSFORM_AUTH_FAILED: {
    title: '执行器认证失败',
    description: '执行器 API 密钥无效或已过期。请检查服务配置。',
    canRetry: false,
  },
  TRANSFORM_PROJECT_FORBIDDEN: {
    title: '无权访问该项目',
    description: '当前账号无权对此项目执行资产变换操作。',
    canRetry: false,
  },
  TRANSFORM_SOURCE_NOT_FOUND: {
    title: '源节点不存在',
    description: '指定的源图片节点在该项目中不存在，或尚未保存到云端。',
    canRetry: false,
  },
  TRANSFORM_RATE_LIMITED: {
    title: '请求过于频繁',
    description: '执行器服务请求频率已达上限。请稍后重试。',
    canRetry: true,
  },
  TRANSFORM_INPUT_INVALID: {
    title: '输入资产无效',
    description: '源资产 URL 无法访问，或格式不受支持。请确认节点已成功生成结果图片。',
    canRetry: false,
  },
  TRANSFORM_INPUT_TOO_LARGE: {
    title: '图片尺寸超出限制',
    description: '源图片尺寸超出执行器处理上限。请先使用较小尺寸的图片。',
    canRetry: false,
  },
  TRANSFORM_TIMEOUT: {
    title: '处理超时',
    description: '执行器在规定时间内未返回结果。任务可能仍在运行，请前往资产库检查。',
    canRetry: true,
  },
  TRANSFORM_OUTPUT_MISSING: {
    title: '处理完成但无输出',
    description: '执行器报告任务完成，但未返回输出资产。请重试，或联系运营团队。',
    canRetry: true,
  },
  TRANSFORM_OUTPUT_INGESTION_BLOCKED: {
    title: '输出写入失败',
    description: '变换结果已生成，但无法写入平台存储。源资产未受影响。请联系运营团队。',
    canRetry: false,
  },
  TRANSFORM_CANCELLED: {
    title: '已取消',
    description: '变换任务已取消。源资产未受影响。',
    canRetry: true,
  },
  TRANSFORM_LICENSE_BLOCKED: {
    title: '许可证限制',
    description: '所选模型的许可证不允许此用途。请联系运营团队选择合规模型。',
    canRetry: false,
  },
  TRANSFORM_UNKNOWN: {
    title: '未知错误',
    description: '变换过程中发生未知错误。源资产未受影响，请重试。',
    canRetry: true,
  },
}

export function getTransformErrorInfo(code: string): typeof TRANSFORM_ERROR_MESSAGES[AssetTransformErrorCode] {
  const key = code as AssetTransformErrorCode
  return TRANSFORM_ERROR_MESSAGES[key] ?? TRANSFORM_ERROR_MESSAGES.TRANSFORM_UNKNOWN
}
