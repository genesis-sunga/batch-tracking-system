import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { paginated } from '../common/dto/pagination.dto';
import { PurchaseOrderStatus } from '../common/enums';
import { Batch } from '../batches/batch.entity';
import { Product } from '../products/product.entity';
import { Supplier } from '../suppliers/supplier.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseOrderQueryDto } from './dto/purchase-order-query.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrder } from './purchase-order.entity';
import { IntegrationsService } from '../integrations/integrations.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly integrations: IntegrationsService,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrders: Repository<PurchaseOrder>,
  ) {}

  create(input: CreatePurchaseOrderDto, actor: AuthenticatedUser): Promise<PurchaseOrder> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepository = manager.getRepository(PurchaseOrder);
      const supplier = await manager.getRepository(Supplier).findOneBy({ id: input.supplierId });
      if (!supplier || !supplier.active) throw new NotFoundException('Active supplier not found');
      const product = await manager.getRepository(Product).findOneBy({ id: input.productId });
      if (!product || !product.active) throw new NotFoundException('Active product not found');
      const order = await orderRepository.save(
        orderRepository.create({ ...input, status: PurchaseOrderStatus.OPEN }),
      );
      await this.audit.record(manager, actor, 'purchase_order_created', 'purchase_order', order.id, {
        reference: order.reference,
        quantity: order.quantity,
      });
      await this.integrations.enqueue(manager, 'purchase_order.created', {
        id: order.id,
        reference: order.reference,
        supplierId: order.supplierId,
        productId: order.productId,
        quantity: order.quantity,
        status: order.status,
      });
      return order;
    });
  }

  async findAll(query: PurchaseOrderQueryDto) {
    const builder = this.purchaseOrders
      .createQueryBuilder('po')
      .where('1 = 1')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .leftJoinAndSelect('po.product', 'product');
    if (query.search) {
      builder.where('(po.reference LIKE :search OR supplier.name LIKE :search OR product.name LIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.supplierId) builder.andWhere('po.supplierId = :supplierId', { supplierId: query.supplierId });
    if (query.productId) builder.andWhere('po.productId = :productId', { productId: query.productId });
    if (query.status) builder.andWhere('po.status = :status', { status: query.status });
    const [data, total] = await builder
      .orderBy('po.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return paginated(data, total, query.page, query.limit);
  }

  async findOne(id: number): Promise<PurchaseOrder> {
    const purchaseOrder = await this.purchaseOrders.findOne({
      where: { id },
      relations: { supplier: true, product: true },
    });
    if (!purchaseOrder) throw new NotFoundException('Purchase order not found');
    return purchaseOrder;
  }

  async findByReference(reference: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.purchaseOrders.findOne({
      where: { reference },
      relations: { supplier: true, product: true },
    });
    if (!purchaseOrder) throw new NotFoundException('Purchase order not found');
    return purchaseOrder;
  }

  async update(id: number, input: UpdatePurchaseOrderDto, actor: AuthenticatedUser): Promise<PurchaseOrder> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PurchaseOrder);
      const purchaseOrder = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!purchaseOrder) throw new NotFoundException('Purchase order not found');
      if (purchaseOrder.receivedQuantity > 0) {
        throw new ConflictException('A purchase order cannot be edited after receiving has started');
      }
      const previousStatus = purchaseOrder.status;
      if (input.supplierId) {
        const supplier = await manager.getRepository(Supplier).findOneBy({ id: input.supplierId });
        if (!supplier || !supplier.active) throw new NotFoundException('Active supplier not found');
      }
      if (input.productId) {
        const product = await manager.getRepository(Product).findOneBy({ id: input.productId });
        if (!product || !product.active) throw new NotFoundException('Active product not found');
      }
      Object.assign(purchaseOrder, input);
      const updated = await repository.save(purchaseOrder);
      await this.audit.record(manager, actor, 'purchase_order_updated', 'purchase_order', id, {
        ...input,
      });
      if (updated.status !== previousStatus) {
        await this.integrations.enqueue(manager, 'purchase_order.status_changed', {
          id: updated.id,
          reference: updated.reference,
          previousStatus,
          status: updated.status,
        });
      }
      return updated;
    });
  }

  async remove(id: number, actor: AuthenticatedUser): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PurchaseOrder);
      const purchaseOrder = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!purchaseOrder) throw new NotFoundException('Purchase order not found');
      if (await manager.getRepository(Batch).countBy({ purchaseOrderId: id })) {
        throw new ConflictException('Purchase order has received batches and cannot be deleted');
      }
      await repository.remove(purchaseOrder);
      await this.audit.record(manager, actor, 'purchase_order_deleted', 'purchase_order', id);
    });
  }
}
