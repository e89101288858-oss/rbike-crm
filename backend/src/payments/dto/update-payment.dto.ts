import { IsIn, IsISO8601, IsNumber, IsOptional } from 'class-validator'

const PAYMENT_STATUSES = ['PLANNED', 'PAID'] as const

export class UpdatePaymentDto {
  @IsOptional()
  @IsNumber()
  amount?: number

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: (typeof PAYMENT_STATUSES)[number]

  @IsOptional()
  @IsISO8601()
  dueAt?: string

  @IsOptional()
  @IsISO8601()
  periodStart?: string

  @IsOptional()
  @IsISO8601()
  periodEnd?: string

  @IsOptional()
  @IsISO8601()
  paidAt?: string
}
