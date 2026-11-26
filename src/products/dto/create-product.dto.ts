import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sku: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
