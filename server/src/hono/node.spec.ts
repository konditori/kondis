import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_PREFIX, createHonoApp } from 'src/hono/app';
import { mountHonoApp } from 'src/hono/node';

const findNoUser = (_id: string) => Promise.resolve(undefined);

@Controller()
class FallbackController {
  @Get('fallback')
  fallback() {
    return { source: 'nest' };
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
    mountHonoApp(nestApp, createHonoApp({ server: { ping }, users: { findById: vi.fn(findNoUser) } }));
    nestApp.setGlobalPrefix(API_PREFIX.slice(1));
    await nestApp.listen(0, '127.0.0.1');
    const baseUrl = await nestApp.getUrl();

    const pingResponse = await fetch(`${baseUrl}${API_PREFIX}/ping`);
    expect(await pingResponse.json()).toEqual({ status: 'hono' });
    expect(ping).toHaveBeenCalledOnce();

    const fallbackResponse = await fetch(`${baseUrl}${API_PREFIX}/fallback`);
    expect(await fallbackResponse.json()).toEqual({ source: 'nest' });
  });
});
