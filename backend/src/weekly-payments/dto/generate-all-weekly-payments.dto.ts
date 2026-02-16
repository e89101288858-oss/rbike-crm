import { IsDateString } from 'class-validator'

export class GenerateAllWeeklyPaymentsDto {
  @IsDateString()
  from!: string

  @IsDateString()
  to!: string
}
