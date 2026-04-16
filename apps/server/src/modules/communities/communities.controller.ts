import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { CommunitiesService } from './communities.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Communities')
@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Get()
  @ApiOperation({ summary: 'List public communities' })
  findAll(@Query('type') type?: string, @Query('limit') limit?: number) {
    return this.communitiesService.findAll({ type, limit })
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a community' })
  create(
    @Request() req: { user: { id: string } },
    @Body() body: { name: string; description?: string; type?: string; tags?: string[] },
  ) {
    return this.communitiesService.create(req.user.id, body)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get community details' })
  findOne(@Param('id') id: string) {
    return this.communitiesService.findById(id)
  }

  @Get(':id/posts')
  @ApiOperation({ summary: 'Get posts in a community' })
  getPosts(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.communitiesService.getPosts(id, { limit, offset })
  }

  @Post(':id/posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a post in a community' })
  createPost(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { title: string; content: string; type?: string; tags?: string[] },
  ) {
    return this.communitiesService.createPost(req.user.id, id, body)
  }

  @Get('posts/:postId/comments')
  @ApiOperation({ summary: 'Get comments on a post' })
  getComments(@Param('postId') postId: string, @Query('limit') limit?: number) {
    return this.communitiesService.getPostComments(postId, { limit })
  }

  @Post('posts/:postId/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Comment on a post' })
  addComment(
    @Request() req: { user: { id: string } },
    @Param('postId') postId: string,
    @Body() body: { content: string; parentId?: string },
  ) {
    return this.communitiesService.addComment(req.user.id, postId, body.content, body.parentId)
  }

  @Delete('posts/:postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a post' })
  deletePost(@Request() req: { user: { id: string } }, @Param('postId') postId: string) {
    return this.communitiesService.deletePost(req.user.id, postId)
  }
}
