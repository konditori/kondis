import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { controllers } from 'src/controllers';
import { ImportService } from 'src/services/import.service';
import { ServerService } from 'src/services/server.service';

@Module({
  controllers,
  providers: [
    ImportService,
    ServerService,
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
