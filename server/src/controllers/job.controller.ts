import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  AllJobStatusResponseDto,
  JobCreateDto,
  QueueCommandDto,
  QueueNameParamDto,
  QueueStatusReportDto,
} from 'src/dtos/job.dto';
import { JobService } from 'src/services/job.service';
import { AdminOnly } from 'src/auth';

@ApiTags('jobs')
@Controller('jobs')
@AdminOnly()
export class JobController {
  constructor(private readonly service: JobService) {}

  @ApiOperation({ summary: 'Queue depths and worker status' })
  @ZodResponse({ status: 200, description: 'Current counts and status for every queue', type: AllJobStatusResponseDto })
  @Get()
  getAllJobStatus(): Promise<AllJobStatusResponseDto> {
    return this.service.getAllJobStatus();
  }

  @ApiOperation({
    summary: 'Run a job by hand',
    description:
      'Most work is queued automatically. This triggers the handful of jobs that are useful to run on demand, such as re-parsing uploads that previously failed.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post()
  createJob(@Body() { name }: JobCreateDto): Promise<void> {
    return this.service.create(name);
  }

  @ApiOperation({
    summary: 'Control a queue',
    description:
      'Pause or resume consumption, discard queued jobs, or clear the failed and dead-lettered backlog. Pausing affects only the worker serving the request.',
  })
  @ZodResponse({ status: 200, description: 'Counts and status after the command', type: QueueStatusReportDto })
  @Put(':name')
  runQueueCommand(
    @Param() { name }: QueueNameParamDto,
    @Body() { command }: QueueCommandDto,
  ): Promise<QueueStatusReportDto> {
    return this.service.handleCommand(name, command);
  }
}
