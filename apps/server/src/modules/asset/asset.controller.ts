import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { AssetService } from './asset.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get('my')
  @ApiOperation({ summary: 'Get my assets' })
  getMyAssets(@Request() req: { user: { id: string } }) {
    return this.assetService.findByUser(req.user.id)
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get assets for a project' })
  getProjectAssets(
    @Param('projectId') projectId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.assetService.findByProject(projectId, req.user.id)
  }

  @Post()
  @ApiOperation({ summary: 'Register a new asset (after upload)' })
  create(
    @Request() req: { user: { id: string } },
    @Body() body: {
      name: string
      type: string
      url: string
      mimeType: string
      sizeBytes: number
      projectId?: string
      tags?: string[]
      metadata?: Record<string, unknown>
    },
  ) {
    return this.assetService.create(req.user.id, body)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an asset' })
  delete(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.assetService.delete(req.user.id, id)
  }
}
