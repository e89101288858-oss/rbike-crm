import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator'

const PAYMENT_STATUSES = ['PLANNED', 'PAID'] as const
const PAYMENT_KINDS = ['WEEKLY_RENT', 'MANUAL'] as const

export class ListPaymentsQueryDto {
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: (typeof PAYMENT_STATUSES)[number]

  @IsOptional()
  @IsIn(PAYMENT_KINDS)
  kind?: (typeof PAYMENT_KINDS)[number]

  @IsOptional()
  @IsUUID()
  rentalId?: string

  @IsOptional()
  @IsUUID()
  clientId?: string

  @IsOptional()
  @IsDateString()
  dueFrom?: string

  @IsOptional()
  @IsDateString()
  dueTo?: string
}
