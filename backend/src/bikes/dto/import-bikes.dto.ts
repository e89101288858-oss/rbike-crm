import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

const BIKE_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'BLOCKED', 'LOST'] as const

export class ImportBikeRowDto {
  @IsString()
  code!: string

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

export class ImportBikesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportBikeRowDto)
  rows!: ImportBikeRowDto[]
}
