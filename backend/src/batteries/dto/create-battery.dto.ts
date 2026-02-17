import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'

const BATTERY_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'LOST'] as const

export class CreateBatteryDto {
  @IsString()
  @MinLength(1)
  code!: string

  @IsOptional()
  @IsString()
  serialNumber?: string

  @IsOptional()
  @IsUUID()
  bikeId?: string

  @IsOptional()
  @IsIn(BATTERY_STATUSES)
  status?: (typeof BATTERY_STATUSES)[number]

  @IsOptional()
  @IsString()
  notes?: string
}
