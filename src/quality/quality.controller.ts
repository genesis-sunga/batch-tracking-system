import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Batch } from '../batches/batch.entity';
import { QualityTest } from './quality-test.entity';
import { QualityService } from './quality.service';
import { RecordQualityTestDto } from './dto/record-quality-test.dto';
import { QualityTestQueryDto } from './dto/quality-test-query.dto';

@Controller('batches/:id/quality-tests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QualityController {
  constructor(private readonly quality: QualityService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.QA_INSPECTOR)
  record(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: RecordQualityTestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ test: QualityTest; batch: Batch }> {
    return this.quality.record(id, input, actor);
  }

  @Get()
  findForBatch(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QualityTestQueryDto,
  ) {
    return this.quality.findForBatch(id, query);
  }
}
