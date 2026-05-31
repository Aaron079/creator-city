# OpenAI Text Agent

## 用途

`POST /api/agents/text` 是 Creator City 的全球文本 Agent 入口。

当前 v1 用于：
- **Prompt 优化**：把用户的创意 prompt 优化为适合图像/视频生成的专业描述
- **分镜拆解**：把一段创意拆成带景别、运动、时长的镜头序列
- **素材分析**：根据素材描述分析用途、风险、可接续生成方向
- **通用助手**：回答 Creator City 相关的创作问题

## 为什么先接 Text Agent

1. **纯文本，零媒体文件**：不依赖 OSS、不依赖 cn-executor
2. **无 polling**：同步返回，不需要 job queue
3. **低成本**：gpt-4.1-mini 约 $0.0004/千 tokens，测试代价极低
4. **验证全局链路**：确认 Vercel → OpenAI 的 global server-side call 正常工作
5. **为后续打基础**：Phase 2 OpenAI Images 复用同一 API key

## API Route

### POST /api/agents/text

**Request body:**
```json
{
  "prompt": "一个东方幻想战士从云层中降落，电影感",
  "mode": "prompt_optimize",
  "systemPrompt": "(optional) 覆盖内置 system prompt",
  "projectContext": "(optional) 项目背景描述，最多 2000 字符",
  "nodeContext": "(optional) 节点上下文，最多 2000 字符"
}
```

**mode 选项:**
| mode | 说明 |
|------|------|
| `prompt_optimize` | 影视 Prompt 优化 Agent |
| `storyboard` | 分镜生成 Agent |
| `asset_analysis` | 素材分析 Agent |
| `generic` | 通用创作助手 |
| (省略) | 默认 generic |

**Request body (Phase 3+, optional billing context):**
```json
{
  "prompt": "一个东方幻想战士从云层中降落，电影感",
  "mode": "prompt_optimize",
  "systemPrompt": "(optional) 覆盖内置 system prompt",
  "projectContext": "(optional) 项目背景描述，最多 2000 字符",
  "nodeContext": "(optional) 节点上下文，最多 2000 字符",
  "projectId": "(optional) 当前项目 ID，用于 billing 追踪",
  "nodeId": "(optional) 当前节点 ID，用于 billing 追踪"
}
```

**成功响应:**
```json
{
  "success": true,
  "providerId": "openai-text",
  "model": "gpt-4.1-mini",
  "text": "优化后的 Prompt 或分析结果...",
  "billing": { "chargedCredits": 5, "billingStatus": "SETTLED" }
}
```

**失败响应:**
```json
{
  "success": false,
  "errorCode": "OPENAI_API_KEY_MISSING",
  "message": "OPENAI_API_KEY is not configured."
}
```

**错误码:**
| errorCode | HTTP | 原因 |
|-----------|------|------|
| `PROMPT_REQUIRED` | 400 | prompt 为空 |
| `PROMPT_TOO_LONG` | 400 | prompt > 8000 字符 |
| `UNAUTHENTICATED` | 401 | 未登录 |
| `INSUFFICIENT_CREDITS` | 402 | credits 不足（已扣除预估额度） |
| `OPENAI_API_KEY_MISSING` | 503 | OPENAI_API_KEY 未配置 |
| `OPENAI_AUTH_FAILED` | 503 | API key 无效 |
| `OPENAI_RATE_LIMITED` | 429 | OpenAI 限速 |
| `OPENAI_REQUEST_TIMEOUT` | 504 | 超过 45s 超时 |
| `EMPTY_RESPONSE` | 502 | Provider 返回空文本 |

## 技术实现

- **Endpoint**: `POST https://api.openai.com/v1/chat/completions`
- **默认 model**: `gpt-4.1-mini`（可通过 `OPENAI_TEXT_MODEL` env 覆盖）
- **来源确认**: OpenAI OpenAPI spec v2.3.0，gpt-4.1-mini 出现在 model enum 列表
- **Timeout**: 45 秒
- **max_tokens**: 2048

## 环境变量

| 变量 | 必须 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | 是 | OpenAI API key，server-side only |
| `OPENAI_TEXT_MODEL` | 否 | 覆盖默认 model，默认 `gpt-4.1-mini` |

## 验证方式（无 UI）

```bash
# 无 OPENAI_API_KEY 时（应返回 503 + OPENAI_API_KEY_MISSING）
curl -s -X POST http://localhost:3000/api/agents/text \
  -H "Content-Type: application/json" \
  -d '{"mode": "prompt_optimize", "prompt": "一个东方幻想战士从云层中降落，电影感"}'

# 有 OPENAI_API_KEY 时（应返回 success: true + text）
OPENAI_API_KEY=sk-... curl -s -X POST http://localhost:3000/api/agents/text \
  -H "Content-Type: application/json" \
  -d '{"mode": "prompt_optimize", "prompt": "一个东方幻想战士从云层中降落，电影感"}'
```

## 当前限制（Phase 3）

- **不写 canvas**：不生成/修改 canvas 节点
- **不生成节点**：只返回纯文本
- **不处理图片/视频**：纯文本 in / 纯文本 out
- **Auth 已启用**：通过 `setupBilling()` → `getCurrentUser()` 强制登录验证
- **Credits 已计费**：text 节点固定 5 credits，不足返回 402
- **ProviderCostLedger**：暂缓，Phase 4 统一接入

## 后续接入计划

| Phase | 内容 |
|-------|------|
| Phase 1 (当前) | OpenAI Text Agent — 内部 API 验证 |
| Phase 2 | Prompt 面板"一键优化"按钮 |
| Phase 2 | Storyboard Agent（分镜 Panel） |
| Phase 2 | Asset Analysis Agent（节点 Inspector） |
| Phase 3 | OpenAI Images（图片生成节点） |
| Phase 5 | Gemini Nano Banana（高价值图片编辑） |

## 文件

| 文件 | 说明 |
|------|------|
| `apps/web/src/lib/global-providers/types.ts` | GlobalTextAgentInput/Output 类型定义 |
| `apps/web/src/lib/global-providers/openaiText.ts` | generateOpenAITextAgent + buildSystemPrompt |
| `apps/web/src/lib/global-providers/openaiText.test.ts` | buildSystemPrompt 单元测试 |
| `apps/web/src/app/api/agents/text/route.ts` | POST /api/agents/text |
