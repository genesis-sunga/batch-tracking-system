import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../common/enums';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
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
  findAll(): Promise<PurchaseOrder[]> {
    return this.purchaseOrders.findAll();
  }
}
