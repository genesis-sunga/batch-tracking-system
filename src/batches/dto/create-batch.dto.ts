import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateBatchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  batchNumber: string;

  @IsInt()
  @Min(1)
  purchaseOrderId: number;

  @IsInt()
  @Min(1)
  locationId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsInt()
  @Min(1)
  requiredTests = 1;
}
