import { Injectable } from '@nestjs/common';

import { PingResponseDto } from 'src/dtos/ping.dto';

@Injectable()
export class ServerService {
  ping(): PingResponseDto {
    return { status: 'pong' };
  }
}
