import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { CollaborationService } from './collaboration.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Collaboration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('collaboration')
export class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}

  @Get('invitations/received')
  @ApiOperation({ summary: 'Get pending invitations I received' })
  getMyInvitations(@Request() req: { user: { id: string } }) {
    return this.collaborationService.getMyInvitations(req.user.id)
  }

  @Get('invitations/sent')
  @ApiOperation({ summary: 'Get invitations I sent' })
  getSentInvitations(@Request() req: { user: { id: string } }) {
    return this.collaborationService.getSentInvitations(req.user.id)
  }

  @Post('invitations/:id/decline')
  @ApiOperation({ summary: 'Decline an invitation' })
  decline(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.collaborationService.declineInvitation(req.user.id, id)
  }

  @Get('collaborators')
  @ApiOperation({ summary: 'Get all collaborators I have worked with' })
  getCollaborators(@Request() req: { user: { id: string } }) {
    return this.collaborationService.getCollaborators(req.user.id)
  }
}
