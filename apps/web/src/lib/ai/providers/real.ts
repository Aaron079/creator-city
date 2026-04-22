import type { GenerateRequest, GenerateResponse } from '../prompts'
import { ROLE_PROMPTS } from '../prompts'

// ─── OpenAI Chat Completions ──────────────────────────────────────────────────

interface OpenAICompletion {
  choices: Array<{ message: { content: string | null } }>
}

async function callOpenAI(system: string, user: string): Promise<string> {
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o'
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = (await res.json()) as OpenAICompletion
  const text = data.choices[0]?.message?.content
  if (!text) throw new Error('OpenAI returned empty content')
  return text
}

// ─── Anthropic Messages API（接口结构保留，暂未启用）─────────────────────────
//
// 启用步骤：
//   1. 设置 ANTHROPIC_API_KEY
//   2. 将下方函数体替换为真实调用（参考注释）
//   3. 在 realGenerate 中调整优先级顺序

interface AnthropicMessage {
  content: Array<{ type: string; text: string }>
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function callClaude(system: string, user: string): Promise<string> {
  // TODO: 取消下方注释以启用真实调用
  //
  // const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7'
  // const res = await fetch('https://api.anthropic.com/v1/messages', {
  //   method: 'POST',
  //   headers: {
  //     'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
  //     'anthropic-version': '2023-06-01',
  //     'content-type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     model,
  //     max_tokens: 1500,
  //     system,
  //     messages: [{ role: 'user', content: user }],
  //   }),
  // })
  // if (!res.ok) {
  //   const body = await res.text()
  //   throw new Error(`Claude ${res.status}: ${body.slice(0, 300)}`)
  // }
  // const data = (await res.json()) as AnthropicMessage
  // const block = data.content.find((b) => b.type === 'text')
  // if (!block) throw new Error('Claude returned no text block')
  // return block.text

  void (null as unknown as AnthropicMessage) // keep type import live
  throw new Error('Anthropic provider not yet enabled. Set OPENAI_API_KEY to use OpenAI instead.')
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function realGenerate({
  idea,
  role,
  style,
  context,
  params,
}: GenerateRequest): Promise<GenerateResponse> {
  const prompt = ROLE_PROMPTS[role]
  const system = prompt.systemPrompt
  const user = prompt.buildUserPrompt(idea, style, context, params)

  // Priority: OpenAI → Anthropic (Anthropic not yet wired)
  if (process.env.OPENAI_API_KEY) {
    const text = await callOpenAI(system, user)
    return { content: text, source: 'real' }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const text = await callClaude(system, user)
    return { content: text, source: 'real' }
  }

  throw new Error(
    '未配置 API Key：请在 .env.local 中设置 OPENAI_API_KEY（或 ANTHROPIC_API_KEY）'
  )
}
