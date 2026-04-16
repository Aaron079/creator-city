import { Controller, Post, Delete, Get, Param, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { AgentRuntimeService } from './agent-runtime.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Agent Runtime')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agent-runtime')
export class AgentRuntimeController {
  constructor(private readonly runtimeService: AgentRuntimeService) {}

  @Post('run')
  @ApiOperation({ summary: 'Assign an agent to run a project task' })
  runTask(
    @Request() req: { user: { id: string } },
    @Body() body: { agentId: string; projectId: string; taskId: string; instructions?: string },
  ) {
    return this.runtimeService.runTask(req.user.id, body)
  }

  @Get('projects/:projectId/active')
  @ApiOperation({ summary: 'Get all in-progress agent tasks for a project' })
  getActiveTasks(@Param('projectId') projectId: string) {
    return this.runtimeService.getActiveTasksForProject(projectId)
  }

  @Delete('tasks/:taskId')
  @ApiOperation({ summary: 'Cancel an in-progress agent task' })
  cancelTask(@Request() req: { user: { id: string } }, @Param('taskId') taskId: string) {
    return this.runtimeService.cancelTask(req.user.id, taskId)
  }
}
