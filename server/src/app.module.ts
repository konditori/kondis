import { ConsoleLogger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { ConfigService } from 'src/config/config.service';
import { controllers } from 'src/controllers';
import { databaseProviders } from 'src/db';
import { repositories } from 'src/repositories';
import { JobRepository } from 'src/repositories/job.repository';
import { services } from 'src/services';
import { JobService } from 'src/services/job.service';

@Module({
  controllers,
  providers: [
    ConfigService,
    ConsoleLogger,
    ...databaseProviders,
    ...repositories,
    ...services,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },
  ],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly jobService: JobService,
  ) {}

  /**
   * The one place that knows both the queue and the services that feed it.
   *
   * Handler discovery happens here rather than inside `JobRepository` because the repository
   * layer sits below `services/` and must not import it. Passing the array down keeps the
   * dependency pointing the right way, which is what allows a producer and its consumer to
   * live in two services that know nothing about each other.
   *
   * Discovery runs in every process, including api-only ones: a missing or duplicated handler
   * is a programming error and should fail the same way everywhere. Only consumption is
   * conditional, and `JobService.init` decides that.
   */
  async onApplicationBootstrap(): Promise<void> {
    this.jobRepository.setup(services);
    await this.jobService.init();
  }
}
