import { Controller, Get, Patch, Post, Param, Body, UseGuards, Request, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { CityService } from './city.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('City')
@Controller('city')
export class CityController {
  constructor(private readonly cityService: CityService) {}

  @Get('map')
  @ApiOperation({ summary: 'Get city map with all bases in a zone' })
  getCityMap(@Query('zone') zone?: string) {
    return this.cityService.getCityMap(zone)
  }

  @Get('my-base')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my city base' })
  getMyBase(@Request() req: { user: { id: string } }) {
    return this.cityService.getMyBase(req.user.id)
  }

  @Get('base/:id')
  @ApiOperation({ summary: 'Get a city base by ID' })
  getBase(@Param('id') id: string) {
    return this.cityService.getBaseById(id)
  }

  @Patch('my-base')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my city base info' })
  updateBase(
    @Request() req: { user: { id: string } },
    @Body() body: { name?: string; description?: string },
  ) {
    return this.cityService.updateBase(req.user.id, body)
  }

  @Post('my-base/buildings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a new building to my base' })
  addBuilding(
    @Request() req: { user: { id: string } },
    @Body() body: { type: string; name: string; positionX: number; positionY: number },
  ) {
    return this.cityService.addBuilding(req.user.id, body)
  }

  @Post('my-base/buildings/:buildingId/upgrade')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upgrade a building' })
  upgradeBuilding(
    @Request() req: { user: { id: string } },
    @Param('buildingId') buildingId: string,
  ) {
    return this.cityService.upgradeBuilding(req.user.id, buildingId)
  }
}
