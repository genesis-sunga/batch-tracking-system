import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ReportType } from './report-query.dto';

export enum ReportJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('report_jobs')
@Index('IDX_report_jobs_status_created_at', ['status', 'createdAt'])
export class ReportJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ReportType })
  reportType: ReportType;

  @Column({ type: 'json' })
  filters: Record<string, unknown>;

  @Column({ type: 'enum', enum: ReportJobStatus, default: ReportJobStatus.PENDING })
  status: ReportJobStatus;

  @Column({ type: 'json', nullable: true })
  result: Record<string, unknown>[] | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
