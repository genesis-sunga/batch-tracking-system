import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { QualityOutcome } from '../../common/enums';

export class QualityTestQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(QualityOutcome)
  outcome?: QualityOutcome;
}
