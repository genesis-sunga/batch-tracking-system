import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { BatchStatus, QualityOutcome } from '../common/enums';
import { Batch } from '../batches/batch.entity';
import { QualityTest } from './quality-test.entity';
import { RecordQualityTestDto } from './dto/record-quality-test.dto';

@Injectable()
export class QualityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
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
      if (input.outcome === QualityOutcome.FAIL) {
        batch.status = BatchStatus.QUARANTINED;
      } else {
        const passedCount = await testRepository.count({
          where: { batchId, outcome: QualityOutcome.PASS },
        });
        if (passedCount >= batch.requiredTests) {
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
      return { test, batch: updatedBatch };
    });
  }

  findForBatch(batchId: number): Promise<QualityTest[]> {
    return this.qualityTests.find({
      where: { batchId },
      order: { createdAt: 'ASC' },
    });
  }
}
