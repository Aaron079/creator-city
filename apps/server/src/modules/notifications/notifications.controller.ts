import { Controller, Get, Patch, Param, Query, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { NotificationsService } from './notifications.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my notifications' })
  getNotifications(
    @Request() req: { user: { id: string } },
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.notificationsService.getForUser(req.user.id, {
      unreadOnly: unreadOnly === 'true',
      limit,
      offset,
    })
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  getUnreadCount(@Request() req: { user: { id: string } }) {
    return this.notificationsService.countUnread(req.user.id)
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.notificationsService.markRead(req.user.id, id)
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@Request() req: { user: { id: string } }) {
    return this.notificationsService.markAllRead(req.user.id)
  }
}
