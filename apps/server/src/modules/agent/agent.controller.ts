import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { AgentService } from './agent.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get()
  @ApiOperation({ summary: 'Get my AI agents' })
  getMyAgents(@Request() req: { user: { id: string } }) {
    return this.agentService.getMyAgents(req.user.id)
  }

  @Post('hire')
  @ApiOperation({ summary: 'Hire a new AI agent' })
  hire(
    @Request() req: { user: { id: string } },
    @Body() body: { name: string; role: string; baseId: string },
  ) {
    return this.agentService.hireAgent(req.user.id, body)
  }

  @Get(':agentId')
  @ApiOperation({ summary: 'Get agent details' })
  getAgent(@Request() req: { user: { id: string } }, @Param('agentId') agentId: string) {
    return this.agentService.getAgent(req.user.id, agentId)
  }

  @Post(':agentId/tasks')
  @ApiOperation({ summary: 'Assign a task to an agent' })
  assignTask(
    @Request() req: { user: { id: string } },
    @Param('agentId') agentId: string,
    @Body() body: { projectId: string; taskType: string; input: Record<string, unknown> },
  ) {
    return this.agentService.assignTask(req.user.id, agentId, body.projectId, body.taskType, body.input)
  }

  @Get(':agentId/tasks')
  @ApiOperation({ summary: 'Get agent task history' })
  getTaskHistory(@Request() req: { user: { id: string } }, @Param('agentId') agentId: string) {
    return this.agentService.getTaskHistory(req.user.id, agentId)
  }
}
