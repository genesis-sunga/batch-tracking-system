import 'reflect-metadata';
import { Repository } from 'typeorm';
import { Batch } from '../batches/batch.entity';
import { InventoryMovement } from '../batches/inventory-movement.entity';
import { PurchaseOrder } from '../purchase-orders/purchase-order.entity';
import { QualityTest } from '../quality/quality-test.entity';
import { ReportJob } from './report-job.entity';
import { ReportQueryDto } from './report-query.dto';
import { ReportsService } from './reports.service';

describe('ReportsService filters', () => {
  it('includes the full UTC day when a date-only upper bound is supplied', async () => {
    const builder = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const service = new ReportsService(
      { createQueryBuilder: jest.fn().mockReturnValue(builder) } as unknown as Repository<Batch>,
      {} as Repository<InventoryMovement>,
      {} as Repository<QualityTest>,
      {} as Repository<PurchaseOrder>,
      {} as Repository<ReportJob>,
    );
    const query = Object.assign(new ReportQueryDto(), {
      from: '2026-01-01',
      to: '2026-01-31',
    });

    await service.stock(query);

    const range = builder.andWhere.mock.calls.find(([condition]) =>
      String(condition).includes('BETWEEN'),
    );
    expect(range?.[1].to.toISOString()).toBe('2026-01-31T23:59:59.999Z');
  });

  it('filters stock exports by product SKU', async () => {
    const builder = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const service = new ReportsService(
      { createQueryBuilder: jest.fn().mockReturnValue(builder) } as unknown as Repository<Batch>,
      {} as Repository<InventoryMovement>,
      {} as Repository<QualityTest>,
      {} as Repository<PurchaseOrder>,
      {} as Repository<ReportJob>,
    );

    await service.stock(Object.assign(new ReportQueryDto(), { sku: 'SKU-123' }));

    expect(builder.andWhere).toHaveBeenCalledWith('product.sku = :sku', { sku: 'SKU-123' });
  });
});
