import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { QualityOutcome } from '../../common/enums';

export class RecordQualityTestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  testType: string;

  @IsEnum(QualityOutcome)
  outcome: QualityOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
