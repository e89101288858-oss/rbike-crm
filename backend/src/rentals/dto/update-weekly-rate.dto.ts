import { IsNumber, Min } from 'class-validator'

export class UpdateWeeklyRateDto {
  @IsNumber()
  @Min(0)
  weeklyRateRub!: number
}
