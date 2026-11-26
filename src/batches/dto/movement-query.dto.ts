import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { MovementType } from '../../common/enums';

export class MovementQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(MovementType)
  movementType?: MovementType;
}
