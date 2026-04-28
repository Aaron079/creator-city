import { NextResponse } from 'next/server'
import { runCreatorModel } from '@/lib/creator-model/runtime'
import type { AgentChatRequest, AgentChatResponse } from '@/lib/agent/types'

function json(data: AgentChatResponse, status = 200) {
  return NextResponse.json(data, { status })
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

  try {
    const result = await runCreatorModel({
      messages: (body.messages ?? []).map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      context: body.context
        ? {
          pathname: body.context.pathname,
          routeName: body.context.routeName,
          pageSummary: body.context.pageSummary,
          projectId: body.context.projectId,
          userRole: body.context.role,
          toolStatusSummary: body.context.toolAvailabilitySummary,
        }
        : undefined,
    })

    if (result.mode === 'error') {
      return json({
        mode: 'error',
        configured: result.configured,
        message: result.content,
        error: result.error,
      }, 502)
    }

    return json({
      mode: result.mode === 'remote' ? 'real' : 'local',
      configured: result.configured,
      message: result.content,
    })
  } catch (error) {
    console.error('[creator-agent] unhandled error', error)
    return json({
      mode: 'error',
      configured: false,
      message: '模型调用失败，请稍后重试。',
      error: 'internal-error',
    }, 500)
  }
}
