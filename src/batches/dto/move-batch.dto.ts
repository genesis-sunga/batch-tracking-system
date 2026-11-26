import { IsEnum, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { MovementType } from '../../common/enums';

export class MoveBatchDto {
  @IsEnum(MovementType)
  movementType: MovementType;

  @ValidateIf((input: MoveBatchDto) => input.movementType === MovementType.TRANSFER)
  @IsInt()
  @Min(1)
  toLocationId?: number;

  @ValidateIf((input: MoveBatchDto) => input.movementType === MovementType.CONSUMPTION)
  @IsInt()
  @Min(1)
  quantity?: number;
}
