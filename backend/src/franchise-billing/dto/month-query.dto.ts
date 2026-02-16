import { Transform } from 'class-transformer'
import { IsOptional, Matches } from 'class-validator'

export class MonthQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be in format YYYY-MM',
  })
  month?: string

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  includeZero?: boolean
}
