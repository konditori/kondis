import { Controller, Get, Module, Put } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_PREFIX, createHonoApp } from 'src/hono/app';
import { mountHonoApp } from 'src/hono/node';
import { honoAuthHeaders, newHonoDependencies, newHonoUsers, TEST_HONO_USER } from 'test/hono';

const findNoUser = (_id: string) => Promise.resolve(undefined);
const listNoUsers = () => Promise.resolve([]);

@Controller()
class FallbackController {
  @Get('fallback')
  fallback() {
    return { source: 'nest' };
  }

  @Put('activities/:id')
  updateActivity() {
    return { source: 'nest-write' };
  }
}

@Module({ controllers: [FallbackController] })
class TestModule {}

describe(mountHonoApp.name, () => {
  const applications: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(applications.splice(0).map((app) => app.close()));
  });

  it('serves selected Hono routes and passes unmatched routes to Nest', async () => {
    const ping = vi.fn(() => ({ status: 'hono' }));
    const nestApp = await NestFactory.create(TestModule, { logger: false });
    applications.push(nestApp);
    mountHonoApp(
      nestApp,
      createHonoApp(
        newHonoDependencies({
          server: { ping },
          users: { all: listNoUsers, findById: vi.fn(findNoUser) },
        }),
      ),
    );
    nestApp.setGlobalPrefix(API_PREFIX.slice(1));
    await nestApp.listen(0, '127.0.0.1');
    const baseUrl = await nestApp.getUrl();

    const pingResponse = await fetch(`${baseUrl}${API_PREFIX}/ping`);
    expect(await pingResponse.json()).toEqual({ status: 'hono' });
    expect(ping).toHaveBeenCalledOnce();

    const fallbackResponse = await fetch(`${baseUrl}${API_PREFIX}/fallback`);
    expect(await fallbackResponse.json()).toEqual({ source: 'nest' });

    const trailingSlashResponse = await fetch(`${baseUrl}${API_PREFIX}/ping/`);
    expect(await trailingSlashResponse.json()).toEqual({ status: 'hono' });

    const headResponse = await fetch(`${baseUrl}${API_PREFIX}/ping`, { method: 'HEAD' });
    expect(headResponse.status).toBe(200);
  });

  it('matches parameterized Hono routes before falling back to Nest', async () => {
    const activityId = '00000000-0000-4000-8000-000000000002';
    const getById = vi.fn(() => Promise.resolve(void 0));
    const nestApp = await NestFactory.create(TestModule, { logger: false });
    applications.push(nestApp);
    mountHonoApp(
      nestApp,
      createHonoApp(
        newHonoDependencies({
          activities: { getById },
          users: newHonoUsers(),
        }),
      ),
    );
    nestApp.setGlobalPrefix(API_PREFIX.slice(1));
    await nestApp.listen(0, '127.0.0.1');
    const baseUrl = await nestApp.getUrl();

    const response = await fetch(`${baseUrl}${API_PREFIX}/activities/${activityId}`, {
      headers: honoAuthHeaders(),
    });

    expect(response.status).toBe(404);
    expect(getById).toHaveBeenCalledWith(activityId, TEST_HONO_USER.id);

    const writeResponse = await fetch(`${baseUrl}${API_PREFIX}/activities/${activityId}`, { method: 'PUT' });
    expect(await writeResponse.json()).toEqual({ source: 'nest-write' });
  });
});
