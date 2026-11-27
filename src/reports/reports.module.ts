import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Batch } from '../batches/batch.entity';
import { InventoryMovement } from '../batches/inventory-movement.entity';
import { PurchaseOrder } from '../purchase-orders/purchase-order.entity';
import { QualityTest } from '../quality/quality-test.entity';
import { ReportJob } from './report-job.entity';
import { ReportJobsWorker } from './report-jobs.worker';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Batch, InventoryMovement, PurchaseOrder, QualityTest, ReportJob]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportJobsWorker],
})
export class ReportsModule {}
