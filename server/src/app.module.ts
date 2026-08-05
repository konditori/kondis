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

  async onApplicationBootstrap(): Promise<void> {
    this.jobRepository.setup(services);
    await this.jobService.init();
  }
}
