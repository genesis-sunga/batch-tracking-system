import { IsIn, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { MovementType } from '../../common/enums';

export class MoveBatchDto {
  @IsIn([
    MovementType.TRANSFER,
    MovementType.CONSUMPTION,
    MovementType.HOLD,
    MovementType.RELEASE_HOLD,
  ])
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
