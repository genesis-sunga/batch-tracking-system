import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Batch } from './batch.entity';
import { BatchesService } from './batches.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { MoveBatchDto } from './dto/move-batch.dto';
import { BatchQueryDto } from './dto/batch-query.dto';
import { ReceiveBatchDto } from './dto/receive-batch.dto';
import { MovementQueryDto } from './dto/movement-query.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Post('batches')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_OPERATOR)
  create(
    @Body() input: CreateBatchDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') key?: string,
  ): Promise<Batch> {
    return this.batches.create(input, actor, key);
  }

  @Get('batches')
  findAll(@Query() query: BatchQueryDto) {
    return this.batches.findAll(query);
  }

  @Get('batches/:id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Batch> {
    return this.batches.findOne(id);
  }

  @Get('batches/code/:code')
  findByCode(@Param('code') code: string): Promise<Batch> {
    return this.batches.findByCode(code);
  }

  @Post('batches/:id/storage-movements')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_OPERATOR)
  move(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: MoveBatchDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') key?: string,
  ): Promise<Batch> {
    return this.batches.move(id, input, actor, key);
  }

  @Post('batches/:id/dispatch')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_OPERATOR)
  dispatch(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') key?: string,
  ): Promise<Batch> {
    return this.batches.dispatch(id, actor, key);
  }

  @Get('batches/:id/movements')
  movements(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: MovementQueryDto,
  ) {
    return this.batches.findMovements(id, query);
  }

  @Post('purchase-orders/:id/receive')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_OPERATOR, UserRole.PROCUREMENT)
  receive(
    @Param('id', ParseIntPipe) purchaseOrderId: number,
    @Body() input: ReceiveBatchDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') key?: string,
  ): Promise<Batch> {
    return this.batches.receive(purchaseOrderId, input, actor, key);
  }

  @Get('batches/code/:code/trace')
  traceBatchByCode(@Param('code') code: string): Promise<Record<string, unknown>> {
    return this.batches.traceBatchByCode(code);
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
  batchesAtLocation(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: BatchQueryDto,
  ) {
    return this.batches.findAtLocation(id, query);
  }
}
