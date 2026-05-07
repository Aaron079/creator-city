import { NextResponse } from 'next/server'

export function jsonOk<T extends Record<string, unknown>>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, ...data }, init)
}

export function jsonError(errorCode: string, message: string, status = 500, details?: unknown) {
  return NextResponse.json({
    success: false,
    errorCode,
    message,
    ...(details !== undefined ? { details } : {}),
  }, { status })
}

export function safeErrorMessage(error: unknown, fallback = '请求失败。') {
  return error instanceof Error ? error.message : typeof error === 'string' && error ? error : fallback
}
