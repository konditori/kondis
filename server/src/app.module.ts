import { ConsoleLogger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AuthGuard } from 'src/auth';

import { controllers } from 'src/controllers';
import { databaseProviders } from 'src/db';
import { LagomTakeoutParser } from 'src/imports/lagom-takeout.parser';
import { repositories } from 'src/repositories';
import { JobRepository } from 'src/repositories/job.repository';
import { services } from 'src/services';
import { JobService } from 'src/services/job.service';
import { ImportProgressStore } from 'src/state/import-progress.store';

@Module({
  controllers,
  providers: [
    ConsoleLogger,
    ...databaseProviders,
    ...repositories,
    LagomTakeoutParser,
    ImportProgressStore,
    ...services,
    AuthGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
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

  async onApplicationBootstrap(): Promise<void> {
    this.jobRepository.setup(services);
    await this.jobService.init();
  }
}
