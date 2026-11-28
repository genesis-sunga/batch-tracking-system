import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BatchStatus, MovementType, PurchaseOrderStatus, QualityOutcome } from '../common/enums';

export enum ReportFormat {
  JSON = 'json',
  CSV = 'csv',
  PDF = 'pdf',
}

export enum ReportType {
  STOCK = 'stock',
  BATCHES = 'batches',
  EXPIRY = 'expiry',
  QUALITY = 'quality',
  QUALITY_TESTS = 'quality_tests',
  PURCHASE_ORDERS = 'purchase_orders',
  MOVEMENTS = 'movements',
}

export enum ExpiryStatus {
  EXPIRED = 'expired',
  UPCOMING = 'upcoming',
}

export class ReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  limit = 1_000;

  @IsOptional()
  @IsEnum(ReportFormat)
  format = ReportFormat.JSON;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  locationId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @IsEnum(BatchStatus)
  batchStatus?: BatchStatus;

  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  poStatus?: PurchaseOrderStatus;

  @IsOptional()
  @IsEnum(QualityOutcome)
  outcome?: QualityOutcome;

  @IsOptional()
  @IsEnum(MovementType)
  movementType?: MovementType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  testType?: string;

  @IsOptional()
  @IsEnum(ExpiryStatus)
  expiryStatus?: ExpiryStatus;
}

export class CreateReportJobDto extends ReportQueryDto {
  @IsEnum(ReportType)
  reportType: ReportType;
}
