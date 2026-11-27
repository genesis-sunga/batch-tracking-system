import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../common/audit/audit.module';
import { Batch } from '../batches/batch.entity';
import { Product } from '../products/product.entity';
import { Supplier } from '../suppliers/supplier.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseOrder, Batch, Product, Supplier]),
    AuditModule,
    IntegrationsModule,
  ],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [TypeOrmModule],
})
export class PurchaseOrdersModule {}
