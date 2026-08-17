import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { AuthenticatedUser, CurrentUser, Public } from 'src/auth';
import {
  LiveWorkoutAckDto,
  LiveWorkoutCreateDto,
  LiveWorkoutDto,
  LiveWorkoutListDto,
  LiveWorkoutPointsDto,
  LiveWorkoutShareDto,
  LiveWorkoutStateDto,
} from 'src/dtos/live-workout.dto';
import { LiveWorkoutService } from 'src/services/live-workout.service';

@ApiTags('live workouts')
@Controller('live-workouts')
export class LiveWorkoutController {
  constructor(private readonly service: LiveWorkoutService) {}

  @Get()
  @ZodResponse({ status: 200, description: 'Active workouts for the signed-in user', type: LiveWorkoutListDto })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<LiveWorkoutListDto> {
    return this.service.list(user.id);
  }

  @Post()
  @ZodResponse({ status: 201, description: 'Created or resumed live workout', type: LiveWorkoutDto })
  async create(@Body() input: LiveWorkoutCreateDto, @CurrentUser() user: AuthenticatedUser): Promise<LiveWorkoutDto> {
    return this.service.create(user.id, input);
  }

  @Get('shared/:token')
  @Public()
  @ZodResponse({ status: 200, description: 'Live workout visible through a share link', type: LiveWorkoutDto })
  async getShared(@Param('token') token: string): Promise<LiveWorkoutDto> {
    return this.service.getShared(token);
  }

  @Get(':id')
  @ZodResponse({ status: 200, description: 'Live workout for its owner', type: LiveWorkoutDto })
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<LiveWorkoutDto> {
    return this.service.get(id, user.id);
  }

  @Post(':id/points')
  @ZodResponse({ status: 201, description: 'Accepted a batch of live GPS points', type: LiveWorkoutAckDto })
  async points(
    @Param('id') id: string,
    @Body() input: LiveWorkoutPointsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LiveWorkoutAckDto> {
    return this.service.appendPoints(id, user.id, input);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, description: 'Updated live workout state', type: LiveWorkoutDto })
  async update(
    @Param('id') id: string,
    @Body() input: LiveWorkoutStateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LiveWorkoutDto> {
    return this.service.updateState(id, user.id, input);
  }

  @Post(':id/share')
  @ZodResponse({
    status: 201,
    description: 'Created a revocable public live tracking token',
    type: LiveWorkoutShareDto,
  })
  async share(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<LiveWorkoutShareDto> {
    return this.service.createShare(id, user.id);
  }

  @Delete(':id/share')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeShare(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.revokeShare(id, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async discard(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.discard(id, user.id);
  }
}
