import {
  Controller, Get, Post, Body, Query, UseGuards, Request, ParseIntPipe, DefaultValuePipe,
  ForbiddenException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { CreditsService } from './credits.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { InternalGuard } from './guards/internal.guard'
import { FreezeCreditsDto } from './dto/freeze.dto'
import { SettleCreditsDto, RefundCreditsDto, UpdateJobExternalIdDto } from './dto/settle.dto'
import { CreateOrderDto, FulfillOrderDto } from './dto/order.dto'

interface JwtUser { id: string; role: string }

@ApiTags('Credits')
@Controller('credits')
export class CreditsController {
  constructor(private readonly svc: CreditsService) {}

  // ─── Public endpoints ─────────────────────────────────────────────────────

  @Get('packages')
  @ApiOperation({ summary: 'List available credit packages' })
  listPackages() {
    return this.svc.listPackages()
  }

  // ─── User JWT endpoints ───────────────────────────────────────────────────

  @Get('wallet')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get my credit wallet balance' })
  getWallet(@Request() req: { user: JwtUser }) {
    return this.svc.getWallet(req.user.id)
  }

  @Get('ledger')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get my credit ledger' })
  getLedger(
    @Request() req: { user: JwtUser },
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.svc.getLedger(req.user.id, limit, offset)
  }

  @Post('estimate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Estimate generation cost in credits' })
  estimate(
    @Body() body: { providerId: string; nodeType: string },
  ) {
    return { credits: this.svc.estimateCost(body.providerId, body.nodeType) }
  }

  @Post('freeze')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Freeze credits before generation' })
  freeze(@Request() req: { user: JwtUser }, @Body() dto: FreezeCreditsDto) {
    return this.svc.freeze(req.user.id, dto)
  }

  @Post('orders')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a payment order (Stripe checkout)' })
  createOrder(@Request() req: { user: JwtUser }, @Body() dto: CreateOrderDto) {
    return this.svc.createOrder(req.user.id, dto)
  }

  // ─── Admin endpoints ──────────────────────────────────────────────────────

  @Get('admin/overview')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Admin: cost/revenue overview' })
  adminOverview(@Request() req: { user: JwtUser }) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException()
    return this.svc.getAdminOverview()
  }

  @Get('admin/orders')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Admin: list payment orders' })
  adminOrders(@Request() req: { user: JwtUser }) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException()
    return this.svc.listAdminOrders()
  }

  @Get('admin/wallets')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Admin: list credit wallets' })
  adminWallets(@Request() req: { user: JwtUser }) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException()
    return this.svc.listAdminWallets()
  }

  // ─── Internal endpoints (Next.js server → NestJS) ─────────────────────────

  @Post('internal/settle')
  @UseGuards(InternalGuard)
  @ApiOperation({ summary: 'Internal: settle credits after generation success' })
  settle(@Body() dto: SettleCreditsDto) {
    return this.svc.settle(dto.jobId, dto.actualCost)
  }

  @Post('internal/refund')
  @UseGuards(InternalGuard)
  @ApiOperation({ summary: 'Internal: refund credits after generation failure' })
  refund(@Body() dto: RefundCreditsDto) {
    return this.svc.refund(dto.jobId, dto.reason)
  }

  @Post('internal/update-job')
  @UseGuards(InternalGuard)
  @ApiOperation({ summary: 'Internal: update generation job external ID' })
  updateJob(@Body() dto: UpdateJobExternalIdDto) {
    return this.svc.updateJobExternalId(dto.jobId, dto.externalJobId)
  }

  @Post('internal/fulfill-order')
  @UseGuards(InternalGuard)
  @ApiOperation({ summary: 'Internal: fulfill payment order (webhook callback)' })
  fulfillOrder(@Body() dto: FulfillOrderDto) {
    return this.svc.fulfillOrder(dto)
  }
}
