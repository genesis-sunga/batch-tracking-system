import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { BatchesModule } from './batches/batches.module';
import { AuditModule } from './common/audit/audit.module';
import { LocationsModule } from './locations/locations.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { QualityModule } from './quality/quality.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
      }),
    }),
    AuditModule,
    AuthModule,
    LocationsModule,
    PurchaseOrdersModule,
    BatchesModule,
    QualityModule,
    UsersModule,
  ],
})
export class AppModule {}
