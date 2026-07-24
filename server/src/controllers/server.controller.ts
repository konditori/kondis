import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { PingResponseDto } from 'src/dtos/ping.dto';
import { ServerService } from 'src/services/server.service';

@ApiTags('server')
@Controller()
export class ServerController {
  constructor(private readonly service: ServerService) {}

  @ApiOperation({ summary: 'Health check endpoint' })
  @ZodResponse({
    status: 200,
    description: 'The API is reachable',
    type: PingResponseDto,
  })
  @Get('ping')
  ping(): PingResponseDto {
    return this.service.ping();
  }
}
