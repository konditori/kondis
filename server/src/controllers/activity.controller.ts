import { Body, Controller, Delete, HttpCode, HttpStatus, NotFoundException, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { AuthenticatedUser, CurrentUser } from 'src/auth';
import { ActivityDto, ActivityIdParamDto, ActivityUpdateDto } from 'src/dtos/activity.dto';
import { ActivityService } from 'src/services/activity.service';

@ApiTags('activities')
@Controller('activities')
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

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
