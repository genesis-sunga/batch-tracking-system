import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../common/audit/audit.module';
import { Batch } from '../batches/batch.entity';
import { QualityController } from './quality.controller';
import { QualityService } from './quality.service';
import { QualityTest } from './quality-test.entity';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [TypeOrmModule.forFeature([QualityTest, Batch]), AuditModule, IntegrationsModule],
  controllers: [QualityController],
  providers: [QualityService],
})
export class QualityModule {}
