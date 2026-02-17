import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator'

export class CreateTenantDto {
  @IsString()
  @MinLength(1)
  name!: string

  @IsOptional()
  @IsString()
  address?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

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
}
