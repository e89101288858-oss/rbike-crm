import { IsIn, IsString } from 'class-validator'
import { BikeStatus } from '@prisma/client'

export const ALLOWED_BIKE_STATUSES: BikeStatus[] = [
  BikeStatus.AVAILABLE,
  BikeStatus.RENTED,
  BikeStatus.MAINTENANCE,
  BikeStatus.BLOCKED,
  BikeStatus.LOST,
]

export class UpdateBikeStatusDto {
  @IsString()
  @IsIn(ALLOWED_BIKE_STATUSES)
  status!: BikeStatus
}
