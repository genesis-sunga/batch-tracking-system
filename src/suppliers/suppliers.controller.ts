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
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Supplier } from './supplier.entity';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT)
  create(
    @Body() input: CreateSupplierDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Supplier> {
    return this.suppliers.create(input, actor);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.suppliers.findAll(query);
  }

  @Get('code/:code')
  findByCode(@Param('code') code: string): Promise<Supplier> {
    return this.suppliers.findByCode(code);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Supplier> {
    return this.suppliers.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpdateSupplierDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Supplier> {
    return this.suppliers.update(id, input, actor);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ deleted: true }> {
    await this.suppliers.remove(id, actor);
    return { deleted: true };
  }
}
