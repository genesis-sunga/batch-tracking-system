import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { BatchStatus } from '../common/enums';
import { Location } from '../locations/location.entity';
import { PurchaseOrder } from '../purchase-orders/purchase-order.entity';
import { QualityTest } from '../quality/quality-test.entity';
import { CreateBatchDto } from './dto/create-batch.dto';
import { MoveBatchDto } from './dto/move-batch.dto';
import { Batch } from './batch.entity';
import { InventoryMovement } from './inventory-movement.entity';

@Injectable()
export class BatchesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    @InjectRepository(Batch) private readonly batches: Repository<Batch>,
    @InjectRepository(InventoryMovement)
    private readonly movements: Repository<InventoryMovement>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrders: Repository<PurchaseOrder>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(QualityTest)
    private readonly qualityTests: Repository<QualityTest>,
  ) {}

  async create(input: CreateBatchDto, actor: AuthenticatedUser): Promise<Batch> {
    return this.dataSource.transaction(async (manager) => {
      const purchaseOrder = await manager
        .getRepository(PurchaseOrder)
        .findOne({ where: { id: input.purchaseOrderId }, lock: { mode: 'pessimistic_write' } });
      if (!purchaseOrder) throw new NotFoundException('Purchase order not found');

      const location = await manager.getRepository(Location).findOneBy({ id: input.locationId });
      if (!location || !location.active) throw new NotFoundException('Active location not found');

      const batchRepository = manager.getRepository(Batch);
      const alreadyAllocated = await batchRepository
        .createQueryBuilder('batch')
        .select('COALESCE(SUM(batch.quantity), 0)', 'quantity')
        .where('batch.purchaseOrderId = :purchaseOrderId', {
          purchaseOrderId: purchaseOrder.id,
        })
        .getRawOne<{ quantity: string }>();
      if (Number(alreadyAllocated?.quantity ?? 0) + input.quantity > purchaseOrder.quantity) {
        throw new BadRequestException('Batch quantity exceeds the remaining purchase order quantity');
      }

      const batch = await batchRepository.save(
        batchRepository.create({
          batchNumber: input.batchNumber,
          purchaseOrderId: purchaseOrder.id,
          quantity: input.quantity,
          requiredTests: input.requiredTests,
          status: BatchStatus.AWAITING_QA,
          currentLocationId: location.id,
        }),
      );
      await manager.getRepository(InventoryMovement).insert({
        batchId: batch.id,
        fromLocationId: null,
        toLocationId: location.id,
        quantity: batch.quantity,
        movementType: 'receipt',
        actorId: actor.id,
      });
      await this.audit.record(manager, actor, 'batch_created', 'batch', batch.id, {
        purchaseOrderId: purchaseOrder.id,
        locationId: location.id,
        quantity: batch.quantity,
      });
      return batch;
    });
  }

  async transfer(id: number, input: MoveBatchDto, actor: AuthenticatedUser): Promise<Batch> {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager
        .getRepository(Batch)
        .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!batch) throw new NotFoundException('Batch not found');
      if (batch.status === BatchStatus.DISPATCHED) {
        throw new BadRequestException('A dispatched batch cannot be moved');
      }
      const destination = await manager
        .getRepository(Location)
        .findOneBy({ id: input.toLocationId, active: true });
      if (!destination) throw new NotFoundException('Active destination location not found');
      if (batch.currentLocationId === destination.id) {
        throw new BadRequestException('Batch is already at this location');
      }

      const fromLocationId = batch.currentLocationId;
      await manager.getRepository(InventoryMovement).insert({
        batchId: batch.id,
        fromLocationId,
        toLocationId: destination.id,
        quantity: batch.quantity,
        movementType: 'transfer',
        actorId: actor.id,
      });
      batch.currentLocationId = destination.id;
      const updated = await manager.getRepository(Batch).save(batch);
      await this.audit.record(manager, actor, 'batch_transferred', 'batch', batch.id, {
        fromLocationId,
        toLocationId: destination.id,
      });
      return updated;
    });
  }

  async dispatch(id: number, actor: AuthenticatedUser): Promise<Batch> {
    return this.dataSource.transaction(async (manager) => {
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
        movementType: 'dispatch',
        actorId: actor.id,
      });
      batch.status = BatchStatus.DISPATCHED;
      batch.currentLocationId = null;
      const updated = await manager.getRepository(Batch).save(batch);
      await this.audit.record(manager, actor, 'batch_dispatched', 'batch', batch.id, {
        fromLocationId,
        quantity: batch.quantity,
      });
      return updated;
    });
  }

  findAll(): Promise<Batch[]> {
    return this.batches.find({ order: { createdAt: 'DESC' } });
  }

  async findAtLocation(locationId: number): Promise<Batch[]> {
    return this.batches.find({ where: { currentLocationId: locationId } });
  }

  async traceBatch(id: number): Promise<Record<string, unknown>> {
    const batch = await this.batches.findOneBy({ id });
    if (!batch) throw new NotFoundException('Batch not found');
    const [purchaseOrder, qualityTests, movements] = await Promise.all([
      this.purchaseOrders.findOneBy({ id: batch.purchaseOrderId }),
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

  async tracePurchaseOrder(id: number): Promise<Record<string, unknown>> {
    const purchaseOrder = await this.purchaseOrders.findOneBy({ id });
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
