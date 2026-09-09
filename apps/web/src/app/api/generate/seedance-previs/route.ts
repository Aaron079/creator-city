import {
  createSeedancePrevisGetHandler,
  createSeedancePrevisPostHandler,
} from './handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const GET = createSeedancePrevisGetHandler()
export const POST = createSeedancePrevisPostHandler()
