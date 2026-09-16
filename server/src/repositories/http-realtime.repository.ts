import { type ArgsOf, type EmitEvent, RealtimeRepository } from 'src/contracts/realtime.repository';
import { serializeRealtimeEvent } from 'src/realtime/protocol';

/**
Authenticated Cloud Node -> Worker bridge for the shared wire protocol.
*/
export class HttpRealtimeRepository extends RealtimeRepository {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly request: typeof fetch = fetch,
  ) {
    super();
  }

  async emit<T extends EmitEvent>(event: T, ...args: ArgsOf<T>): Promise<void> {
    try {
      const response = await this.request(this.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(serializeRealtimeEvent(event, ...args)),
      });
      if (!response.ok) {
        throw new Error(`Realtime publisher returned ${response.status}`);
      }
    } catch (error) {
      console.warn(`Realtime event ${event} was not delivered`, error);
    }
  }
}
