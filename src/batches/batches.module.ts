import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../common/audit/audit.module';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';
import { Location } from '../locations/location.entity';
import { PurchaseOrder } from '../purchase-orders/purchase-order.entity';
import { QualityTest } from '../quality/quality-test.entity';
import { Batch } from './batch.entity';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { InventoryMovement } from './inventory-movement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Batch, InventoryMovement, PurchaseOrder, Location, QualityTest]),
    AuditModule,
    IdempotencyModule,
  ],
  controllers: [BatchesController],
  providers: [BatchesService],
  exports: [TypeOrmModule],
})
export class BatchesModule {}
