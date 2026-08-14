import { describe, expect, it } from 'vitest';

import { ServerController } from 'src/controllers/server.controller';
import { ServerService } from 'src/services/server.service';

describe(ServerController.name, () => {
  describe('GET /ping', () => {
    const controller = new ServerController(new ServerService());

    it('should return pong', () => {
      expect(controller.ping()).toEqual({ status: 'pong' });
    });
  });
});
