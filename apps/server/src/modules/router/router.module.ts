import { Module } from '@nestjs/common'
import { RouterController } from './router.controller'
import { RouterService } from './router.service'

/**
 * Router module = Discovery / routing metadata endpoint.
 * Returns the full list of available API routes and their descriptions.
 * Useful for auto-generating client SDKs or internal tooling.
 */
@Module({
  controllers: [RouterController],
  providers: [RouterService],
})
export class RouterModule {}
