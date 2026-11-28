import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { BatchesModule } from './batches/batches.module';
import { AuditModule } from './common/audit/audit.module';
import { LocationsModule } from './locations/locations.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { QualityModule } from './quality/quality.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { HealthModule } from './health/health.module';
import { validateEnvironment } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const limit = Number(config.get<string>('RATE_LIMIT_LIMIT', '100'));
        const ttlSeconds = Number(config.get<string>('RATE_LIMIT_WINDOW_SECONDS', '60'));
        if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(ttlSeconds) || ttlSeconds < 1) {
          throw new Error('Rate-limit settings must be positive integers');
        }
        return [{ limit, ttl: ttlSeconds * 1_000 }];
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.getOrThrow<string>('DB_USERNAME'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        migrations: [
          __dirname + '/batches/migrations/*{.js,.ts}',
          __dirname + '/integrations/migrations/*{.js,.ts}',
          __dirname + '/notifications/migrations/*{.js,.ts}',
          __dirname + '/reports/migrations/*{.js,.ts}',
        ],
        migrationsRun: config.get<string>('DB_MIGRATIONS_RUN') === 'true',
      }),
    }),
    AuditModule,
    AuthModule,
    LocationsModule,
    PurchaseOrdersModule,
    BatchesModule,
    QualityModule,
    UsersModule,
    ProductsModule,
    SuppliersModule,
    IntegrationsModule,
    NotificationsModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
