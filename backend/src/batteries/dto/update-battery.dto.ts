import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator'

const BATTERY_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'LOST'] as const

export class UpdateBatteryDto {
  @IsOptional()
  @IsString()
  code?: string

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

  @IsOptional()
  clearBike?: boolean
}
