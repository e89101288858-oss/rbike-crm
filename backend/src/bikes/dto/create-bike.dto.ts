import { IsIn, IsOptional, IsString, MinLength } from 'class-validator'

const BIKE_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'BLOCKED', 'LOST'] as const

export class CreateBikeDto {
  @IsString()
  @MinLength(1)
  code!: string

  @IsOptional()
  @IsString()
  model?: string

  @IsOptional()
  @IsIn(BIKE_STATUSES)
  status?: (typeof BIKE_STATUSES)[number]
}
