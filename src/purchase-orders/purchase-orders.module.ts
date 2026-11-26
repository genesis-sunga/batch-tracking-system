import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../common/audit/audit.module';
import { PurchaseOrder } from './purchase-order.entity';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';

@Module({
  imports: [TypeOrmModule.forFeature([PurchaseOrder]), AuditModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [TypeOrmModule],
})
export class PurchaseOrdersModule {}
