import { type ArgsOf, type EmitEvent, RealtimeRepository } from 'src/contracts/realtime.repository';
import { serializeRealtimeEvent } from 'src/realtime/protocol';

export const REALTIME_DURABLE_OBJECT_NAME = 'global';

export type DurableObjectNamespaceBinding = {
  idFromName: (name: string) => unknown;
  get: (id: unknown) => { fetch: (request: Request | string, init?: RequestInit) => Promise<Response> };
};

export class DurableObjectRealtimeRepository extends RealtimeRepository {
  constructor(private readonly namespace: DurableObjectNamespaceBinding) {
    super();
  }

  async emit<T extends EmitEvent>(event: T, ...args: ArgsOf<T>): Promise<void> {
    try {
      const response = await this.namespace
        .get(this.namespace.idFromName(REALTIME_DURABLE_OBJECT_NAME))
        .fetch('https://realtime.internal/publish', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(serializeRealtimeEvent(event, ...args)),
        });
      if (!response.ok) {
        throw new Error(`Realtime Durable Object returned ${response.status}`);
      }
    } catch (error) {
      console.warn(`Realtime event ${event} was not delivered`, error);
    }
  }
}
