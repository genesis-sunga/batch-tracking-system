import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PurchaseOrderStatus } from '../common/enums';
import { Product } from '../products/product.entity';
import { Supplier } from '../suppliers/supplier.entity';

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 100 })
  reference: string;

  @Column()
  supplierId: number;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @Column()
  productId: number;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int', unsigned: true })
  quantity: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  receivedQuantity: number;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.OPEN,
  })
  status: PurchaseOrderStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
