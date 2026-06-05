// Pure analysis function — no React, no side effects, no API calls.

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info'
export type CheckGroup = 'content' | 'config' | 'asset'
export type OverallStatus = 'ready' | 'needs_attention' | 'blocked'

export interface ReadinessAction {
  label: string
  kind: 'append-prompt' | 'navigate'
  value?: string
  href?: string
}

export interface ReadinessCheck {
  id: string
  group: CheckGroup
  status: CheckStatus
  title: string
  detail: string
  action?: ReadinessAction
}

export interface ReadinessResult {
  overallStatus: OverallStatus
  checks: ReadinessCheck[]
  promptSkeleton: string
  assetSummary: string | null
  copyableReport: string
}

export interface UserAccountLike {
  id: string
  providerId: string
  accountLabel: string
  keyLast4: string
  status: string
  fieldMeta?: Record<string, { label: string; last4: string; updatedAt: string }> | null
}

export interface ReadinessInput {
  nodeKind: 'text' | 'image' | 'video'
  nodeTitle: string
  nodeId: string
  nodeStatus: string
  prompt: string
  providerId: string
  providerStatus?: string | null
  billingMode: 'platform_credits' | 'user_provider_account'
  selectedUserAccountId: string
  userProviderAccounts: UserAccountLike[]
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  resultText?: string | null
  assetId?: string | null
  metadataJson: unknown
  projectId: string
}

// ─── safe accessors ───────────────────────────────────────────────────────────

function safeRecord(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {}
}

function safeStr(val: unknown): string {
  return typeof val === 'string' ? val.trim() : ''
}

function firstStr(arr: unknown): string {
  return Array.isArray(arr) ? safeStr(arr[0]) : ''
}

// ─── keyword lists ────────────────────────────────────────────────────────────

const IMAGE_VISUAL_WORDS = [
  '场景', '背景', '风格', '光线', '色调', '室内', '室外', '阳光', '夜晚', '白天',
  'scene', 'background', 'style', 'light', 'dark', 'outdoor', 'indoor',
  'photo', 'portrait', 'landscape', 'cinematic', 'realistic', 'bright',
  'close-up', 'closeup', 'wide', 'angle', 'shot', 'bokeh', 'color',
]

const VIDEO_MOTION_WORDS = [
  '走', '跑', '移动', '运动', '旋转', '飞', '流', '摇', '推', '拉', '镜头',
  '动作', '行走', '跳', '转', '漂', '漫游', '秒',
  'walk', 'run', 'move', 'motion', 'camera', 'dolly', 'pan', 'zoom',
  'track', 'rotate', 'fly', 'flow', 'action', 'slow', 'fast', 'smooth',
  'seconds', 'sec',
]

const ACTIVE_STATUSES = new Set(['queued', 'running', 'generating', 'pending', 'processing'])

// ─── error fix guidance ────────────────────────────────────────────────────────

const ERROR_FIX_MAP: Record<string, string> = {
  oss_upload_error: '存储上传失败。通常重新生成可解决，若持续出现请联系管理员检查 OSS 配置。',
  oss_upload_timeout: '存储上传超时。建议检查网络连接后重新生成。',
  oss_auth_error: 'OSS 认证失败。建议联系管理员检查存储配置。',
  oss_permission_error: 'OSS 权限错误。建议联系管理员检查权限设置。',
  oss_config_error: 'OSS 配置错误。建议联系管理员修复存储配置。',
  provider_timeout: 'Provider 响应超时。建议稍等片刻后重新生成。',
  provider_network_failed: '网络连接失败。建议检查网络后重新生成。',
  client_fetch_failed: '客户端网络请求失败。建议检查网络连接后重新生成。',
  provider_auth_failed: 'Provider 认证失败。建议检查 API Key 是否正确。',
  provider_quota_or_billing_error: 'Provider 额度不足或计费错误。建议检查账户余额，或切换其他 Provider。',
  provider_env_missing: 'Provider 未配置。建议联系管理员配置环境变量。',
  generation_auth_unavailable: '数据库连接超时。建议稍等片刻后重新生成。',
  generation_stopped_on_reload: '页面刷新导致生成中断。点击重新生成即可继续。',
  generation_failed: '生成失败。建议检查 Prompt 内容后重新生成。',
  provider_media_download_failed: '媒体下载失败。建议重新生成或从资产库恢复。',
  asset_persistence_error: '资产保存失败。建议打开资产库确认资产状态。',
  missing_generation_input: '缺少必要生成参数。建议检查节点配置后重新生成。',
  provider_request_failed: 'Provider 请求失败。建议稍后重新生成。',
  provider_no_download_url: 'Provider 未返回媒体地址。建议重新生成。',
}

