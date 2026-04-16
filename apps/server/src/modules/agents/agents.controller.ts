import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { AgentsService } from './agents.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get('me')
  @ApiOperation({ summary: 'List all my agents' })
  getMyAgents(@Request() req: { user: { id: string } }) {
    return this.agentsService.getMyAgents(req.user.id)
  }

  @Post('hire')
  @ApiOperation({ summary: 'Hire a new AI agent' })
  hire(
    @Request() req: { user: { id: string } },
    @Body() body: { name: string; role: string; buildingId?: string },
  ) {
    return this.agentsService.hireAgent(req.user.id, body)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agent details + growth history' })
  getAgent(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.agentsService.getAgentById(id, req.user.id)
  }

  @Patch(':id/profile')
  @ApiOperation({ summary: 'Update agent bio / avatar / specialties' })
  updateProfile(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { bio?: string; avatarUrl?: string; specialties?: string[] },
  ) {
    return this.agentsService.updateProfile(req.user.id, id, body)
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Manually set agent status (IDLE / RESTING / UPGRADING)' })
  updateStatus(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.agentsService.updateStatus(req.user.id, id, body.status)
  }

  @Get(':id/growth')
  @ApiOperation({ summary: 'Get 90-day growth log for an agent' })
  getGrowth(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.agentsService.getGrowthHistory(req.user.id, id)
  }
}
