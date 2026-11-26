import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  supplierId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  productId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
