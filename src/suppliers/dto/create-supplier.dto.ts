import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
