import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { PingResponseDto } from './dtos/ping.dto';

@ApiTags('app')
@Controller()
export class AppController {
  @ApiOperation({ summary: 'Health check endpoint' })
  @ZodResponse({
    status: 200,
    description: 'The API is reachable',
    type: PingResponseDto,
  })
  @Get('ping')
  ping(): PingResponseDto {
    return { status: 'pong' };
  }
}