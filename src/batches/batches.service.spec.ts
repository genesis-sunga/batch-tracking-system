import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { MovementType, UserRole } from '../common/enums';
import { AuditService } from '../common/audit/audit.service';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Location } from '../locations/location.entity';
import { PurchaseOrder } from '../purchase-orders/purchase-order.entity';
import { QualityTest } from '../quality/quality-test.entity';
import { Batch } from './batch.entity';
import { BatchesService } from './batches.service';
import { InventoryMovement } from './inventory-movement.entity';

describe('BatchesService transactional movements', () => {
  const actor: AuthenticatedUser = { id: 8, email: 'operator@example.com', role: UserRole.WAREHOUSE_OPERATOR };
  let batch: Batch;
  let batchRepository: { findOne: jest.Mock; save: jest.Mock };
  let movementRepository: { insert: jest.Mock };
  let manager: { getRepository: jest.Mock };
  let service: BatchesService;

  beforeEach(() => {
    batch = {
      id: 4,
      batchNumber: 'B-004',
      quantity: 10,
      status: 'released',
      currentLocationId: 2,
    } as Batch;
    batchRepository = {
      findOne: jest.fn().mockResolvedValue(batch),
      save: jest.fn(async (value: Batch) => value),
    };
    movementRepository = { insert: jest.fn().mockResolvedValue(undefined) };
    manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === Batch ? batchRepository : movementRepository,
      ),
    };
    const idempotency = {
      execute: jest.fn(
        async (
          _scope: string,
          _key: string | undefined,
          _request: unknown,
          operation: (transactionManager: EntityManager) => Promise<Batch>,
        ) => operation(manager as unknown as EntityManager),
      ),
    };
    service = new BatchesService(
      { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      { enqueue: jest.fn().mockResolvedValue(undefined) } as unknown as IntegrationsService,
      { notifyRoles: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService,
      idempotency as unknown as IdempotencyService,
      batchRepository as unknown as Repository<Batch>,
      movementRepository as unknown as Repository<InventoryMovement>,
      {} as Repository<PurchaseOrder>,
      {} as Repository<Location>,
      {} as Repository<QualityTest>,
    );
  });

  it('records a valid consumption and updates the batch quantity in the transaction', async () => {
    const updated = await service.move(
      batch.id,
      { movementType: MovementType.CONSUMPTION, quantity: 4 },
      actor,
      'movement-1',
    );

    expect(updated.quantity).toBe(6);
    expect(movementRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: batch.id, quantity: 4, movementType: MovementType.CONSUMPTION }),
    );
    expect(batchRepository.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 6 }));
  });

  it('rejects consumption beyond available stock without writing a movement', async () => {
    await expect(
      service.move(
        batch.id,
        { movementType: MovementType.CONSUMPTION, quantity: 11 },
        actor,
        'movement-2',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(movementRepository.insert).not.toHaveBeenCalled();
    expect(batchRepository.save).not.toHaveBeenCalled();
  });
});
