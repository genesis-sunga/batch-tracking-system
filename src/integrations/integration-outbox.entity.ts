import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('integration_outbox')
@Index(['deliveredAt', 'availableAt'])
export class IntegrationOutbox {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 36 })
  eventId: string;

  @Column({ length: 100 })
  eventType: string;

  @Column({ type: 'json' })
  data: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'datetime' })
  availableAt: Date;

  @Column({ type: 'datetime', nullable: true })
  leasedUntil: Date | null;

  @Column({ type: 'datetime', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
