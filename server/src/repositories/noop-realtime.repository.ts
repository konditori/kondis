import { RealtimeRepository } from 'src/contracts/realtime.repository';

export class NoopRealtimeRepository extends RealtimeRepository {
  emit(): Promise<void> {
    return Promise.resolve();
  }
}
