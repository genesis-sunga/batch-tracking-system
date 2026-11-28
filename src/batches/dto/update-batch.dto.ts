import { IsDateString, IsIn, ValidateIf } from 'class-validator';
import { BatchStatus } from '../../common/enums';

export class UpdateBatchDto {
  @ValidateIf((_input: UpdateBatchDto, value: unknown) => value !== undefined && value !== null)
  @IsDateString()
  expiresAt?: string | null;

  @ValidateIf((_input: UpdateBatchDto, value: unknown) => value !== undefined)
  @IsIn([BatchStatus.RELEASED])
  status?: BatchStatus.RELEASED;
}
