import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class ReceiveBatchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  batchNumber: string;

  @IsInt()
  @Min(1)
  locationId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsInt()
  @Min(1)
  requiredTests = 1;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
