import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { EmailTemplate } from './email-templates';

@Entity('email_outbox')
@Index(['sentAt', 'availableAt'])
export class EmailOutbox {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  dedupeKey: string | null;

  @Column({ length: 255 })
  recipient: string;

  @Column({ length: 80 })
  template: EmailTemplate;

  @Column({ type: 'json' })
  data: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'datetime' })
  availableAt: Date;

  @Column({ type: 'datetime', nullable: true })
  leasedUntil: Date | null;

  @Column({ type: 'datetime', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
