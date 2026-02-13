import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class ExtendRentalDto {
  @IsInt()
  @Min(1)
  days!: number

  @IsOptional()
  @IsString()
  reason?: string
}
