import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ReportJob, ReportJobStatus } from './report-job.entity';
import { ReportQueryDto } from './report-query.dto';
import { ReportsService } from './reports.service';

const REPORT_POLL_INTERVAL_MS = 3_000;

@Injectable()
export class ReportJobsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportJobsWorker.name);
  private timer: NodeJS.Timeout | undefined;
  private processing = false;

  constructor(
    @InjectRepository(ReportJob) private readonly jobs: Repository<ReportJob>,
    private readonly reports: ReportsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.processNext(), REPORT_POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.jobs.update(
        {
          status: ReportJobStatus.RUNNING,
          startedAt: LessThan(new Date(Date.now() - 30 * 60_000)),
        },
        { status: ReportJobStatus.PENDING, startedAt: null },
      );
      const next = await this.jobs.findOne({
        where: { status: ReportJobStatus.PENDING },
        order: { createdAt: 'ASC' },
      });
      if (!next) return;

      const claim = await this.jobs.update(
        { id: next.id, status: ReportJobStatus.PENDING },
        { status: ReportJobStatus.RUNNING, startedAt: new Date() },
      );
      if (!claim.affected) return;
      next.status = ReportJobStatus.RUNNING;
      next.startedAt = new Date();

      try {
        const result = await this.reports.run(
          next.reportType,
          Object.assign(new ReportQueryDto(), next.filters),
        );
        next.status = ReportJobStatus.COMPLETED;
        next.result = result;
        next.error = null;
      } catch (error) {
        next.status = ReportJobStatus.FAILED;
        next.result = null;
        next.error = this.errorMessage(error).slice(0, 2_000);
        this.logger.error(`Report job ${next.id} failed: ${next.error}`);
      }
      next.completedAt = new Date();
      await this.jobs.save(next);
    } catch (error) {
      this.logger.error(`Unable to process report job: ${this.errorMessage(error)}`);
    } finally {
      this.processing = false;
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown report error';
  }
}
