import { IsDateString, IsOptional } from 'class-validator'

export class RevenueByBikeQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string

  @IsOptional()
  @IsDateString()
  to?: string
}
