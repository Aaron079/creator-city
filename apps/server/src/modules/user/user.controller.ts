import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { UserService } from './user.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get top users by reputation' })
  getLeaderboard() {
    return this.userService.getLeaderboard()
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get public user profile by username' })
  getProfile(@Param('username') username: string) {
    return this.userService.findByUsername(username)
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(
    @Request() req: { user: { id: string } },
    @Body() body: { displayName?: string; bio?: string; skills?: string[]; avatarUrl?: string },
  ) {
    return this.userService.updateProfile(req.user.id, body)
  }
}
