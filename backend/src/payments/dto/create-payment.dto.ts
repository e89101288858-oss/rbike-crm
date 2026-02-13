import { IsNumber, IsPositive, IsString, IsUUID } from 'class-validator'

export class CreatePaymentDto {
  @IsString()
  @IsUUID()
  rentalId!: string

  @IsNumber()
  @IsPositive()
  amount!: number
}
