import { IsInt, Min } from 'class-validator'

export class ExtendRentalDto {
  @IsInt()
  @Min(1)
  days!: number
}
