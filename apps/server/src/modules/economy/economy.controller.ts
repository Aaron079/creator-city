import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { EconomyService } from './economy.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Economy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('economy')
export class EconomyController {
  constructor(private readonly economyService: EconomyService) {}

  @Get('wallet')
  @ApiOperation({ summary: 'Get my wallet balance' })
  getWallet(@Request() req: { user: { id: string } }) {
    return this.economyService.getWallet(req.user.id)
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get my transaction history' })
  getTransactions(
    @Request() req: { user: { id: string } },
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('type') type?: string,
  ) {
    return this.economyService.getTransactions(req.user.id, { limit, offset, type })
  }
}
