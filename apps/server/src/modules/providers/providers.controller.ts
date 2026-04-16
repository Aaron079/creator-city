import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { ProvidersService } from './providers.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] List all AI provider configs' })
  findAll(@Request() req: { user: { id: string } }) {
    return this.providersService.findAll(req.user.id)
  }

  @Get('default')
  @ApiOperation({ summary: 'Get active default provider config (no API key)' })
  getDefault() {
    return this.providersService.findDefault()
  }

  @Post()
  @ApiOperation({ summary: '[Admin] Register an AI provider config' })
  create(
    @Request() req: { user: { id: string } },
    @Body() body: { name: string; provider: string; apiKey: string; model?: string; isDefault?: boolean },
  ) {
    return this.providersService.create(req.user.id, body)
  }

  @Get(':id/stats')
  @ApiOperation({ summary: '[Admin] Get usage stats for a provider config' })
  getStats(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.providersService.getUsageStats(id)
  }
}
