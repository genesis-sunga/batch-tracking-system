import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePurchaseOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  reference: string;

  @IsInt()
  @Min(1)
  supplierId: number;

  @IsInt()
  @Min(1)
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}
