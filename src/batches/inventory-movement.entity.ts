import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { MovementType } from '../common/enums';

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

  @Column({ type: 'enum', enum: MovementType })
  movementType: MovementType;

  @Column()
  actorId: number;

  @CreateDateColumn()
  createdAt: Date;
}
