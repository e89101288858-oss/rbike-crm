import { IsString, MinLength } from 'class-validator'

export class CloseRentalDto {
  @IsString()
  @MinLength(3)
  reason!: string
}
