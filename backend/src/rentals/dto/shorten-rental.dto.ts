import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class ShortenRentalDto {
  @IsInt()
  @Min(1)
  days!: number

  @IsOptional()
  @IsString()
  reason?: string
}
