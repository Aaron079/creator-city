import { Controller, Get, Patch, Post, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('leaderboard')
  @ApiOperation({ summary: 'Top creators by reputation' })
  leaderboard(@Query('limit') limit?: number) {
    return this.usersService.getLeaderboard(limit)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get full profile for current user' })
  getMe(@Request() req: { user: { id: string } }) {
    return this.usersService.getMe(req.user.id)
  }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my profile' })
  updateProfile(
    @Request() req: { user: { id: string } },
    @Body() body: {
      displayName?: string
      bio?: string
      avatarUrl?: string
      bannerUrl?: string
      skills?: string[]
      portfolioUrl?: string
      twitterUrl?: string
      instagramUrl?: string
      websiteUrl?: string
      timezone?: string
    },
  ) {
    return this.usersService.updateProfile(req.user.id, body)
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get public profile by username' })
  getProfile(@Param('username') username: string) {
    return this.usersService.findByUsername(username)
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a user' })
  follow(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.usersService.follow(req.user.id, id)
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollow(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.usersService.unfollow(req.user.id, id)
  }
}
