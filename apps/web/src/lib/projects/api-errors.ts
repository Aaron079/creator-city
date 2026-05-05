import { NextResponse } from 'next/server'

export type ProjectApiErrorCode =
  | 'UNAUTHORIZED'
  | 'PROJECT_NOT_FOUND'
  | 'FORBIDDEN'
  | 'DB_SCHEMA_MISSING'
  | 'VALIDATION_FAILED'
  | 'PROJECT_ACCESS_FAILED'
  | 'CREATE_PROJECT_FAILED'

export const PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE = 'Project / Canvas 数据表未同步，请在 Supabase 执行 project-canvas-setup.sql'

export function projectJsonError(code: ProjectApiErrorCode, message: string, status: number) {
  return NextResponse.json({ errorCode: code, message }, { status })
}

export function isProjectCanvasSchemaMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybeError = error as { code?: string; message?: string; meta?: unknown }
  if (maybeError.code === 'P2021' || maybeError.code === 'P2022') return true

  const text = [
    maybeError.message,
    typeof maybeError.meta === 'string' ? maybeError.meta : JSON.stringify(maybeError.meta ?? ''),
  ].join(' ')

  return /(CanvasWorkflow|CanvasNode|CanvasEdge|ProjectMember|ProjectRole|Project|Asset|lastOpenedAt|workflowId|dataUrl|metadataJson)/.test(text)
    && /(does not exist|not exist|relation|table|column|missing)/i.test(text)
}
