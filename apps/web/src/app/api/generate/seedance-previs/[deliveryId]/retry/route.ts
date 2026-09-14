import { generationAccessResponse } from '@/lib/generation/access'
import { createSeedancePrevisRetryPostHandler } from './handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const handlePost = createSeedancePrevisRetryPostHandler()
export async function POST(...args: Parameters<typeof handlePost>) {
  const accessError = await generationAccessResponse()
  if (accessError) return accessError
  return handlePost(...args)
}
