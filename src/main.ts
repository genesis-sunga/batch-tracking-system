import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import type helmetFactory from 'helmet';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { StructuredLogger } from './common/logging/structured-logger';

const helmet = require('helmet') as typeof helmetFactory;

async function bootstrap(): Promise<void> {
  const logger = new StructuredLogger();
  const app = await NestFactory.create(AppModule, { logger });
  app.setGlobalPrefix('api');
  const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
  }
  app.getHttpAdapter().getInstance().set('trust proxy', trustedProxyHops);
  app.use(helmet());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    response.setHeader('X-Request-ID', requestId);
    response.once('finish', () => {
      logger.request({
        level: 'info',
        event: 'http_request',
        requestId,
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
