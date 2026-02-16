import { IsDateString, IsNumber, IsOptional, IsUUID, Min } from 'class-validator'

export class CreateRentalDto {
  @IsUUID()
  bikeId!: string

  @IsUUID()
  clientId!: string

  @IsDateString()
  startDate!: string

  @IsDateString()
  plannedEndDate!: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  weeklyRateRub?: number
}
