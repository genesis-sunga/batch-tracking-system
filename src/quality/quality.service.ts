import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginatedResult, paginated } from '../common/dto/pagination.dto';
import { BatchStatus, QualityOutcome, UserRole } from '../common/enums';
import { QualityTestQueryDto } from './dto/quality-test-query.dto';
import { Batch } from '../batches/batch.entity';
import { QualityTest } from './quality-test.entity';
import { RecordQualityTestDto } from './dto/record-quality-test.dto';
import { IntegrationsService } from '../integrations/integrations.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class QualityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly integrations: IntegrationsService,
    private readonly notifications: NotificationsService,
    @InjectRepository(QualityTest)
    private readonly qualityTests: Repository<QualityTest>,
  ) {}

  async record(
    batchId: number,
    input: RecordQualityTestDto,
    actor: AuthenticatedUser,
  ): Promise<{ test: QualityTest; batch: Batch }> {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager
        .getRepository(Batch)
        .findOne({ where: { id: batchId }, lock: { mode: 'pessimistic_write' } });
      if (!batch) throw new NotFoundException('Batch not found');
      if (batch.status === BatchStatus.DISPATCHED) {
        throw new BadRequestException('Cannot record quality results for a dispatched batch');
      }
      if ([BatchStatus.REJECTED, BatchStatus.ON_HOLD, BatchStatus.CONSUMED].includes(batch.status)) {
        throw new BadRequestException('Batch status does not allow additional quality tests');
      }

      const testRepository = manager.getRepository(QualityTest);
      const test = await testRepository.save(
        testRepository.create({
          batchId,
          testType: input.testType,
          outcome: input.outcome,
          notes: input.notes ?? null,
          inspectorId: actor.id,
        }),
      );
      const previousStatus = batch.status;
      if (input.outcome === QualityOutcome.REJECT) {
        batch.status = BatchStatus.REJECTED;
      } else if (input.outcome === QualityOutcome.FAIL) {
        batch.status = BatchStatus.QUARANTINED;
      } else {
        const tests = await testRepository.find({
          where: { batchId },
          order: { createdAt: 'DESC', id: 'DESC' },
        });
        const latestByType = new Map<string, QualityTest>();
        for (const result of tests) {
          if (!latestByType.has(result.testType)) latestByType.set(result.testType, result);
        }
        const hasRequiredPassingTests =
          latestByType.size >= batch.requiredTests &&
          [...latestByType.values()].every((result) => result.outcome === QualityOutcome.PASS);
        if (hasRequiredPassingTests) {
          batch.status = BatchStatus.RELEASED;
        } else if (batch.status !== BatchStatus.QUARANTINED) {
          batch.status = BatchStatus.AWAITING_QA;
        }
      }

      const updatedBatch = await manager.getRepository(Batch).save(batch);
      await this.audit.record(manager, actor, 'quality_test_recorded', 'batch', batchId, {
        testId: test.id,
        testType: test.testType,
        outcome: test.outcome,
        previousStatus,
        status: updatedBatch.status,
      });
      if (previousStatus === BatchStatus.QUARANTINED && updatedBatch.status === BatchStatus.RELEASED) {
        await this.audit.record(manager, actor, 'quarantined_batch_released', 'batch', batchId, {
          testId: test.id,
        });
      }
      if (input.outcome !== QualityOutcome.PASS) {
        await this.notifications.notifyRoles(
          manager,
          [UserRole.ADMIN, UserRole.QA_INSPECTOR, UserRole.WAREHOUSE_OPERATOR],
          'quality_failed',
          {
            batchNumber: updatedBatch.batchNumber,
            testType: test.testType,
            outcome: test.outcome,
            status: updatedBatch.status,
            notes: test.notes,
          },
          `quality-test:${test.id}`,
        );
      }
      if (previousStatus !== BatchStatus.RELEASED && updatedBatch.status === BatchStatus.RELEASED) {
        await this.notifications.notifyRoles(
          manager,
          [UserRole.ADMIN, UserRole.PROCUREMENT, UserRole.WAREHOUSE_OPERATOR],
          'batch_released',
          {
            batchNumber: updatedBatch.batchNumber,
            quantity: updatedBatch.quantity,
            status: updatedBatch.status,
          },
          `batch-released:${updatedBatch.id}:${test.id}`,
        );
      }
      if (updatedBatch.status === BatchStatus.REJECTED && previousStatus !== BatchStatus.REJECTED) {
        await this.notifications.notifyRoles(
          manager,
          [UserRole.ADMIN, UserRole.PROCUREMENT, UserRole.QA_INSPECTOR, UserRole.WAREHOUSE_OPERATOR],
          'batch_recalled',
          {
            batchNumber: updatedBatch.batchNumber,
            quantity: updatedBatch.quantity,
            testType: test.testType,
            status: updatedBatch.status,
          },
          `batch-recalled:${updatedBatch.id}:${test.id}`,
        );
      }
      await this.integrations.enqueue(manager, 'quality.test_recorded', {
        batchId,
        testId: test.id,
        testType: test.testType,
        outcome: test.outcome,
        status: updatedBatch.status,
      });
      if (updatedBatch.status !== previousStatus) {
        const eventType =
          updatedBatch.status === BatchStatus.RELEASED
            ? 'batch.released'
            : updatedBatch.status === BatchStatus.REJECTED
              ? 'batch.recalled'
              : 'batch.quarantined';
        await this.integrations.enqueue(manager, eventType, {
          batchId,
          testId: test.id,
          previousStatus,
          status: updatedBatch.status,
        });
      }
      return { test, batch: updatedBatch };
    });
  }

  async findForBatch(
    batchId: number,
    query: QualityTestQueryDto,
  ): Promise<PaginatedResult<QualityTest>> {
    const builder = this.qualityTests
      .createQueryBuilder('test')
      .where('test.batchId = :batchId', { batchId });
    if (query.outcome) builder.andWhere('test.outcome = :outcome', { outcome: query.outcome });
    if (query.search) {
      builder.andWhere('test.testType LIKE :search', { search: `%${query.search}%` });
    }
    const [data, total] = await builder
      .orderBy('test.createdAt', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return paginated(data, total, query.page, query.limit);
  }
}
