import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';

import { AuthenticatedUser, CurrentUser, Public } from 'src/auth';
import {
  ActivityDetailDto,
  ActivityDto,
  ActivityIdParamDto,
  ActivityListQueryDto,
  ActivityListResponseDto,
  ActivityTagListResponseDto,
  ActivityTypeListResponseDto,
  ActivityUpdateDto,
  BestEffortListParamDto,
  BestEffortListResponseDto,
  MatchedRouteListResponseDto,
} from 'src/dtos/activity.dto';
import { ActivityService } from 'src/services/activity.service';
import { ACTIVITY_TAGS, ACTIVITY_TYPES } from 'src/types';

@ApiTags('activities')
@Controller('activities')
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  @ApiOperation({ summary: 'List recent activities' })
  @ZodResponse({ status: 200, description: 'Recent activities', type: ActivityListResponseDto })
  @Get()
  async listRecent(
    @Query() query: ActivityListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActivityListResponseDto> {
    return this.service.listRecent(query, user.id);
  }

  @ApiOperation({ summary: 'List activity types and their behavior' })
  @ZodResponse({ status: 200, description: 'Activity type settings', type: ActivityTypeListResponseDto })
  @Get('types')
  @Public()
  listTypes(): ActivityTypeListResponseDto {
    return [...ACTIVITY_TYPES];
  }

  @ApiOperation({ summary: 'List activity tags and their applicability' })
  @ZodResponse({ status: 200, description: 'Activity tag settings', type: ActivityTagListResponseDto })
  @Get('tags')
  listTags(): ActivityTagListResponseDto {
    return ACTIVITY_TAGS.map((tag) => ({
      ...tag,
      sports: tag.sports === 'all' ? 'all' : [...tag.sports],
    })) as unknown as ActivityTagListResponseDto;
  }

  @ApiOperation({ summary: 'List best efforts over time for a sport' })
  @ZodResponse({ status: 200, description: 'Best effort history', type: BestEffortListResponseDto })
  @Get('best-efforts/:sport/:type')
  async listBestEfforts(
    @Param() params: BestEffortListParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BestEffortListResponseDto> {
    return this.service.listBestEfforts(params.sport, params.type, user.id);
  }

  @ApiOperation({ summary: 'Get one activity and its route' })
  @ZodResponse({ status: 200, description: 'Activity details', type: ActivityDetailDto })
  @Get(':id')
  async getById(
    @Param() { id }: ActivityIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActivityDetailDto> {
    const activity = await this.service.getById(id, user.id);
    if (!activity) {
      throw new NotFoundException(`Activity ${id} does not exist`);
    }

    return activity;
  }

  @ApiOperation({ summary: 'Download the original activity file' })
  @ApiProduces('application/octet-stream', 'application/gpx+xml', 'application/vnd.garmin.tcx+xml')
  @Get(':id/original')
  async downloadOriginal(
    @Param() { id }: ActivityIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.service.getOriginalFile(id, user.id);
    if (!file) {
      throw new NotFoundException('Original activity file does not exist');
    }
    response.type(file.originalName);
    response.setHeader('Content-Length', String(file.byteSize));
    response.setHeader('Content-Disposition', 'attachment');
    response.setHeader('Cache-Control', 'private, no-cache');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.attachment(file.originalName);
    response.sendFile(file.absolutePath);
  }

  @ApiOperation({ summary: 'List activities matched to the same GPS route' })
  @ZodResponse({ status: 200, description: 'Matched route activities', type: MatchedRouteListResponseDto })
  @Get(':id/matched-routes')
  async listMatchedRoutes(
    @Param() { id }: ActivityIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MatchedRouteListResponseDto> {
    const matches = await this.service.listMatchedRoutes(id, user.id);
    if (!matches) {
      throw new NotFoundException(`Activity ${id} does not exist`);
    }

    return matches;
  }

  @ApiOperation({ summary: 'Update one activity' })
  @ZodResponse({ status: 200, description: 'Updated activity', type: ActivityDto })
  @Put(':id')
  async updateById(
    @Param() { id }: ActivityIdParamDto,
    @Body() payload: ActivityUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActivityDto> {
    const updated = await this.service.updateById(id, user.id, {
      ...payload,
      startedAt: payload.startedAt ? new Date(payload.startedAt) : undefined,
      excludeFromRankings: payload.excludeFromRankings,
      tags: payload.tags,
    });
    if (!updated) {
      throw new NotFoundException(`Activity ${id} does not exist`);
    }

    return updated;
  }

  @ApiOperation({ summary: 'Delete one activity' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteById(@Param() { id }: ActivityIdParamDto, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    const deleted = await this.service.deleteById(id, user.id);
    if (!deleted) {
      throw new NotFoundException(`Activity ${id} does not exist`);
    }
  }
}
