import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginatedResult, paginated } from '../common/dto/pagination.dto';
import { BatchStatus, MovementType, PurchaseOrderStatus, UserRole } from '../common/enums';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { Location } from '../locations/location.entity';
import { PurchaseOrder } from '../purchase-orders/purchase-order.entity';
import { QualityTest } from '../quality/quality-test.entity';
import { CreateBatchDto } from './dto/create-batch.dto';
import { MoveBatchDto } from './dto/move-batch.dto';
import { BatchQueryDto } from './dto/batch-query.dto';
import { MovementQueryDto } from './dto/movement-query.dto';
import { Batch } from './batch.entity';
import { InventoryMovement } from './inventory-movement.entity';
import { IntegrationsService } from '../integrations/integrations.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BatchesService {
  constructor(
    private readonly audit: AuditService,
    private readonly integrations: IntegrationsService,
    private readonly notifications: NotificationsService,
    private readonly idempotency: IdempotencyService,
    @InjectRepository(Batch) private readonly batches: Repository<Batch>,
    @InjectRepository(InventoryMovement)
    private readonly movements: Repository<InventoryMovement>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrders: Repository<PurchaseOrder>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(QualityTest)
    private readonly qualityTests: Repository<QualityTest>,
  ) {}

  create(input: CreateBatchDto, actor: AuthenticatedUser, key?: string): Promise<Batch> {
    return this.idempotency.execute(
      `receive-po-${input.purchaseOrderId}`,
      key,
      { actorId: actor.id, payload: input },
      (manager) => this.createBatchInTransaction(manager, input, actor),
    );
  }

  receive(
    purchaseOrderId: number,
    input: Omit<CreateBatchDto, 'purchaseOrderId'>,
    actor: AuthenticatedUser,
    key?: string,
  ): Promise<Batch> {
    const payload = { ...input, purchaseOrderId };
    return this.idempotency.execute(
      `receive-po-${purchaseOrderId}`,
      key,
      { actorId: actor.id, payload },
      (manager) => this.createBatchInTransaction(manager, payload, actor),
    );
  }

  private async createBatchInTransaction(
    manager: EntityManager,
    input: CreateBatchDto,
    actor: AuthenticatedUser,
  ): Promise<Batch> {
    const purchaseOrderRepository = manager.getRepository(PurchaseOrder);
    const purchaseOrder = await purchaseOrderRepository.findOne({
      where: { id: input.purchaseOrderId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!purchaseOrder) throw new NotFoundException('Purchase order not found');
    if (
      purchaseOrder.status === PurchaseOrderStatus.CANCELLED ||
      purchaseOrder.receivedQuantity + input.quantity > purchaseOrder.quantity
    ) {
      throw new BadRequestException('Purchase order cannot receive this quantity');
    }
    const previousPurchaseOrderStatus = purchaseOrder.status;

    const location = await manager.getRepository(Location).findOneBy({ id: input.locationId });
    if (!location || !location.active) throw new NotFoundException('Active location not found');
    const batchRepository = manager.getRepository(Batch);
    const batch = await batchRepository.save(
      batchRepository.create({
        batchNumber: input.batchNumber,
        purchaseOrderId: purchaseOrder.id,
        quantity: input.quantity,
        requiredTests: input.requiredTests,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        status: BatchStatus.AWAITING_QA,
        currentLocationId: location.id,
      }),
    );
    purchaseOrder.receivedQuantity += input.quantity;
    purchaseOrder.status =
      purchaseOrder.receivedQuantity === purchaseOrder.quantity
        ? PurchaseOrderStatus.RECEIVED
        : PurchaseOrderStatus.PARTIALLY_RECEIVED;
    await purchaseOrderRepository.save(purchaseOrder);
    await manager.getRepository(InventoryMovement).insert({
      batchId: batch.id,
      fromLocationId: null,
      toLocationId: location.id,
      quantity: batch.quantity,
      movementType: MovementType.RECEIPT,
      actorId: actor.id,
    });
    await this.audit.record(manager, actor, 'purchase_order_received', 'batch', batch.id, {
      purchaseOrderId: purchaseOrder.id,
      locationId: location.id,
      quantity: batch.quantity,
    });
    await this.notifications.notifyRoles(
      manager,
      [UserRole.ADMIN, UserRole.PROCUREMENT],
      'purchase_order_received',
      {
        reference: purchaseOrder.reference,
        batchNumber: batch.batchNumber,
        quantity: batch.quantity,
        receivedQuantity: purchaseOrder.receivedQuantity,
        status: purchaseOrder.status,
      },
      `purchase-order-received:${batch.id}`,
    );
    await this.integrations.enqueue(manager, 'shipment.received', {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      purchaseOrderId: purchaseOrder.id,
      purchaseOrderReference: purchaseOrder.reference,
      locationId: location.id,
      quantity: batch.quantity,
    });
    if (purchaseOrder.status !== previousPurchaseOrderStatus) {
      await this.integrations.enqueue(manager, 'purchase_order.status_changed', {
        id: purchaseOrder.id,
        reference: purchaseOrder.reference,
        previousStatus: previousPurchaseOrderStatus,
        status: purchaseOrder.status,
        receivedQuantity: purchaseOrder.receivedQuantity,
      });
    }
    return batch;
  }

  move(
    id: number,
    input: MoveBatchDto,
    actor: AuthenticatedUser,
    key?: string,
  ): Promise<Batch> {
    return this.idempotency.execute(
      `batch-movement-${id}`,
      key,
      { actorId: actor.id, payload: input },
      (manager) => this.applyMovement(manager, id, input, actor),
    );
  }

  private async applyMovement(
    manager: EntityManager,
    id: number,
    input: MoveBatchDto,
    actor: AuthenticatedUser,
  ): Promise<Batch> {
    const repository = manager.getRepository(Batch);
    const batch = await repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!batch) throw new NotFoundException('Batch not found');

    const terminalStatuses = [BatchStatus.DISPATCHED, BatchStatus.REJECTED, BatchStatus.CONSUMED];
    if (terminalStatuses.includes(batch.status)) {
      throw new BadRequestException('This batch no longer supports inventory movements');
    }

    const movementRepository = manager.getRepository(InventoryMovement);
    const fromLocationId = batch.currentLocationId;
    let quantity = batch.quantity;
    let toLocationId: number | null = fromLocationId;

    switch (input.movementType) {
      case MovementType.TRANSFER: {
        if (input.quantity !== undefined || input.toLocationId === undefined) {
          throw new BadRequestException('Transfers require only a destination location');
        }
        if ([BatchStatus.ON_HOLD, BatchStatus.QUARANTINED].includes(batch.status)) {
          throw new BadRequestException('Held or quarantined batches cannot be transferred');
        }
        const destination = await manager.getRepository(Location).findOneBy({
          id: input.toLocationId,
          active: true,
        });
        if (!destination) throw new NotFoundException('Active destination location not found');
        if (batch.currentLocationId === destination.id) {
          throw new BadRequestException('Batch is already at this location');
        }
        toLocationId = destination.id;
        batch.currentLocationId = destination.id;
        break;
      }
      case MovementType.CONSUMPTION:
        if (input.toLocationId !== undefined || input.quantity === undefined) {
          throw new BadRequestException('Consumption requires only a quantity');
        }
        if (batch.status !== BatchStatus.RELEASED) {
          throw new BadRequestException('Only released batches may be consumed');
        }
        if (input.quantity > batch.quantity) {
          throw new BadRequestException('Consumption quantity exceeds available batch stock');
        }
        quantity = input.quantity;
        batch.quantity -= quantity;
        if (batch.quantity === 0) {
          batch.currentLocationId = null;
          batch.status = BatchStatus.CONSUMED;
          toLocationId = null;
        }
        break;
      case MovementType.HOLD:
        if (input.toLocationId !== undefined || input.quantity !== undefined) {
          throw new BadRequestException('Hold does not accept a location or quantity');
        }
        if ([BatchStatus.ON_HOLD, BatchStatus.QUARANTINED].includes(batch.status)) {
          throw new BadRequestException('Batch is already held or quarantined');
        }
        batch.statusBeforeHold = batch.status;
        batch.status = BatchStatus.ON_HOLD;
        break;
      case MovementType.RELEASE_HOLD:
        if (input.toLocationId !== undefined || input.quantity !== undefined) {
          throw new BadRequestException('Releasing a hold does not accept a location or quantity');
        }
        if (batch.status !== BatchStatus.ON_HOLD) {
          throw new BadRequestException('Batch is not on hold');
        }
        batch.status = batch.statusBeforeHold ?? BatchStatus.AWAITING_QA;
        batch.statusBeforeHold = null;
        break;
      default:
        throw new BadRequestException('Unsupported inventory movement');
    }

    await movementRepository.insert({
      batchId: batch.id,
      fromLocationId,
      toLocationId,
      quantity,
      movementType: input.movementType,
      actorId: actor.id,
    });
    const updated = await repository.save(batch);
    await this.audit.record(manager, actor, `batch_${input.movementType}`, 'batch', id, {
      quantity,
      fromLocationId,
      toLocationId,
      status: updated.status,
    });
    if (input.movementType === MovementType.HOLD) {
      await this.notifications.notifyRoles(
        manager,
        [UserRole.ADMIN, UserRole.QA_INSPECTOR, UserRole.WAREHOUSE_OPERATOR],
        'batch_on_hold',
        {
          batchNumber: updated.batchNumber,
          quantity: updated.quantity,
          status: updated.status,
          locationId: updated.currentLocationId,
        },
        `batch-hold:${updated.id}:${updated.updatedAt.toISOString()}`,
      );
    }
    return updated;
  }

  async dispatch(id: number, actor: AuthenticatedUser, key?: string): Promise<Batch> {
    return this.idempotency.execute(
      `batch-dispatch-${id}`,
      key,
      { actorId: actor.id, batchId: id },
      async (manager) => {
        const batch = await manager
          .getRepository(Batch)
          .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!batch) throw new NotFoundException('Batch not found');
        if (batch.status !== BatchStatus.RELEASED) {
          throw new BadRequestException('Only quality-released batches may be dispatched');
        }
        const fromLocationId = batch.currentLocationId;
        await manager.getRepository(InventoryMovement).insert({
          batchId: batch.id,
          fromLocationId,
          toLocationId: null,
          quantity: batch.quantity,
          movementType: MovementType.DISPATCH,
          actorId: actor.id,
        });
        batch.status = BatchStatus.DISPATCHED;
        batch.currentLocationId = null;
        const updated = await manager.getRepository(Batch).save(batch);
        await this.audit.record(manager, actor, 'batch_dispatched', 'batch', batch.id, {
          fromLocationId,
          quantity: batch.quantity,
        });
        await this.integrations.enqueue(manager, 'shipment.dispatched', {
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          purchaseOrderId: batch.purchaseOrderId,
          fromLocationId,
          quantity: batch.quantity,
        });
        return updated;
      },
    );
  }

  async findAll(query: BatchQueryDto): Promise<PaginatedResult<Batch>> {
    const builder = this.batches.createQueryBuilder('batch').where('1 = 1');
    if (query.search) {
      builder.andWhere('batch.batchNumber LIKE :search', { search: `%${query.search}%` });
    }
    if (query.status) builder.andWhere('batch.status = :status', { status: query.status });
    if (query.locationId) builder.andWhere('batch.currentLocationId = :locationId', { locationId: query.locationId });
    if (query.purchaseOrderId) {
      builder.andWhere('batch.purchaseOrderId = :purchaseOrderId', { purchaseOrderId: query.purchaseOrderId });
    }
    const [data, total] = await builder
      .orderBy('batch.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return paginated(data, total, query.page, query.limit);
  }

  async findAtLocation(locationId: number, query: BatchQueryDto): Promise<PaginatedResult<Batch>> {
    const builder = this.batches
      .createQueryBuilder('batch')
      .where('batch.currentLocationId = :locationId', { locationId })
      .andWhere('batch.quantity > 0');
    if (query.status) builder.andWhere('batch.status = :status', { status: query.status });
    if (query.search) {
      builder.andWhere('batch.batchNumber LIKE :search', { search: `%${query.search}%` });
    }
    if (query.purchaseOrderId) {
      builder.andWhere('batch.purchaseOrderId = :purchaseOrderId', {
        purchaseOrderId: query.purchaseOrderId,
      });
    }
    const [data, total] = await builder
      .orderBy('batch.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return paginated(data, total, query.page, query.limit);
  }

  async findOne(id: number): Promise<Batch> {
    const batch = await this.batches.findOneBy({ id });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  async findByCode(batchNumber: string): Promise<Batch> {
    const batch = await this.batches.findOneBy({ batchNumber });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  async traceBatch(id: number): Promise<Record<string, unknown>> {
    const batch = await this.batches.findOneBy({ id });
    if (!batch) throw new NotFoundException('Batch not found');
    const [purchaseOrder, qualityTests, movements] = await Promise.all([
      this.purchaseOrders.findOne({
        where: { id: batch.purchaseOrderId },
        relations: { supplier: true, product: true },
      }),
      this.qualityTests.find({ where: { batchId: id }, order: { createdAt: 'ASC' } }),
      this.movements.find({ where: { batchId: id }, order: { createdAt: 'ASC' } }),
    ]);
    return {
      purchaseOrder,
      batch,
      qualityTests,
      movements,
      currentLocation: batch.currentLocationId
        ? await this.locations.findOneBy({ id: batch.currentLocationId })
        : null,
    };
  }

  async traceBatchByCode(batchNumber: string): Promise<Record<string, unknown>> {
    const batch = await this.batches.findOneBy({ batchNumber });
    if (!batch) throw new NotFoundException('Batch not found');
    return this.traceBatch(batch.id);
  }

  async findMovements(
    id: number,
    query: MovementQueryDto,
  ): Promise<PaginatedResult<InventoryMovement>> {
    if (!(await this.batches.existsBy({ id }))) throw new NotFoundException('Batch not found');
    const builder = this.movements
      .createQueryBuilder('movement')
      .where('movement.batchId = :id', { id });
    if (query.movementType) {
      builder.andWhere('movement.movementType = :movementType', {
        movementType: query.movementType,
      });
    }
    if (query.search) {
      builder.andWhere('movement.movementType LIKE :search', { search: `%${query.search}%` });
    }
    const [data, total] = await builder
      .orderBy('movement.createdAt', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return paginated(data, total, query.page, query.limit);
  }

  async tracePurchaseOrder(id: number): Promise<Record<string, unknown>> {
    const purchaseOrder = await this.purchaseOrders.findOne({
      where: { id },
      relations: { supplier: true, product: true },
    });
    if (!purchaseOrder) throw new NotFoundException('Purchase order not found');
    const batches = await this.batches.find({
      where: { purchaseOrderId: id },
      order: { createdAt: 'ASC' },
    });
    const batchIds = batches.map((batch) => batch.id);
    const [qualityTests, movements] = batchIds.length
      ? await Promise.all([
          this.qualityTests
            .createQueryBuilder('test')
            .where('test.batchId IN (:...batchIds)', { batchIds })
            .orderBy('test.createdAt', 'ASC')
            .getMany(),
          this.movements
            .createQueryBuilder('movement')
            .where('movement.batchId IN (:...batchIds)', { batchIds })
            .orderBy('movement.createdAt', 'ASC')
            .getMany(),
        ])
      : [[], []];
    return { purchaseOrder, batches, qualityTests, movements };
  }
}
