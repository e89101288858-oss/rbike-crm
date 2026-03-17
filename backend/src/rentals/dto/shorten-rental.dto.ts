import { Type } from 'class-transformer'
import { IsInt, Min } from 'class-validator'

export class ShortenRentalDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days!: number
}
