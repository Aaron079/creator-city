import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { BuildingsService } from './buildings.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Buildings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get all buildings on my land' })
  getMyBuildings(@Request() req: { user: { id: string } }) {
    return this.buildingsService.getMyBuildings(req.user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a building by ID' })
  getBuilding(@Param('id') id: string) {
    return this.buildingsService.getBuildingById(id)
  }

  @Post()
  @ApiOperation({ summary: 'Construct a new building on my land' })
  addBuilding(
    @Request() req: { user: { id: string } },
    @Body() body: { type: string; name: string; positionX?: number; positionY?: number },
  ) {
    return this.buildingsService.addBuilding(req.user.id, body)
  }

  @Post(':id/upgrade')
  @ApiOperation({ summary: 'Upgrade a building to the next level' })
  upgrade(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.buildingsService.upgrade(req.user.id, id)
  }
}
