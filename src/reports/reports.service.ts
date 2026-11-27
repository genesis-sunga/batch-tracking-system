import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { Batch } from '../batches/batch.entity';
import { InventoryMovement } from '../batches/inventory-movement.entity';
import { PurchaseOrder } from '../purchase-orders/purchase-order.entity';
import { QualityTest } from '../quality/quality-test.entity';
import { ReportJob, ReportJobStatus } from './report-job.entity';
import { ReportQueryDto, ReportType } from './report-query.dto';

type ReportRow = Record<string, unknown>;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Batch) private readonly batches: Repository<Batch>,
    @InjectRepository(InventoryMovement)
    private readonly movements: Repository<InventoryMovement>,
    @InjectRepository(QualityTest) private readonly tests: Repository<QualityTest>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrders: Repository<PurchaseOrder>,
    @InjectRepository(ReportJob) private readonly jobs: Repository<ReportJob>,
  ) {}

  async stock(query: ReportQueryDto): Promise<ReportRow[]> {
    const builder = this.batches
      .createQueryBuilder('batch')
      .leftJoin('locations', 'location', 'location.id = batch.currentLocationId')
      .leftJoin('purchase_orders', 'po', 'po.id = batch.purchaseOrderId')
      .leftJoin('products', 'product', 'product.id = po.productId')
      .select([
        'batch.id AS batchId',
        'batch.batchNumber AS batchNumber',
        'batch.quantity AS quantity',
        'batch.status AS status',
        'batch.expiresAt AS expiresAt',
        'batch.currentLocationId AS locationId',
        'location.code AS locationCode',
        'location.name AS locationName',
        'po.reference AS purchaseOrderReference',
        'product.sku AS sku',
        'product.name AS productName',
      ])
      .where('batch.quantity > 0')
      .andWhere('batch.currentLocationId IS NOT NULL');
    if (query.locationId) builder.andWhere('batch.currentLocationId = :locationId', { locationId: query.locationId });
    if (query.batchStatus) builder.andWhere('batch.status = :status', { status: query.batchStatus });
    this.applyDateRange(builder, query, 'batch.createdAt');
    return builder
      .orderBy('batch.batchNumber', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getRawMany<ReportRow>();
  }

  async expiry(query: ReportQueryDto): Promise<ReportRow[]> {
    const builder = this.batches
      .createQueryBuilder('batch')
      .leftJoin('locations', 'location', 'location.id = batch.currentLocationId')
      .leftJoin('purchase_orders', 'po', 'po.id = batch.purchaseOrderId')
      .select([
        'batch.id AS batchId',
        'batch.batchNumber AS batchNumber',
        'batch.expiresAt AS expiresAt',
        'batch.status AS status',
        'batch.quantity AS quantity',
        'location.code AS locationCode',
        'po.reference AS purchaseOrderReference',
      ])
      .where('batch.expiresAt IS NOT NULL')
      .andWhere('batch.quantity > 0');
    if (query.expiryStatus === 'expired') {
      builder.andWhere('batch.expiresAt < :now', { now: new Date() });
    } else if (query.expiryStatus === 'upcoming') {
      builder.andWhere('batch.expiresAt >= :now', { now: new Date() });
    }
    this.applyDateRange(builder, query, 'batch.expiresAt');
    if (query.batchStatus) builder.andWhere('batch.status = :status', { status: query.batchStatus });
    return builder
      .orderBy('batch.expiresAt', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getRawMany<ReportRow>();
  }

  async quality(query: ReportQueryDto): Promise<ReportRow[]> {
    const builder = this.tests
      .createQueryBuilder('test')
      .select('test.testType', 'testType')
      .addSelect('test.outcome', 'outcome')
      .addSelect('COUNT(test.id)', 'count')
      .groupBy('test.testType')
      .addGroupBy('test.outcome');
    if (query.outcome) builder.andWhere('test.outcome = :outcome', { outcome: query.outcome });
    if (query.testType) builder.andWhere('test.testType = :testType', { testType: query.testType });
    this.applyDateRange(builder, query, 'test.createdAt');
    return builder
      .orderBy('test.testType', 'ASC')
      .addOrderBy('test.outcome', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getRawMany<ReportRow>();
  }

  async purchaseOrderFulfillment(query: ReportQueryDto): Promise<ReportRow[]> {
    const builder = this.purchaseOrders
      .createQueryBuilder('po')
      .leftJoin('suppliers', 'supplier', 'supplier.id = po.supplierId')
      .leftJoin('products', 'product', 'product.id = po.productId')
      .select([
        'po.id AS purchaseOrderId',
        'po.reference AS reference',
        'po.status AS status',
        'po.quantity AS orderedQuantity',
        'po.receivedQuantity AS receivedQuantity',
        '(po.quantity - po.receivedQuantity) AS remainingQuantity',
        'supplier.name AS supplierName',
        'product.sku AS sku',
        'product.name AS productName',
        'po.createdAt AS createdAt',
      ]);
    if (query.poStatus) builder.andWhere('po.status = :status', { status: query.poStatus });
    this.applyDateRange(builder, query, 'po.createdAt');
    return builder
      .orderBy('po.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getRawMany<ReportRow>();
  }

  async movementLog(query: ReportQueryDto): Promise<ReportRow[]> {
    const builder = this.movements
      .createQueryBuilder('movement')
      .leftJoin('batches', 'batch', 'batch.id = movement.batchId')
      .leftJoin('locations', 'source', 'source.id = movement.fromLocationId')
      .leftJoin('locations', 'destination', 'destination.id = movement.toLocationId')
      .select([
        'movement.id AS movementId',
        'movement.createdAt AS createdAt',
        'movement.batchId AS batchId',
        'batch.batchNumber AS batchNumber',
        'movement.movementType AS movementType',
        'movement.quantity AS quantity',
        'source.code AS fromLocation',
        'destination.code AS toLocation',
        'movement.actorId AS actorId',
      ]);
    if (query.batchId) builder.andWhere('movement.batchId = :batchId', { batchId: query.batchId });
    if (query.movementType) {
      builder.andWhere('movement.movementType = :movementType', {
        movementType: query.movementType,
      });
    }
    this.applyDateRange(builder, query, 'movement.createdAt');
    return builder
      .orderBy('movement.createdAt', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getRawMany<ReportRow>();
  }

  async run(type: ReportType, query: ReportQueryDto): Promise<ReportRow[]> {
    switch (type) {
      case ReportType.STOCK:
        return this.stock(query);
      case ReportType.EXPIRY:
        return this.expiry(query);
      case ReportType.QUALITY:
        return this.quality(query);
      case ReportType.PURCHASE_ORDERS:
        return this.purchaseOrderFulfillment(query);
      case ReportType.MOVEMENTS:
        return this.movementLog(query);
    }
  }

  async createJob(type: ReportType, query: ReportQueryDto): Promise<ReportJob> {
    const job = this.jobs.create({
      reportType: type,
      filters: { ...query },
      status: ReportJobStatus.PENDING,
      result: null,
      error: null,
      startedAt: null,
      completedAt: null,
    });
    return this.jobs.save(job);
  }

  async getJob(id: number): Promise<ReportJob> {
    const job = await this.jobs.findOneBy({ id });
    if (!job) throw new NotFoundException('Report job not found');
    return job;
  }

  private applyDateRange<T extends ObjectLiteral>(
    builder: SelectQueryBuilder<T>,
    query: ReportQueryDto,
    column: string,
  ): void {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(query.to ?? '')) {
      to.setUTCHours(23, 59, 59, 999);
    }
    if (from && to && from > to) {
      throw new BadRequestException('"from" must be earlier than or equal to "to"');
    }
    if (from && to) {
      builder.andWhere(`${column} BETWEEN :from AND :to`, {
        from,
        to,
      });
    } else if (from) {
      builder.andWhere(`${column} >= :from`, { from });
    } else if (to) {
      builder.andWhere(`${column} <= :to`, { to });
    }
  }
}
