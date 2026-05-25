// Static diagnostic data — no API calls, no secrets, no env values exposed.
// Read-only. Never used in generation routes.

export type DiagnosticCategory = {
  id: string
  title: string
  icon: string
  summary: string
  checks: string[]
  doNot: string[]
  steps: string[]
}

export type ErrorCodeEntry = {
  code: string
  meaning: string
  symptom: string
  stage: string
  checkFirst: string
  doNot: string
  steps: string[]
}

export type NetworkCheck = {
  title: string
  filter: string
  method: string
  expectation: string
  tokenDrain: boolean
}

export type GuardrailRule = {
  id: string
  label: string
  description: string
  severity: 'critical' | 'high' | 'medium'
}

// ─── Quick diagnostic categories ────────────────────────────────────────────

export const diagnosticCategories: DiagnosticCategory[] = [
  {
    id: 'image-not-showing',
    title: '图片不显示',
    icon: '🖼️',
    summary: '节点有 stableUrl 但图片区域空白或显示错误面板',
    checks: [
      '打开 DevTools → Network，搜索 "oss"，查看图片 URL 是否返回 403/404',
      '检查节点 metadata.stableUrl 是否为 Aliyun OSS URL 格式',
      '检查 ALIYUN_OSS_PUBLIC_BASE_URL 环境变量与实际 bucket 域名是否一致',
      '查看 CanvasNodeCard 是否显示 asset_not_found_by_node 错误',
    ],
    doNot: [
      '不要修改 /api/generate/image 或 CanvasNodeCard.tsx 来绕过 URL 检查',
      '不要删除 isRenderableMediaUrl 的 source 参数',
    ],
    steps: [
      '1. 复制节点诊断 JSON（节点上的"复制该节点诊断 JSON"按钮）',
      '2. 检查 stableUrl / resultImageUrl 字段是否存在',
      '3. 在浏览器新标签中直接打开 stableUrl，查看是否可访问',
      '4. 若返回 403：检查 Aliyun OSS bucket 读权限（公开读 or 签名 URL）',
      '5. 若 URL 为空：上次生成可能 OSS 上传失败，需重新生成',
    ],
  },
  {
    id: 'video-not-showing',
    title: '视频不显示',
    icon: '🎬',
    summary: '视频节点显示错误面板，或视频加载失败',
    checks: [
      '检查节点是否显示"刷新页面并重新登录"——说明 lastGenerationError.errorCode = UNAUTHORIZED',
      '检查 resultVideoUrl / stableUrl 字段是否存在于节点 metadata',
      'Network → 过滤 .mp4，查看视频 URL 的 HTTP 状态码',
      '尝试在新标签中直接打开 stableUrl',
    ],
    doNot: [
      '不要重刷页面来"修复"视频——刷新会触发 generation_stopped_on_reload 降级',
      '不要删除 resultVideoUrl 字段来"重置"节点',
    ],
    steps: [
      '1. 先确认上次生成是否成功（/tasks 页面查看该节点对应的 GenerationJob）',
      '2. 若任务状态 SUCCEEDED：stableUrl 应在 DB，检查 canvas 是否已保存该值',
      '3. 若 canvas 保存失败：localStorage draft 中可能有 resultVideoUrl，尝试刷新页面',
      '4. 若任务状态 FAILED：需要重新生成',
      '5. 若 stableUrl 存在但无法播放：检查 OSS bucket 的读权限',
    ],
  },
  {
    id: 'image-gen-failed',
    title: '图片生成失败',
    icon: '❌',
    summary: '点击生成后节点进入 error 状态',
    checks: [
      'Network → POST /api/generate/image 的响应 JSON（查看 errorCode 字段）',
      '查看节点错误面板的 errorCode / errorStage 字段',
      '检查 /providers 页面 Volcengine Seedream 配置状态',
      '检查 cn-executor /health 是否正常',
    ],
    doNot: [
      '不要修改 /api/generate/image/route.ts 来绕过错误',
      '不要删除 maxPolls 上限',
    ],
    steps: [
      '1. errorCode = UNAUTHORIZED → 重新登录（session 已过期）',
      '2. errorCode = provider_env_missing → 检查 Vercel 环境变量 ARK_API_KEY / CN_EXECUTOR_SECRET',
      '3. errorCode = executor_trigger_timeout → cn-executor 启动超时，检查 Aliyun FC 状态',
      '4. errorCode = oss_upload_error → 检查 OSS RAM 用户权限（需要 oss:PutObject）',
      '5. errorCode = provider_timeout → Volcengine Seedream API 超时，稍后重试',
    ],
  },
  {
    id: 'video-gen-failed',
    title: '视频生成失败',
    icon: '📹',
    summary: '视频节点进入 error 状态，或一直停在 queued/running',
    checks: [
      'Network → POST /api/generate/video 的响应 JSON',
      '/tasks 页面查看对应的 GenerationJob 状态和错误信息',
      '查看节点 errorCode / errorStage / stageTrace 字段',
    ],
    doNot: [
      '不要把 maxPolls 从 24 改为更大值来"等更久"——先排查根因',
      '不要修改 video/status 路由的 degraded-mode 逻辑',
    ],
    steps: [
      '1. 确认 /providers 页面 Volcengine Seedance 配置正常',
      '2. 视频生成通常需要 1-3 分钟，24 × 5s = 120s 是上限',
      '3. 若超时 → /tasks 中查看 GenerationJob 的 cn-executor 日志',
      '4. 若 oss_upload_error → cn-executor /debug/oss-write-probe 确认写权限',
      '5. 若 executor_not_started → cn-executor 没收到任务，检查 CN_EXECUTOR_BASE_URL',
    ],
  },
  {
    id: 'task-queued-forever',
    title: '任务一直 queued/running',
    icon: '⏳',
    summary: 'GenerationJob 超过 2 分钟仍为 QUEUED，或超过 5 分钟仍为 RUNNING',
    checks: [
      '/tasks 页面查看该任务的 createdAt 和 status',
      'cn-executor GET /health — 服务是否在线',
      '检查 CN_EXECUTOR_BASE_URL 环境变量是否正确指向 Aliyun FC 函数',
    ],
    doNot: [
      '不要删除前端的 maxPolls 保护',
      '不要手动修改 DB 中 GenerationJob 的状态',
    ],
    steps: [
      '1. errorCode = executor_not_started：cn-executor 没启动 → 检查 Aliyun FC 控制台',
      '2. errorCode = generation_job_stalled：cn-executor 卡住 → 查看 FC 函数日志',
      '3. 检查 Vercel 日志：POST /api/generate/image|video 是否成功触发 cn-executor',
      '4. cn-executor /debug/oss-write-probe 确认 OSS 写入正常',
      '5. 重新部署 cn-executor 后用 GET /health 确认新版本上线',
    ],
  },
  {
    id: 'oss-upload-failed',
    title: 'OSS 上传失败',
    icon: '☁️',
    summary: '生成结果有图/视频 URL，但无法写入 Aliyun OSS，节点显示 oss_upload_error',
    checks: [
      'cn-executor GET /debug/oss-write-probe（需要 CN_EXECUTOR_SECRET）',
      'cn-executor GET /debug/oss-config — 查看 masked 配置',
      'Aliyun RAM 控制台 → creator-city-oss 用户 → 确认有 oss:PutObject 权限',
    ],
    doNot: [
      '不要在代码中绕过 OSS 上传（直接返回临时 provider URL 不是持久化）',
    ],
    steps: [
      '1. 访问 /debug/oss-write-probe，看是否返回 { ok: true }',
      '2. 若 AccessDenied → RAM 用户缺少 oss:PutObject，在 Aliyun RAM 控制台授权',
      '3. 若 NoSuchBucket → ALIYUN_OSS_BUCKET 环境变量配置错误',
      '4. 若 timeout → OSS 网络或 FC 函数出口 IP 被限制，检查 FC 函数 VPC 配置',
      '5. 修复后重新部署 cn-executor，再用 /debug/oss-write-probe 验证',
    ],
  },
  {
    id: 'login-failed',
    title: '登录/注册失败',
    icon: '🔐',
    summary: '无法登录，或生成时出现 UNAUTHORIZED 错误',
    checks: [
      'Network → POST /api/auth/login 的响应状态和 JSON',
      '检查 Supabase 控制台 Authentication 是否正常',
      '检查 DATABASE_URL 是否指向 Supabase Session Pooler（?pgbouncer=true）',
    ],
    doNot: [
      '不要在生成 API 路由中添加 auth bypass',
      '不要修改 middleware.ts 来跳过 cookie 检查',
    ],
    steps: [
      '1. UNAUTHORIZED on generate → session 过期，重新登录即可（session 已有 30 天滑动续期）',
      '2. 登录 POST 500 → Supabase 连接问题，检查 DATABASE_URL 格式',
      '3. "prepared statement s1 already exists" → DATABASE_URL 缺少 ?pgbouncer=true',
      '4. AUTH_DB_UNAVAILABLE → Supabase 连接池耗尽，等待或升级 Supabase plan',
      '5. 若问题持续 → 在 Supabase 控制台重置连接池',
    ],
  },
  {
    id: 'canvas-save-failed',
    title: 'Canvas 保存失败',
    icon: '💾',
    summary: '画布显示"保存失败"提示，或 Network 中 PUT/PATCH canvas 返回错误',
    checks: [
      'Network → PUT /api/projects/[id]/canvas 的状态码和响应',
      '检查是否有 401（session 过期）或 500（DB 错误）',
      'localStorage 中检查 creator-city-canvas-draft:<projectId> 是否存在',
    ],
    doNot: [
      '不要在 canvas save 失败时调用 setNodes([]) 清空画布',
      '不要删除 localStorage draft 保护逻辑',
    ],
    steps: [
      '1. canvas save 失败时，画布节点应仍在（toast 提示，不清空）',
      '2. localStorage draft 保护已启用：draft key = creator-city-canvas-draft:<projectId>',
      '3. 若 401 → 重新登录后手动保存（点击节点触发 autosave）',
      '4. 若 500 → Supabase DB 问题，等待恢复后画布数据在 localStorage 中安全',
      '5. 重要：刷新后从 localStorage draft 恢复，数据不丢失',
    ],
  },
  {
    id: 'provider-not-configured',
    title: 'Provider 未配置',
    icon: '⚙️',
    summary: '/providers 页面显示 Provider 未配置，或生成时 provider_env_missing',
    checks: [
      '/providers 页面查看哪个 Provider 状态为"未配置"',
      '检查 Vercel 环境变量中 ARK_API_KEY 是否存在',
      '检查 cn-executor 环境变量（Aliyun FC 控制台）',
    ],
    doNot: [
      '不要硬编码 API key 到代码中',
      '不要在前端暴露 env value',
    ],
    steps: [
      '1. Vercel Dashboard → Settings → Environment Variables',
      '2. 确认 CN_EXECUTOR_SECRET / CN_EXECUTOR_BASE_URL 已设置',
      '3. Aliyun FC → creator-city-cn-executor → 环境变量 → 确认 ARK_API_KEY',
      '4. 修改环境变量后需要重新部署（Vercel: Redeploy; FC: 重新部署函数）',
      '5. 重新部署后用 /providers 页面验证状态变为"已配置"',
    ],
  },
  {
    id: 'vercel-deploy-not-working',
    title: 'Vercel 部署后不生效',
    icon: '🚀',
    summary: '代码已 push，但生产环境仍是旧版本',
    checks: [
      'Vercel Dashboard → Deployments → 确认最新 commit 已部署',
      'git log --oneline -3 确认 commit hash',
      '浏览器强刷（Ctrl+Shift+R）清除缓存',
    ],
    doNot: [
      '不要在 Vercel 部署未完成时就声称"已修复"',
    ],
    steps: [
      '1. git push origin main 后等待 Vercel 自动部署（约 1-3 分钟）',
      '2. Vercel Dashboard → Deployments → 查看 Production 状态为 Ready',
      '3. 确认 Production commit hash = git log 最新 hash',
      '4. 若部署失败：查看 Build Logs，通常是 TypeScript 错误或 ESLint 错误',
      '5. pnpm --filter web build 本地先验证无错误再 push',
    ],
  },
]

