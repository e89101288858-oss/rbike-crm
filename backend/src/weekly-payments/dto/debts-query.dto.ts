import { Transform } from 'class-transformer'
import { IsOptional } from 'class-validator'

export class DebtsQueryDto {
  @IsOptional()
  @Transform(({ value }) => value !== 'false')
  overdueOnly?: boolean
}
