import { IsInt, Min } from 'class-validator';

export class MoveBatchDto {
  @IsInt()
  @Min(1)
  toLocationId: number;
}
