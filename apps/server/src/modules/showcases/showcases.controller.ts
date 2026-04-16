import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { ShowcasesService } from './showcases.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Showcases')
@Controller('showcases')
export class ShowcasesController {
  constructor(private readonly showcasesService: ShowcasesService) {}

  @Get()
  @ApiOperation({ summary: 'List showcases (featured first)' })
  findAll(
    @Query('featured') featured?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.showcasesService.findAll({ featured: featured === 'true', limit, offset })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get showcase detail' })
  findOne(@Param('id') id: string) {
    return this.showcasesService.findById(id)
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a showcase for a project' })
  create(
    @Request() req: { user: { id: string } },
    @Body() body: {
      projectId: string
      title: string
      description?: string
      thumbnailUrl?: string
      videoUrl?: string
      tags?: string[]
    },
  ) {
    return this.showcasesService.create(req.user.id, body)
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like a showcase' })
  like(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.showcasesService.like(req.user.id, id)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a showcase' })
  delete(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.showcasesService.delete(req.user.id, id)
  }
}
