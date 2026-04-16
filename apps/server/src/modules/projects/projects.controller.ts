import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { ProjectsService } from './projects.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new project' })
  create(
    @Request() req: { user: { id: string } },
    @Body() body: { title: string; description: string; type: string; visibility?: string; tags?: string[]; genre?: string[] },
  ) {
    return this.projectsService.create(req.user.id, body)
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my projects (owned + member)' })
  getMyProjects(@Request() req: { user: { id: string } }) {
    return this.projectsService.findMyProjects(req.user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  getProject(
    @Param('id') id: string,
    @Request() req?: { user?: { id: string } },
  ) {
    return this.projectsService.findById(id, req?.user?.id)
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update project' })
  update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { title?: string; description?: string; status?: string; visibility?: string },
  ) {
    return this.projectsService.update(req.user.id, id, body)
  }

  // ─── Members ──────────────────────────────────────────────────────────────

  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List project members' })
  getMembers(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.projectsService.getMembers(id, req.user.id)
  }

  @Post(':id/invite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite a user to the project' })
  invite(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { userId: string; message?: string },
  ) {
    return this.projectsService.invite(req.user.id, id, body.userId, body.message)
  }

  @Post('invitations/:invId/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a project invitation' })
  acceptInvitation(@Request() req: { user: { id: string } }, @Param('invId') invId: string) {
    return this.projectsService.acceptInvitation(req.user.id, invId)
  }

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  @Post(':id/tasks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a task inside a project' })
  createTask(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { title: string; description?: string; priority?: string; dueDate?: string },
  ) {
    return this.projectsService.createTask(req.user.id, id, body)
  }

  @Patch('tasks/:taskId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a task status / assignment' })
  updateTask(
    @Request() req: { user: { id: string } },
    @Param('taskId') taskId: string,
    @Body() body: { title?: string; status?: string; priority?: string; assignedTo?: string },
  ) {
    return this.projectsService.updateTask(req.user.id, taskId, body)
  }

  // ─── Reviews ──────────────────────────────────────────────────────────────

  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a project review (rating 1-5)' })
  review(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { rating: number; comment?: string },
  ) {
    return this.projectsService.addReview(req.user.id, id, body.rating, body.comment)
  }
}
