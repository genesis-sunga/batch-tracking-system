import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { BatchStatus } from '../../common/enums';

export class BatchQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  locationId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  purchaseOrderId?: number;

  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;
}
