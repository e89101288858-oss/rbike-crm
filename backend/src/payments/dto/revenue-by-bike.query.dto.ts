import { IsDateString, IsOptional, IsUUID } from 'class-validator'

export class RevenueByBikeQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string

  @IsOptional()
  @IsDateString()
  to?: string

  @IsOptional()
  @IsUUID()
  bikeId?: string
}
