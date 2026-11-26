import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PurchaseOrderStatus } from '../../common/enums';

export class PurchaseOrderQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supplierId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId?: number;

  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;
}
