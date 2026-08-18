import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { AuthenticatedUser, CurrentUser } from 'src/auth';
import { ActivityListQueryDto, ActivityListResponseDto } from 'src/dtos/activity.dto';
import {
  CommentCreateDto,
  CommentDto,
  CommentListDto,
  CommentUpdateDto,
  LikeStateDto,
  LikerListDto,
  NotificationListDto,
  NotificationsReadDto,
  PeopleListDto,
  PersonDto,
  RequestDirectionDto,
  RequestListDto,
} from 'src/dtos/social.dto';
import { ActivityService } from 'src/services/activity.service';
import { SocialService } from 'src/services/social.service';

@Controller()
export class SocialController {
  constructor(
    private readonly service: SocialService,
    private readonly activityService: ActivityService,
  ) {}

  @Get('people')
  @ZodResponse({ status: 200, type: PeopleListDto, description: 'People available to follow' })
  people(@CurrentUser() user: AuthenticatedUser, @Query('query') query?: string) {
    return this.service.people(user.id, query);
  }

  @Get('people/:id')
  @ZodResponse({ status: 200, type: PersonDto, description: 'Public person profile' })
  person(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.person(user.id, id);
  }

  @Get('people/:id/activities')
  @ZodResponse({ status: 200, type: ActivityListResponseDto, description: 'Visible activities for a person' })
  activities(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Query() query: ActivityListQueryDto) {
    return this.activityService.profileActivities(user.id, id, query);
  }

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

  @Get('follow-requests')
  @ZodResponse({ status: 200, type: RequestListDto, description: 'Follow requests' })
  requests(@CurrentUser() user: AuthenticatedUser, @Query() query: RequestDirectionDto) {
    return this.service.requests(user.id, query.direction);
  }

  @Post('follow-requests/:id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.acceptRequest(user.id, id);
  }

  @Delete('follow-requests/:id')
  ignore(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.ignoreRequest(user.id, id);
  }

  @Get('feed')
  @ZodResponse({ status: 200, type: ActivityListResponseDto, description: 'Home feed' })
  feed(@CurrentUser() user: AuthenticatedUser, @Query() query: ActivityListQueryDto) {
    return this.activityService.feed(user.id, query);
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

  @Get('activities/:id/likes')
  @ZodResponse({ status: 200, type: LikerListDto, description: 'People who liked an activity' })
  likers(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.likers(id, user.id);
  }

  @Get('notifications')
  @ZodResponse({ status: 200, type: NotificationListDto, description: 'Latest notifications' })
  notifications(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.service.notifications(user.id, limit ? Number(limit) : undefined);
  }

  @Patch('notifications/read')
  @ZodResponse({ status: 200, type: NotificationsReadDto, description: 'Mark notifications as read' })
  markNotificationsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.service.markNotificationsRead(user.id);
  }

  @Get('activities/:id/comments')
  @ZodResponse({ status: 200, type: CommentListDto, description: 'Activity comments' })
  comments(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.comments(id, user.id, cursor, limit ? Number(limit) : undefined);
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
