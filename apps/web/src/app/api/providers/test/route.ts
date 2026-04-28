import { NextResponse } from 'next/server'
import { getGatewayProvider } from '@/lib/providers/catalog'
import { getAdapter } from '@/lib/providers/registry'
import { checkEnvKeys } from '@/lib/providers/env'
import { resolveProviderStatus } from '@/lib/providers/status'

export const dynamic = 'force-dynamic'

interface TestRequest {
  providerId?: string
}

export async function POST(request: Request) {
  let body: TestRequest
  try {
    body = await request.json() as TestRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', errorCode: 'INVALID_INPUT' }, { status: 400 })
  }

  const { providerId } = body
  if (!providerId) {
    return NextResponse.json({ error: 'providerId is required', errorCode: 'INVALID_INPUT' }, { status: 400 })
  }

  const gatewayEntry = getGatewayProvider(providerId)
  if (!gatewayEntry) {
    const resolved = resolveProviderStatus(providerId)
    return NextResponse.json({
      ok: false,
      providerId,
      status: resolved.status,
      message: `No gateway adapter for "${providerId}". Status: ${resolved.status}.`,
    })
  }

  const adapter = getAdapter(gatewayEntry.adapterId)
  if (!adapter) {
    return NextResponse.json({
      ok: false,
      providerId,
      status: 'coming-soon',
      message: `Adapter "${gatewayEntry.adapterId}" not yet implemented.`,
    })
  }

  const envCheck = checkEnvKeys(gatewayEntry.envKeys)
  if (!envCheck.configured) {
    return NextResponse.json({
      ok: false,
      providerId,
      status: 'not-configured',
      message: `Missing environment variables: ${envCheck.missing.join(', ')}. ${gatewayEntry.setupHint}`,
      missingEnvKeys: envCheck.missing,
    })
  }

  try {
    const result = await adapter.testConnection()
    return NextResponse.json({
      ok: result.ok,
      providerId,
      status: result.ok ? 'available' : 'error',
      message: result.message,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Test failed'
    console.error(`[providers/test] ${providerId}`, error)
    return NextResponse.json({
      ok: false,
      providerId,
      status: 'error',
      message,
    })
  }
}
