import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Batch } from './batch.entity';
import { BatchesService } from './batches.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { MoveBatchDto } from './dto/move-batch.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Post('batches')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_OPERATOR)
  create(
    @Body() input: CreateBatchDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Batch> {
    return this.batches.create(input, actor);
  }

  @Get('batches')
  findAll(): Promise<Batch[]> {
    return this.batches.findAll();
  }

  @Post('batches/:id/transfer')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_OPERATOR)
  transfer(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: MoveBatchDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Batch> {
    return this.batches.transfer(id, input, actor);
  }

  @Post('batches/:id/dispatch')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_OPERATOR)
  dispatch(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Batch> {
    return this.batches.dispatch(id, actor);
  }

  @Get('batches/:id/trace')
  traceBatch(@Param('id', ParseIntPipe) id: number): Promise<Record<string, unknown>> {
    return this.batches.traceBatch(id);
  }

  @Get('purchase-orders/:id/trace')
  tracePurchaseOrder(@Param('id', ParseIntPipe) id: number): Promise<Record<string, unknown>> {
    return this.batches.tracePurchaseOrder(id);
  }

  @Get('locations/:id/batches')
  batchesAtLocation(@Param('id', ParseIntPipe) id: number): Promise<Batch[]> {
    return this.batches.findAtLocation(id);
  }
}
