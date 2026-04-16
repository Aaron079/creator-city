import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { AppService } from './app.service'

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * GET /api/v1/health
   * Used by load balancers, k8s probes, and local dev to confirm the server is up.
   */
  @Get('health')
  @ApiOperation({ summary: 'Liveness / health check' })
  health() {
    return this.appService.getHealth()
  }

  /**
   * GET /api/v1/health/ready
   * Readiness probe — only 200 when DB is also reachable.
   */
  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness check (DB reachable)' })
  ready() {
    return this.appService.getReadiness()
  }
}
