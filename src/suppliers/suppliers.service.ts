import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto, paginated } from '../common/dto/pagination.dto';
import { PurchaseOrder } from '../purchase-orders/purchase-order.entity';
import { Supplier } from './supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
  ) {}

  create(input: CreateSupplierDto, actor: AuthenticatedUser): Promise<Supplier> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Supplier);
      const supplier = await repository.save(repository.create(input));
      await this.audit.record(manager, actor, 'supplier_created', 'supplier', supplier.id, {
        code: supplier.code,
      });
      return supplier;
    });
  }

  async findAll(query: PaginationDto) {
    const builder = this.suppliers.createQueryBuilder('supplier');
    if (query.search) {
      builder.where('(supplier.code LIKE :search OR supplier.name LIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    const [data, total] = await builder
      .orderBy('supplier.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return paginated(data, total, query.page, query.limit);
  }

  async findOne(id: number): Promise<Supplier> {
    const supplier = await this.suppliers.findOneBy({ id });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async findByCode(code: string): Promise<Supplier> {
    const supplier = await this.suppliers.findOneBy({ code });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  update(id: number, input: UpdateSupplierDto, actor: AuthenticatedUser): Promise<Supplier> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Supplier);
      const supplier = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!supplier) throw new NotFoundException('Supplier not found');
      Object.assign(supplier, input);
      const updated = await repository.save(supplier);
      await this.audit.record(manager, actor, 'supplier_updated', 'supplier', id, { ...input });
      return updated;
    });
  }

  remove(id: number, actor: AuthenticatedUser): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Supplier);
      const supplier = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!supplier) throw new NotFoundException('Supplier not found');
      const used = await manager.getRepository(PurchaseOrder).countBy({ supplierId: id });
      if (used) throw new ConflictException('Supplier is referenced by purchase orders');
      await repository.remove(supplier);
      await this.audit.record(manager, actor, 'supplier_deleted', 'supplier', id, {
        code: supplier.code,
      });
    });
  }
}
