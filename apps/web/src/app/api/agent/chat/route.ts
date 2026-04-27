import { NextResponse } from 'next/server'
import { buildLocalAgentReply } from '@/lib/agent/local-assistant'
import type { AgentChatRequest, AgentChatResponse } from '@/lib/agent/types'

const SYSTEM_PROMPT = `你是 Creator City Agent。
你只能基于 Creator City 平台当前上下文提供帮助。
不要声称可以真实生成视频/图片，除非 provider 状态是 available。
对未配置 API 的工具要明确说 not-configured / mock / bridge-only。
用户问怎么操作时，给具体入口和按钮说明。
用户在 /create 时，解释节点、对话框、连线、客户交付入口。
外部 guest / review 页面只解释当前页面和客户交付流程，不暴露内部项目数据。
回答要简洁、直接、可执行。`

function json(data: AgentChatResponse, status = 200) {
  return NextResponse.json(data, { status })
}

function isOpenAIConfigured() {
  const provider = process.env.AI_AGENT_PROVIDER || 'openai'
  return provider === 'openai' && Boolean(process.env.OPENAI_API_KEY)
}

export async function POST(request: Request) {
  let body: AgentChatRequest

  try {
    body = await request.json()
  } catch {
    return json({
      mode: 'error',
      configured: false,
      message: 'Agent 请求格式无效。',
      error: 'invalid-json',
    }, 400)
  }

  const configured = isOpenAIConfigured()

  if (!configured) {
    return json({
      mode: 'local',
      configured: false,
      message: buildLocalAgentReply({
        messages: body.messages ?? [],
        context: body.context,
        apiConfigured: false,
      }),
    })
  }

  try {
    const model = process.env.AI_AGENT_MODEL || 'gpt-4o-mini'
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'system',
            content: `当前页面上下文：${JSON.stringify(body.context)}`,
          },
          ...(body.messages ?? [])
            .filter((message) => message.role === 'user' || message.role === 'assistant')
            .slice(-12)
            .map((message) => ({
              role: message.role,
              content: message.content,
            })),
        ],
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('[Creator City Agent] OpenAI request failed', response.status, detail)
      return json({
        mode: 'error',
        configured: true,
        message: '模型调用失败，请检查 API 配置。',
        error: `openai-${response.status}`,
      }, 502)
    }

    const data = await response.json()
    const message = data?.choices?.[0]?.message?.content?.trim()

    if (!message) {
      return json({
        mode: 'error',
        configured: true,
        message: '模型调用失败，请检查 API 配置。',
        error: 'empty-model-response',
      }, 502)
    }

    return json({
      mode: 'real',
      configured: true,
      message,
    })
  } catch (error) {
    console.error('[Creator City Agent] model call crashed', error)
    return json({
      mode: 'error',
      configured: true,
      message: '模型调用失败，请检查 API 配置。',
      error: 'model-call-failed',
    }, 502)
  }
}