// ─── Error code reference ────────────────────────────────────────────────────

export const errorCodes: ErrorCodeEntry[] = [
  {
    code: 'UNAUTHORIZED / auth_required',
    meaning: '用户 session 已过期或 DB session 查询失败',
    symptom: '节点显示"登录状态失效，请刷新并重新登录"；生成 API 返回 HTTP 401',
    stage: 'auth',
    checkFirst: '/api/auth/me 是否返回 authenticated: true',
    doNot: '不要在生成路由中添加 auth bypass；不要修改 middleware.ts 跳过 cookie',
    steps: [
      '重新登录（session 有 30 天滑动续期）',
      '若仍失败：检查 Supabase 连接是否正常',
      '若 DB 瞬断：session.ts 已有 retry 逻辑，等待后自动恢复',
    ],
  },
  {
    code: 'executor_not_started',
    meaning: 'GenerationJob 超过 2 分钟仍为 QUEUED，cn-executor 未拾取任务',
    symptom: '节点停在"排队中"超过 2 分钟，然后显示 executor_not_started',
    stage: 'executor_dispatch',
    checkFirst: 'cn-executor GET /health；Vercel 日志中 POST /api/generate/* 是否成功',
    doNot: '不要删除前端 maxPolls 保护',
    steps: [
      '检查 CN_EXECUTOR_BASE_URL 是否指向正确的 Aliyun FC 端点',
      'Aliyun FC 控制台查看函数状态',
      '重新部署 cn-executor 后用 /health 确认',
    ],
  },
  {
    code: 'generation_job_stalled',
    meaning: 'GenerationJob 超过 5 分钟仍在 RUNNING，cn-executor 处理卡住',
    symptom: '节点停在生成中超过 5 分钟，然后显示 generation_job_stalled',
    stage: 'executor_processing',
    checkFirst: 'cn-executor 函数日志（Aliyun FC 控制台）',
    doNot: '不要修改 stall 检测阈值来掩盖问题',
    steps: [
      '查看 cn-executor 函数执行日志',
      '确认 Volcengine Seedream/Seedance API 是否正常',
      '若 provider 超时：等待后重试',
    ],
  },
  {
    code: 'executor_trigger_timeout',
    meaning: '后端触发 cn-executor 超时（图片 50s，视频 12s）',
    symptom: '生成 POST 返回 executor_trigger_timeout',
    stage: 'executor_trigger',
    checkFirst: 'cn-executor /health；Aliyun FC 冷启动时间',
    doNot: '不要把前端 POST timeout 改小于 70s（image）/ 90s（video）',
    steps: [
      '确认 cn-executor 函数预留实例（避免冷启动）',
      '检查 CN_EXECUTOR_BASE_URL 网络连通性',
      '重试生成（任务可能已在后台执行）',
    ],
  },
  {
    code: 'generation_post_timeout',
    meaning: '前端 POST /api/generate/* 超时（客户端发起的超时）',
    symptom: '节点显示 generation_post_timeout，通常在慢网络下',
    stage: 'client_post',
    checkFirst: 'Network → POST /api/generate/* 的 Timing 标签',
    doNot: '不要把前端 timeout 改为更小值；不要重新 POST 同一节点',
    steps: [
      '检查网络连接是否稳定',
      '等待后检查 /tasks 页面——任务可能已在后台执行',
      '若任务不在 /tasks：重新生成',
    ],
  },
  {
    code: 'provider_timeout',
    meaning: 'Volcengine API（Seedream/Seedance）响应超时',
    symptom: '节点显示 provider_timeout，errorStage = seedream_provider 或 seedance_provider',
    stage: 'provider',
    checkFirst: '火山方舟控制台服务状态；重试是否成功',
    doNot: '不要修改 cn-executor 的 provider timeout 值来掩盖根因',
    steps: [
      '火山方舟控制台查看 API 状态',
      '等待 1-2 分钟后重试',
      '若持续超时：联系火山方舟支持',
    ],
  },
  {
    code: 'oss_upload_error',
    meaning: '通用 OSS 上传失败（Permission、Network、Config 等）',
    symptom: '节点显示 oss_upload_error，图片/视频 URL 为空',
    stage: 'oss_upload',
    checkFirst: 'cn-executor /debug/oss-write-probe',
    doNot: '不要跳过 OSS 上传直接返回 provider 临时 URL（临时 URL 会过期）',
    steps: [
      '/debug/oss-write-probe 确认 PutObject 权限',
      '若 AccessDenied：Aliyun RAM 控制台授权 oss:PutObject',
      '若 NoSuchBucket：检查 ALIYUN_OSS_BUCKET 环境变量',
    ],
  },
  {
    code: 'oss_permission_error',
    meaning: 'RAM 用户缺少 oss:PutObject 权限',
    symptom: '上传返回 AccessDenied',
    stage: 'oss_upload',
    checkFirst: 'Aliyun RAM 控制台 → creator-city-oss 用户 → 权限策略',
    doNot: '不要使用 root AK（安全风险）',
    steps: [
      'Aliyun RAM → 用户 creator-city-oss → 添加权限 AliyunOSSFullAccess 或自定义 PutObject 策略',
      '授权后用 /debug/oss-write-probe 验证',
    ],
  },
  {
    code: 'asset_not_found_by_node',
    meaning: '按 nodeId 在资产库中找不到对应 Asset 记录',
    symptom: '节点显示"asset_not_found_by_node：按 nodeId 或 assetId 未解析到可显示媒体"',
    stage: 'asset_resolve',
    checkFirst: '节点 metadata.stableUrl / resultImageUrl 是否有值',
    doNot: '不要手动删除 Asset 记录来"修复"节点',
    steps: [
      '若 stableUrl 存在：直接在浏览器打开 stableUrl 检查可访问性',
      '若 stableUrl 不存在：上次生成未成功写入 Asset，需重新生成',
      '重新生成后检查 /assets 页面是否出现新资产',
    ],
  },
  {
    code: 'generation_stopped_on_reload',
    meaning: '页面刷新时，正在生成的节点被安全降级为 error 状态',
    symptom: '刷新后节点显示此 errorCode（正常保护机制，不是 bug）',
    stage: 'client_reload',
    checkFirst: '这是正常的 token drain 保护机制',
    doNot: '不要修改 applyCanvasSnapshot 的降级逻辑来绕过此保护',
    steps: [
      '确认上次生成是否已在 /tasks 中完成（SUCCEEDED）',
      '若已完成：刷新后 canvas 应从 DB 加载 stableUrl',
      '若未完成：需重新点击生成按钮',
    ],
  },
  {
    code: 'provider_media_download_failed',
    meaning: 'cn-executor 无法从 provider 返回的临时 URL 下载媒体',
    symptom: '节点显示 provider_media_download_failed，generationStage = media_download',
    stage: 'provider_image_download',
    checkFirst: 'cn-executor 函数日志；mediaDownloadUrl 字段',
    doNot: '不要把 provider 临时 URL 直接存为 stableUrl',
    steps: [
      '查看节点诊断 JSON 中的 mediaDownloadUrl',
      '尝试直接访问该 URL 是否有效',
      '若 URL 已过期：重新生成',
      '若 cn-executor 网络问题：检查 FC 函数 VPC 出口配置',
    ],
  },
  {
    code: '"prepared statement s1 already exists"',
    meaning: 'Prisma + PgBouncer 事务模式冲突，DATABASE_URL 缺少 pgbouncer=true',
    symptom: 'DB 操作报错 "prepared statement s1 already exists"；登录或生成 500',
    stage: 'database',
    checkFirst: 'DATABASE_URL 是否包含 ?pgbouncer=true',
    doNot: '不要切换到 Supabase 直连 URL（IPv6 在 FC 内网不可用）',
    steps: [
      'Vercel 环境变量：DATABASE_URL 末尾添加 ?pgbouncer=true',
      'Aliyun FC 同步更新 DATABASE_URL',
      '重新部署后验证登录和生成功能',
    ],
  },
  {
    code: 'DB_SCHEMA_MISSING / AUTH_DB_UNAVAILABLE',
    meaning: 'Supabase DB 连接失败或 schema 不完整',
    symptom: '登录失败；生成 API 返回 500；Prisma 报 relation does not exist',
    stage: 'database',
    checkFirst: 'Supabase 控制台 → Database → 连接状态',
    doNot: '不要在 API route 中 catch DB 错误然后静默返回 200',
    steps: [
      '检查 Supabase 控制台 DB 状态（是否有 maintenance）',
      '检查 DATABASE_URL 格式：postgresql://user:pass@host:port/db?pgbouncer=true',
      '若 schema 缺失：运行 pnpm db:push 或检查 Prisma schema 是否已 migrate',
    ],
  },
]

