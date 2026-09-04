import { PingResponseDto } from 'src/dtos/ping.dto';

export class ServerService {
  ping(): PingResponseDto {
    return { status: 'pong' };
  }
}
