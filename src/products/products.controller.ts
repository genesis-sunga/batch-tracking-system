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
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './product.entity';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT)
  create(
    @Body() input: CreateProductDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Product> {
    return this.products.create(input, actor);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.products.findAll(query);
  }

  @Get('sku/:sku')
  findBySku(@Param('sku') sku: string): Promise<Product> {
    return this.products.findBySku(sku);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Product> {
    return this.products.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpdateProductDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Product> {
    return this.products.update(id, input, actor);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ deleted: true }> {
    await this.products.remove(id, actor);
    return { deleted: true };
  }
}