function getErrorFix(code: string): string {
  return ERROR_FIX_MAP[code] || `生成出错（${code}）。建议重新生成，或查看节点详情。`
}

// ─── prompt skeleton ──────────────────────────────────────────────────────────

function buildPromptSkeleton(kind: 'text' | 'image' | 'video'): string {
  if (kind === 'image') {
    return '主体：[人物/物体/场景]；场景：[地点/时间]；构图：[景别/角度]；光线：[风格]；色调：[色彩]；风格：[写实/电影感]。'
  }
  if (kind === 'video') {
    return '主体：[人物/物体]；动作：[具体行为]；运镜：[静止/推进/跟拍]；时长：5秒；光线：[风格]；氛围：[情绪]。'
  }
  return '目标：[期望输出]；语气：[口吻/风格]；结构：[段落/要点]；字数：[预期长度]。'
}

// ─── asset intelligence summary ───────────────────────────────────────────────

function buildAssetSummary(ai: Record<string, unknown>): string | null {
  const parts: string[] = []
  const scene = safeRecord(ai.scene)
  const cinematography = safeRecord(ai.cinematography)
  const visualStyle = safeRecord(ai.visualStyle)
  if (safeStr(scene.location)) parts.push(`场景：${safeStr(scene.location)}`)
  if (firstStr(visualStyle.colorPalette)) parts.push(`色调：${firstStr(visualStyle.colorPalette)}`)
  if (firstStr(cinematography.shotType)) parts.push(`景别：${firstStr(cinematography.shotType)}`)
  if (firstStr(ai.mood)) parts.push(`情绪：${firstStr(ai.mood)}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

// ─── label helpers ────────────────────────────────────────────────────────────

function billingLabel(mode: string): string {
  return mode === 'platform_credits' ? '平台额度' : '我的 API 账户'
}

function providerStatusLabel(status: string | null | undefined): string {
  const map: Record<string, string> = {
    available: '可用',
    'not-configured': '未配置',
    'coming-soon': '即将上线',
    disabled: '已禁用',
    checking: '检测中',
    unknown: '状态未知',
    mock: '模拟模式',
  }
  return (status && map[status]) || status || '状态未知'
}

// ─── main export ──────────────────────────────────────────────────────────────

export function checkReadiness(input: ReadinessInput): ReadinessResult {
  const checks: ReadinessCheck[] = []
  const meta = safeRecord(input.metadataJson)

  const errorCode = safeStr(meta.errorCode) || safeStr(meta.rawErrorCode)
  const assetIdFromMeta = safeStr(meta.assetId)
  const resultImageUrlFromMeta = safeStr(meta.resultImageUrl)
  const resultVideoUrlFromMeta = safeStr(meta.resultVideoUrl)

  const aiRaw = meta.assetIntelligence
  const assetIntelligence = aiRaw && typeof aiRaw === 'object' && !Array.isArray(aiRaw)
    ? safeRecord(aiRaw)
    : null

  const effectiveResultImageUrl = input.resultImageUrl?.trim() || resultImageUrlFromMeta
  const effectiveResultVideoUrl = input.resultVideoUrl?.trim() || resultVideoUrlFromMeta
  const effectiveAssetId = input.assetId?.trim() || assetIdFromMeta

  const hasResult = Boolean(
    effectiveResultImageUrl || effectiveResultVideoUrl || input.resultText?.trim(),
  )
  const isActive = ACTIVE_STATUSES.has(input.nodeStatus)
  const promptTrimmed = input.prompt.trim()
  const promptLen = promptTrimmed.length

  // ── A. Node Content ─────────────────────────────────────────────────────────

  if (promptLen === 0) {
    checks.push({
      id: 'prompt_empty',
      group: 'content',
      status: 'fail',
      title: 'Prompt 为空',
      detail: '请先输入描述内容后再生成。',
      action: {
        label: '加入 Prompt 骨架',
        kind: 'append-prompt',
        value: buildPromptSkeleton(input.nodeKind),
      },
    })
  } else if (promptLen < 10) {
    checks.push({
      id: 'prompt_short',
      group: 'content',
      status: 'warn',
      title: `Prompt 较短（${promptLen} 字）`,
      detail: '建议补充更多细节（建议 20 字以上）以获得更好的生成结果。',
      action: {
        label: '加入 Prompt 骨架',
        kind: 'append-prompt',
        value: buildPromptSkeleton(input.nodeKind),
      },
    })
  } else {
    checks.push({
      id: 'prompt_ok',
      group: 'content',
      status: 'pass',
      title: `Prompt 已填写（${promptLen} 字）`,
      detail: '内容长度充足。',
    })
  }

  if (input.nodeKind === 'image' && promptLen > 0) {
    const lower = promptTrimmed.toLowerCase()
    const hasVisual = IMAGE_VISUAL_WORDS.some((w) => lower.includes(w.toLowerCase()))
    checks.push(hasVisual
      ? {
          id: 'image_visual_ok',
          group: 'content',
          status: 'pass',
          title: '包含视觉描述词',
          detail: '已检测到场景或风格相关描述。',
        }
      : {
          id: 'image_visual_hint',
          group: 'content',
          status: 'warn',
          title: '未检测到场景/风格描述',
          detail: '图片 Prompt 建议包含场景、光线、风格等视觉描述词。',
          action: {
            label: '加入 Prompt 骨架',
            kind: 'append-prompt',
            value: buildPromptSkeleton('image'),
          },
        })
  }

  if (input.nodeKind === 'video' && promptLen > 0) {
    const lower = promptTrimmed.toLowerCase()
    const hasMotion = VIDEO_MOTION_WORDS.some((w) => lower.includes(w.toLowerCase()))
    checks.push(hasMotion
      ? {
          id: 'video_motion_ok',
          group: 'content',
          status: 'pass',
          title: '包含运动描述词',
          detail: '已检测到动作或镜头运动相关描述。',
        }
      : {
          id: 'video_motion_hint',
          group: 'content',
          status: 'warn',
          title: '未检测到运动/动作描述',
          detail: '视频 Prompt 建议包含主体动作或镜头运动描述。',
          action: {
            label: '加入 Prompt 骨架',
            kind: 'append-prompt',
            value: buildPromptSkeleton('video'),
          },
        })
  }

  // ── B. Generation Config ─────────────────────────────────────────────────────

  if (isActive) {
    checks.push({
      id: 'node_active',
      group: 'config',
      status: 'warn',
      title: '节点正在生成中',
      detail: '请等待当前任务完成后再做变更。',
    })
  }

  const provStatus = input.providerStatus
  if (provStatus === 'not-configured' || provStatus === 'disabled' || provStatus === 'coming-soon') {
    checks.push({
      id: 'provider_blocked',
      group: 'config',
      status: 'fail',
      title: `Provider 不可用（${providerStatusLabel(provStatus)}）`,
      detail: '当前 Provider 未配置或已禁用，无法生成。',
      action: { label: '查看 API 配置', kind: 'navigate', href: '/providers' },
    })
  } else if (!provStatus || provStatus === 'checking' || provStatus === 'unknown') {
    checks.push({
      id: 'provider_unknown',
      group: 'config',
      status: 'warn',
      title: 'Provider 状态未知',
      detail: '无法确认 Provider 是否可用，生成可能失败。',
    })
  } else {
    checks.push({
      id: 'provider_ok',
      group: 'config',
      status: 'pass',
      title: `Provider 可用（${safeStr(input.providerId) || '默认'}）`,
      detail: `状态：${providerStatusLabel(provStatus)}。`,
    })
  }

  if (input.billingMode === 'platform_credits') {
    checks.push({
      id: 'billing_platform',
      group: 'config',
      status: 'pass',
      title: '费用来源：平台额度',
      detail: '使用平台额度，请确保账户余额充足。',
    })
  } else {
    const activeAccounts = input.userProviderAccounts.filter((a) => a.status === 'active')
    if (activeAccounts.length === 0) {
      checks.push({
        id: 'byok_no_accounts',
        group: 'config',
        status: 'fail',
        title: '未找到可用 API 账户',
        detail: '已选择"我的 API 账户"模式，但当前没有可用账户。',
        action: { label: '去添加 API 账户', kind: 'navigate', href: '/account/providers' },
      })
    } else if (!input.selectedUserAccountId) {
      checks.push({
        id: 'byok_not_selected',
        group: 'config',
        status: 'fail',
        title: '未选择 API 账户',
        detail: '请在节点对话框中选择一个 API 账户。',
        action: { label: '查看 API 账户', kind: 'navigate', href: '/account/providers' },
      })
    } else {
      const selectedAcc = input.userProviderAccounts.find((a) => a.id === input.selectedUserAccountId)
      if (!selectedAcc) {
        checks.push({
          id: 'byok_account_missing',
          group: 'config',
          status: 'warn',
          title: 'API 账户未找到',
          detail: '选中的账户可能已被删除，请重新选择。',
          action: { label: '查看 API 账户', kind: 'navigate', href: '/account/providers' },
        })
      } else {
        checks.push({
          id: 'byok_ok',
          group: 'config',
          status: 'pass',
          title: `API 账户已选择`,
          detail: `${selectedAcc.accountLabel || '已选择'} · 尾号 ****${selectedAcc.keyLast4}`,
        })
        if (input.nodeKind === 'image') {
          const hasEndpointId = Boolean(selectedAcc.fieldMeta?.endpointId)
          checks.push(hasEndpointId
            ? {
                id: 'byok_endpoint_ok',
                group: 'config',
                status: 'pass',
                title: 'Endpoint ID 已配置',
                detail: `EP:****${selectedAcc.fieldMeta?.endpointId?.last4 ?? '????'}`,
              }
            : {
                id: 'byok_endpoint_missing',
                group: 'config',
                status: 'fail',
                title: '缺少 Endpoint ID',
                detail: '图片生成（火山方舟）需要 Endpoint ID，请在 API 账户页补充。',
                action: { label: '去补充 Endpoint ID', kind: 'navigate', href: '/account/providers' },
              })
        }
      }
    }
  }

  // ── C. Asset Status ──────────────────────────────────────────────────────────

  // Error first — most actionable
  if (errorCode) {
    checks.push({
      id: 'last_error',
      group: 'asset',
      status: 'fail',
      title: `上次错误：${errorCode}`,
      detail: getErrorFix(errorCode),
    })
  }

  if (hasResult) {
    const resultKind = effectiveResultImageUrl ? '图片' : effectiveResultVideoUrl ? '视频' : '文本'
    checks.push({
      id: 'has_result',
      group: 'asset',
      status: 'pass',
      title: `已有生成结果（${resultKind}）`,
      detail: '如需更新，请修改 Prompt 后重新生成。生成前请确认不需要保留当前版本。',
    })
  } else if (!isActive && !errorCode) {
    checks.push({
      id: 'no_result',
      group: 'asset',
      status: 'info',
      title: '尚未生成结果',
      detail: '配置好 Prompt 和参数后，点击生成按钮开始创作。',
    })
  }

  if (effectiveAssetId) {
    checks.push({
      id: 'asset_persisted',
      group: 'asset',
      status: 'pass',
      title: '已绑定资产库',
      detail: '生成结果已保存，可在资产库查看和管理。',
      action: { label: '打开资产库', kind: 'navigate', href: '/assets' },
    })
  } else if (hasResult) {
    checks.push({
      id: 'asset_not_persisted',
      group: 'asset',
      status: 'warn',
      title: '未找到资产绑定记录',
      detail: '已有生成结果，但未找到资产 ID。建议打开资产库确认是否已保存。',
      action: { label: '打开资产库', kind: 'navigate', href: '/assets' },
    })
  }

  if (assetIntelligence) {
    const summary = buildAssetSummary(assetIntelligence)
    checks.push({
      id: 'asset_intelligence_ok',
      group: 'asset',
      status: 'pass',
      title: '资产智能分析已完成',
      detail: summary || '可在 Prompt Inspector 查看完整分析结果。',
    })
  } else if (hasResult) {
    checks.push({
      id: 'asset_intelligence_pending',
      group: 'asset',
      status: 'info',
      title: '资产智能分析待写入',
      detail: '当前节点未见智能分析数据，下次生成后会自动写入。',
    })
  }

  // ── Overall status ───────────────────────────────────────────────────────────

  let overallStatus: OverallStatus = 'ready'
  for (const check of checks) {
    if (check.status === 'fail') { overallStatus = 'blocked'; break }
    if (check.status === 'warn') overallStatus = 'needs_attention'
  }

  // ── Copyable report ──────────────────────────────────────────────────────────

  const statusEmoji = overallStatus === 'ready' ? '✅ 准备好生成' : overallStatus === 'needs_attention' ? '⚠️ 需注意' : '❌ 有阻塞'
  const promptPreview = promptTrimmed.length > 120 ? `${promptTrimmed.slice(0, 117)}...` : promptTrimmed
  const grouped: Record<CheckGroup, ReadinessCheck[]> = { content: [], config: [], asset: [] }
  for (const c of checks) grouped[c.group].push(c)
  const groupLabels: Record<CheckGroup, string> = {
    content: '【A. 节点内容】',
    config: '【B. 生成配置】',
    asset: '【C. 资产状态】',
  }
  const lines: string[] = [
    '=== Creator City 生成前体检 ===',
    `节点：${input.nodeTitle || '未命名'} (${input.nodeKind})`,
    `Provider：${input.providerId || '默认'}`,
    `费用来源：${billingLabel(input.billingMode)}`,
    '',
    `总体状态：${statusEmoji}`,
    '',
  ]
  for (const group of (['content', 'config', 'asset'] as CheckGroup[])) {
    const items = grouped[group]
    if (items.length === 0) continue
    lines.push(groupLabels[group])
    for (const item of items) {
      const icon = item.status === 'pass' ? '✅' : item.status === 'warn' ? '⚠️' : item.status === 'fail' ? '❌' : 'ℹ️'
      lines.push(`  ${icon} ${item.title}：${item.detail}`)
    }
    lines.push('')
  }
  if (promptPreview) {
    lines.push('Prompt 预览（前 120 字）：')
    lines.push(promptPreview)
  }

  return {
    overallStatus,
    checks,
    promptSkeleton: buildPromptSkeleton(input.nodeKind),
    assetSummary: assetIntelligence ? buildAssetSummary(assetIntelligence) : null,
    copyableReport: lines.join('\n'),
  }
}
