import { Controller, Get, Post, Param, Body, UseGuards, Request, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { ChatService } from './chat.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('channels')
  @ApiOperation({ summary: 'Get public chat channels' })
  getChannels() {
    return this.chatService.getPublicChannels()
  }

  @Get('channels/:channelId/messages')
  @ApiOperation({ summary: 'Get messages in a channel' })
  getMessages(
    @Param('channelId') channelId: string,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ) {
    return this.chatService.getMessages(channelId, { limit, before })
  }

  @Post('channels/:channelId/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a message to a channel' })
  sendMessage(
    @Request() req: { user: { id: string } },
    @Param('channelId') channelId: string,
    @Body() body: { content: string },
  ) {
    return this.chatService.sendMessage(channelId, req.user.id, body.content)
  }
}
