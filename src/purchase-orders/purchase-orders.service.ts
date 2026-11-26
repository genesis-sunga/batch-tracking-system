import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseOrder } from './purchase-order.entity';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrders: Repository<PurchaseOrder>,
  ) {}

  create(input: CreatePurchaseOrderDto, actor: AuthenticatedUser): Promise<PurchaseOrder> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepository = manager.getRepository(PurchaseOrder);
      const order = await orderRepository.save(orderRepository.create(input));
      await this.audit.record(manager, actor, 'purchase_order_created', 'purchase_order', order.id, {
        reference: order.reference,
        quantity: order.quantity,
      });
      return order;
    });
  }

  findAll(): Promise<PurchaseOrder[]> {
    return this.purchaseOrders.find({ order: { createdAt: 'DESC' } });
  }
}
