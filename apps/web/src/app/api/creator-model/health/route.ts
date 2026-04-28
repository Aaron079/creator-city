import { NextResponse } from 'next/server'

export async function GET() {
  const mode = process.env.CREATOR_MODEL_MODE || 'local'
  const endpointConfigured = Boolean(process.env.CREATOR_MODEL_ENDPOINT)
  const keyConfigured = Boolean(process.env.CREATOR_MODEL_API_KEY)
  const model = process.env.CREATOR_MODEL_NAME || 'creator-city-local'

  return NextResponse.json({
    status: 'ok',
    provider: 'creator-city',
    mode,
    endpointConfigured,
    keyConfigured,
    model,
  })
}
