import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../common/enums';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseOrderQueryDto } from './dto/purchase-order-query.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrder } from './purchase-order.entity';
import { PurchaseOrdersService } from './purchase-orders.service';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT)
  create(
    @Body() input: CreatePurchaseOrderDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PurchaseOrder> {
    return this.purchaseOrders.create(input, actor);
  }

  @Get()
  findAll(@Query() query: PurchaseOrderQueryDto) {
    return this.purchaseOrders.findAll(query);
  }

  @Get('reference/:reference')
  findByReference(@Param('reference') reference: string): Promise<PurchaseOrder> {
    return this.purchaseOrders.findByReference(reference);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<PurchaseOrder> {
    return this.purchaseOrders.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpdatePurchaseOrderDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PurchaseOrder> {
    return this.purchaseOrders.update(id, input, actor);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ deleted: true }> {
    await this.purchaseOrders.remove(id, actor);
    return { deleted: true };
  }
}
