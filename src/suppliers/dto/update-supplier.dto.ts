import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
