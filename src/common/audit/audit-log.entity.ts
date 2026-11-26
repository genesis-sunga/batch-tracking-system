import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  actorId: number;

  @Column({ length: 255 })
  actorEmail: string;

  @Column({ length: 80 })
  action: string;

  @Column({ length: 80 })
  entityType: string;

  @Column()
  entityId: number;

  @Column({ type: 'json', nullable: true })
  details: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
