import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BatchStatus } from '../common/enums';

@Entity('batches')
@Index(['batchNumber'], { unique: true })
@Index('IDX_batches_expiry', ['expiresAt'])
@Index('IDX_batches_quarantine_reminder', ['status', 'updatedAt'])
@Index('IDX_batches_location_status', ['currentLocationId', 'status'])
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

  @Column({ type: 'int', nullable: true })
  currentLocationId: number | null;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
