import { Controller, Get, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { CanvasService } from './canvas.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Canvas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('canvas')
export class CanvasController {
  constructor(private readonly canvasService: CanvasService) {}

  @Get(':projectId')
  @ApiOperation({ summary: 'Get canvas state for a project' })
  getCanvas(@Request() req: { user: { id: string } }, @Param('projectId') projectId: string) {
    return this.canvasService.getCanvas(projectId, req.user.id)
  }

  @Patch(':projectId')
  @ApiOperation({ summary: 'Apply a patch to the project canvas' })
  updateCanvas(
    @Request() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Body() patch: Record<string, unknown>,
  ) {
    return this.canvasService.updateCanvas(projectId, req.user.id, patch)
  }

  @Delete(':projectId')
  @ApiOperation({ summary: 'Clear the canvas (owner only)' })
  clearCanvas(@Request() req: { user: { id: string } }, @Param('projectId') projectId: string) {
    return this.canvasService.clearCanvas(projectId, req.user.id)
  }
}
