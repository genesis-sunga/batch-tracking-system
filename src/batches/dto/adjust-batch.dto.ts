import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AdjustBatchDto {
  @IsInt()
  @Min(0)
  @Max(4_294_967_295)
  countedQuantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
