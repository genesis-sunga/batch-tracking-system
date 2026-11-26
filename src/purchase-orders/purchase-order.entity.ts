import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 100 })
  reference: string;

  @Column({ length: 255 })
  supplier: string;

  @Column({ type: 'int', unsigned: true })
  quantity: number;

  @CreateDateColumn()
  createdAt: Date;
}
