import { IsDateString } from 'class-validator'

export class GenerateWeeklyPaymentsDto {
  @IsDateString()
  from!: string

  @IsDateString()
  to!: string
}
