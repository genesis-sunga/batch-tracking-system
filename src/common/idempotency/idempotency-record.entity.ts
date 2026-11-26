import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('idempotency_records')
@Index(['scope', 'key'], { unique: true })
export class IdempotencyRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80 })
  scope: string;

  @Column({ length: 128 })
  key: string;

  @Column({ length: 64 })
  requestHash: string;

  @Column({ type: 'json', nullable: true })
  response: unknown | null;

  @CreateDateColumn()
  createdAt: Date;
}