// ─── Network checks ──────────────────────────────────────────────────────────

export const networkChecks: NetworkCheck[] = [
  {
    title: '图片生成 POST',
    filter: 'api/generate/image',
    method: 'POST',
    expectation: '只在用户点击"生成"后出现，不能在页面加载时自动触发',
    tokenDrain: true,
  },
  {
    title: '视频生成 POST',
    filter: 'api/generate/video',
    method: 'POST',
    expectation: '只在用户点击"生成"后出现，不能在页面加载时自动触发',
    tokenDrain: true,
  },
  {
    title: '图片状态轮询',
    filter: 'api/generate/image/status',
    method: 'GET',
    expectation: '每 5s 一次，最多 12 次（60s 后停止）',
    tokenDrain: false,
  },
  {
    title: '视频状态轮询',
    filter: 'api/generate/video/status',
    method: 'GET',
    expectation: '每 5s 一次，最多 24 次（120s 后停止）',
    tokenDrain: false,
  },
  {
    title: 'Canvas 保存',
    filter: 'api/projects',
    method: 'PUT',
    expectation: '只在生成成功后或用户操作后触发，不能在只读页面触发',
    tokenDrain: false,
  },
  {
    title: '认证检查',
    filter: 'api/auth/me',
    method: 'GET',
    expectation: '定期检查 session，不消耗生成额度',
    tokenDrain: false,
  },
]

