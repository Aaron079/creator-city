import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { ProjectService } from './project.service'
import { CreateProjectDto } from './dto/create-project.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Projects')
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get('discover')
  @ApiOperation({ summary: 'Discover public published projects' })
  discover(
    @Query('type') type?: string,
    @Query('genre') genre?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.projectService.findPublic({ type, genre, page, limit })
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my projects (owned + collaborating)' })
  getMyProjects(@Request() req: { user: { id: string } }) {
    return this.projectService.findAll(req.user.id)
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new project' })
  create(@Request() req: { user: { id: string } }, @Body() dto: CreateProjectDto) {
    return this.projectService.create(req.user.id, dto)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  findOne(@Param('id') id: string, @Request() req?: { user?: { id: string } }) {
    return this.projectService.findById(id, req?.user?.id)
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update project' })
  update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: Partial<CreateProjectDto> & { status?: string },
  ) {
    return this.projectService.update(req.user.id, id, body)
  }

  @Post(':id/collaborators')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite a collaborator to the project' })
  inviteCollaborator(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { userId: string; role: string },
  ) {
    return this.projectService.inviteCollaborator(req.user.id, id, body.userId, body.role)
  }
}
