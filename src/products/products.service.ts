import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto, paginated } from '../common/dto/pagination.dto';
import { PurchaseOrder } from '../purchase-orders/purchase-order.entity';
import { Product } from './product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  create(input: CreateProductDto, actor: AuthenticatedUser): Promise<Product> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Product);
      const product = await repository.save(repository.create(input));
      await this.audit.record(manager, actor, 'product_created', 'product', product.id, {
        sku: product.sku,
      });
      return product;
    });
  }

  async findAll(query: PaginationDto) {
    const builder = this.products.createQueryBuilder('product');
    if (query.search) {
      builder.where('(product.sku LIKE :search OR product.name LIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    const [data, total] = await builder
      .orderBy('product.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return paginated(data, total, query.page, query.limit);
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.products.findOneBy({ id });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findBySku(sku: string): Promise<Product> {
    const product = await this.products.findOneBy({ sku });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  update(id: number, input: UpdateProductDto, actor: AuthenticatedUser): Promise<Product> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Product);
      const product = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Product not found');
      Object.assign(product, input);
      const updated = await repository.save(product);
      await this.audit.record(manager, actor, 'product_updated', 'product', id, { ...input });
      return updated;
    });
  }

  remove(id: number, actor: AuthenticatedUser): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Product);
      const product = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Product not found');
      const used = await manager.getRepository(PurchaseOrder).countBy({ productId: id });
      if (used) throw new ConflictException('Product is referenced by purchase orders');
      await repository.remove(product);
      await this.audit.record(manager, actor, 'product_deleted', 'product', id, {
        sku: product.sku,
      });
    });
  }
}
