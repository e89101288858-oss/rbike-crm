import { IsNumber, IsOptional, Max, Min } from 'class-validator'

export class UpdateMyTenantSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100000)
  dailyRateRub?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  minRentalDays?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  royaltyPercent?: number
}
