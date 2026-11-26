import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('inventory_movements')
@Index(['batchId', 'createdAt'])
export class InventoryMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  batchId: number;

  @Column({ nullable: true })
  fromLocationId: number | null;

  @Column({ nullable: true })
  toLocationId: number | null;

  @Column({ type: 'int', unsigned: true })
  quantity: number;

  @Column({ length: 30 })
  movementType: string;

  @Column()
  actorId: number;

  @CreateDateColumn()
  createdAt: Date;
}
