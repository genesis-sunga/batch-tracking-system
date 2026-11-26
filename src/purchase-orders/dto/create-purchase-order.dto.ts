import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePurchaseOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  reference: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  supplier: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
