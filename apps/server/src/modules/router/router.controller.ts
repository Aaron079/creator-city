import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { RouterService, RouteEntry } from './router.service'

@ApiTags('Router')
@Controller('router')
export class RouterController {
  constructor(private readonly routerService: RouterService) {}

  @Get('manifest')
  @ApiOperation({ summary: 'Get full API route manifest' })
  getManifest(): { version: string; routes: RouteEntry[]; generatedAt: string } {
    return {
      version: '1.0',
      routes: this.routerService.getRouteManifest(),
      generatedAt: new Date().toISOString(),
    }
  }
}
