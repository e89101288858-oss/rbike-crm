import { IsISO8601, IsUUID } from 'class-validator'

export class CreateRentalDto {
  @IsUUID()
  bikeId!: string

  @IsUUID()
  clientId!: string

  @IsISO8601()
  startDate!: string

  @IsISO8601()
  plannedEndDate!: string
}

