import { Controller, Get, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { LandsService } from './lands.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Lands')
@Controller('lands')
export class LandsController {
  constructor(private readonly landsService: LandsService) {}

  @Get('map')
  @ApiOperation({ summary: 'Get city map — all public lands in a zone' })
  getCityMap(@Query('zone') zone?: string, @Query('limit') limit?: number) {
    return this.landsService.getCityMap(zone, limit)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my land with buildings and agents' })
  getMyLand(@Request() req: { user: { id: string } }) {
    return this.landsService.getMyLand(req.user.id)
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my land name / description' })
  updateLand(
    @Request() req: { user: { id: string } },
    @Body() body: { name?: string; description?: string },
  ) {
    return this.landsService.updateLand(req.user.id, body)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a land by ID' })
  getLand(@Param('id') id: string) {
    return this.landsService.getLandById(id)
  }
}
