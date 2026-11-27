import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { BatchStatus, QualityOutcome, UserRole } from '../common/enums';
import { AuditService } from '../common/audit/audit.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Batch } from '../batches/batch.entity';
import { QualityService } from './quality.service';
import { QualityTest } from './quality-test.entity';

describe('QualityService alerts and status transitions', () => {
  it('quarantines failed tests and queues the QA/warehouse alert in the same transaction', async () => {
    const batch = {
      id: 12,
      batchNumber: 'LOT-12',
      status: BatchStatus.AWAITING_QA,
      requiredTests: 1,
      quantity: 20,
    } as Batch;
    const savedBatchRepository = {
      findOne: jest.fn().mockResolvedValue(batch),
      save: jest.fn(async (value: Batch) => value),
    };
    const test = {
      id: 31,
      batchId: batch.id,
      testType: 'microbiology',
      outcome: QualityOutcome.FAIL,
      notes: null,
    } as QualityTest;
    const testRepository = {
      create: jest.fn().mockReturnValue(test),
      save: jest.fn().mockResolvedValue(test),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === Batch ? savedBatchRepository : testRepository,
      ),
    };
    const notifications = { notifyRoles: jest.fn().mockResolvedValue(undefined) };
    const dataSource = {
      transaction: jest.fn(async (operation: (value: typeof manager) => Promise<unknown>) =>
        operation(manager),
      ),
    };
    const service = new QualityService(
      dataSource as unknown as DataSource,
      { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      { enqueue: jest.fn().mockResolvedValue(undefined) } as unknown as IntegrationsService,
      notifications as unknown as NotificationsService,
      testRepository as unknown as Repository<QualityTest>,
    );
    const actor: AuthenticatedUser = { id: 3, email: 'qa@example.com', role: UserRole.QA_INSPECTOR };

    const result = await service.record(
      batch.id,
      { testType: 'microbiology', outcome: QualityOutcome.FAIL },
      actor,
    );

    expect(result.batch.status).toBe(BatchStatus.QUARANTINED);
    expect(notifications.notifyRoles).toHaveBeenCalledWith(
      manager,
      [UserRole.ADMIN, UserRole.QA_INSPECTOR, UserRole.WAREHOUSE_OPERATOR],
      'quality_failed',
      expect.objectContaining({ batchNumber: 'LOT-12', outcome: QualityOutcome.FAIL }),
      'quality-test:31',
    );
  });
});
