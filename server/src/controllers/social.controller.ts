import { Body, Controller, Delete, Param, Patch, Post, Put } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { AuthenticatedUser, CurrentUser } from 'src/auth';
import {
  CommentCreateDto,
  CommentDto,
  CommentUpdateDto,
  LikeStateDto,
  NotificationsReadDto,
} from 'src/dtos/social.dto';
import { SocialService } from 'src/services/social.service';

@Controller()
export class SocialController {
  constructor(private readonly service: SocialService) {}

  @Post('people/:id/follow-request')
  send(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.sendRequest(user.id, id);
  }

  @Delete('people/:id/follow-request')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.cancelRequest(user.id, id);
  }

  @Delete('people/:id/follow')
  unfollow(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.unfollow(user.id, id);
  }

  @Put('people/:id/block')
  block(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.block(user.id, id);
  }

  @Delete('people/:id/block')
  unblock(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.unblock(user.id, id);
  }

  @Post('follow-requests/:id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.acceptRequest(user.id, id);
  }

  @Delete('follow-requests/:id')
  ignore(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.ignoreRequest(user.id, id);
  }

  @Put('activities/:id/like')
  @ZodResponse({ status: 200, type: LikeStateDto, description: 'Like an activity' })
  like(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.like(id, user.id, true);
  }

  @Delete('activities/:id/like')
  @ZodResponse({ status: 200, type: LikeStateDto, description: 'Unlike an activity' })
  unlike(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.like(id, user.id, false);
  }

  @Patch('notifications/read')
  @ZodResponse({ status: 200, type: NotificationsReadDto, description: 'Mark notifications as read' })
  markNotificationsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.service.markNotificationsRead(user.id);
  }

  @Post('activities/:id/comments')
  @ZodResponse({ status: 201, type: CommentDto, description: 'Add an activity comment' })
  comment(@Param('id') id: string, @Body() input: CommentCreateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addComment(id, user.id, input.body);
  }

  @Patch('activities/:activityId/comments/:commentId')
  @ZodResponse({ status: 200, type: CommentDto, description: 'Edit an activity comment' })
  updateComment(
    @Param('activityId') activityId: string,
    @Param('commentId') commentId: string,
    @Body() input: CommentUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateComment(activityId, commentId, user.id, input.body);
  }

  @Delete('activities/:activityId/comments/:commentId')
  deleteComment(
    @Param('activityId') activityId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deleteComment(activityId, commentId, user.id);
  }
}