// ─── Guardrail rules ─────────────────────────────────────────────────────────

export const guardrailRules: GuardrailRule[] = [
  {
    id: 'frozen-generate-routes',
    label: '生成 API 路由已冻结',
    description: 'apps/web/src/app/api/generate/* 不得修改，除非明确排查生成链路 bug',
    severity: 'critical',
  },
  {
    id: 'frozen-canvas',
    label: '画布核心组件已冻结',
    description: 'apps/web/src/components/create/VisualCanvasWorkspace.tsx 和 CanvasNodeCard.tsx 只在明确画布 bug 时才可修改',
    severity: 'critical',
  },
  {
    id: 'frozen-cn-executor',
    label: 'cn-executor 已冻结',
    description: 'apps/cn-executor/* 修改需同时完成构建、打包、上传 FC、/health 验证 4 步，缺一不可',
    severity: 'critical',
  },
  {
    id: 'no-auto-post',
    label: '只读页面不得触发 POST',
    description: '任何新增的只读页面（/help、/dashboard、/projects 等）不得在加载或渲染时触发 POST /api/generate/*',
    severity: 'critical',
  },
  {
    id: 'no-clear-nodes',
    label: '错误路径不得清空 nodes/edges',
    description: 'setNodes([]) 和 setEdges([]) 不得出现在 canvas save/load/API 失败路径中',
    severity: 'critical',
  },
  {
    id: 'payload-minimal',
    label: '生成 payload 最小化',
    description: '图片/视频 POST payload 只含 prompt, providerId, aspectRatio, projectId, workflowId, nodeId。禁止加入 styleBible/skills/inputAssets/system',
    severity: 'critical',
  },
  {
    id: 'polling-ceiling',
    label: '轮询必须有上限',
    description: '图片 maxPolls=12（60s），视频 maxPolls=24（120s）。不得修改为更大值或无限轮询',
    severity: 'high',
  },
  {
    id: 'additive-only',
    label: '新增功能只做 additive change',
    description: '新增页面/组件不得修改已稳定的业务逻辑，不得重构，不得删除已有功能',
    severity: 'high',
  },
  {
    id: 'no-secret-exposure',
    label: '不暴露 secret/env value',
    description: '任何页面不得渲染 API key、数据库 URL、OSS 密钥等 secret 的实际值',
    severity: 'high',
  },
  {
    id: 'deploy-7-steps',
    label: '部署必须完成 7 步',
    description: 'type-check → git status → git add → git commit → git log → git push → 等待 Vercel Production Ready',
    severity: 'medium',
  },
]
