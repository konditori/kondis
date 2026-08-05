import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  ActivityDetailDto,
  ActivityDto,
  ActivityIdParamDto,
  ActivityListResponseDto,
  ActivityUpdateDto,
} from 'src/dtos/activity.dto';
import { ActivityService } from 'src/services/activity.service';

@ApiTags('activities')
@Controller('activities')
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  @ApiOperation({ summary: 'List recent activities' })
  @ZodResponse({ status: 200, description: 'Recent activities', type: ActivityListResponseDto })
  @Get()
  async listRecent(): Promise<ActivityListResponseDto> {
    const activities = await this.service.listRecent();
    return { activities };
  }

  @ApiOperation({ summary: 'Get one activity and its route' })
  @ZodResponse({ status: 200, description: 'Activity details', type: ActivityDetailDto })
  @Get(':id')
  async getById(@Param() { id }: ActivityIdParamDto): Promise<ActivityDetailDto> {
    const activity = await this.service.getById(id);
    if (!activity) {
      throw new NotFoundException(`Activity ${id} does not exist`);
    }

    return activity;
  }

  @ApiOperation({ summary: 'Update one activity' })
  @ZodResponse({ status: 200, description: 'Updated activity', type: ActivityDto })
  @Put(':id')
  async updateById(@Param() { id }: ActivityIdParamDto, @Body() payload: ActivityUpdateDto): Promise<ActivityDto> {
    const updated = await this.service.updateById(id, {
      ...payload,
      startedAt: payload.startedAt ? new Date(payload.startedAt) : undefined,
    });
    if (!updated) {
      throw new NotFoundException(`Activity ${id} does not exist`);
    }

    return updated;
  }

  @ApiOperation({ summary: 'Delete one activity' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteById(@Param() { id }: ActivityIdParamDto): Promise<void> {
    const deleted = await this.service.deleteById(id);
    if (!deleted) {
      throw new NotFoundException(`Activity ${id} does not exist`);
    }
  }
}
