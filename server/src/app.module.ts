import { ConsoleLogger, Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { ConfigService } from 'src/config/config.service';
import { controllers } from 'src/controllers';
import { databaseProviders } from 'src/db';
import { jobProviders } from 'src/jobs';
import { repositories } from 'src/repositories';
import { services } from 'src/services';

@Module({
  controllers,
  providers: [
    ConfigService,
    ConsoleLogger,
    ...databaseProviders,
    ...repositories,
    ...services,
    ...jobProviders,
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
export class AppModule {}
