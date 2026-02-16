import { IsDateString, IsOptional } from 'class-validator'

export class RevenueByDaysQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string

  @IsOptional()
  @IsDateString()
  to?: string
}
