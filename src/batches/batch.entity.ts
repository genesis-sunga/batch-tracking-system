import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BatchStatus } from '../common/enums';

@Entity('batches')
@Index(['batchNumber'], { unique: true })
export class Batch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  batchNumber: string;

  @Column()
  purchaseOrderId: number;

  @Column({ type: 'int', unsigned: true })
  quantity: number;

  @Column({ type: 'int', unsigned: true, default: 1 })
  requiredTests: number;

  @Column({ type: 'enum', enum: BatchStatus, default: BatchStatus.AWAITING_QA })
  status: BatchStatus;

  @Column({ type: 'enum', enum: BatchStatus, nullable: true })
  statusBeforeHold: BatchStatus | null;

  @Column({ nullable: true })
  currentLocationId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
