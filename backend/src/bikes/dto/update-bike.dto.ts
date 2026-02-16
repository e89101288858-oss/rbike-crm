import { IsIn, IsOptional, IsString } from 'class-validator'

const BIKE_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'BLOCKED', 'LOST'] as const

export class UpdateBikeDto {
  @IsOptional()
  @IsString()
  code?: string

  @IsOptional()
  @IsString()
  model?: string

  @IsOptional()
  @IsString()
  frameNumber?: string

  @IsOptional()
  @IsString()
  motorWheelNumber?: string

  @IsOptional()
  @IsString()
  simCardNumber?: string

  @IsOptional()
  @IsIn(BIKE_STATUSES)
  status?: (typeof BIKE_STATUSES)[number]
}
