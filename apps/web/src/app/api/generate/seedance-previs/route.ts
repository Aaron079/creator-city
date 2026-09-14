import { generationAccessResponse } from '@/lib/generation/access'
import {
  createSeedancePrevisGetHandler,
  createSeedancePrevisPostHandler,
} from './handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const GET = createSeedancePrevisGetHandler()
const handlePost = createSeedancePrevisPostHandler()
export async function POST(request: Request) {
  const accessError = await generationAccessResponse()
  if (accessError) return accessError
  return handlePost(request)
}
