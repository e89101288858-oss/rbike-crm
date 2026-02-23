import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator'
import { ExpenseScopeType } from '@prisma/client'

export class CreateExpenseDto {
  @IsNumber()
  @Min(0.01)
  @Max(100000000)
  amountRub!: number

  @IsString()
  @MinLength(1)
  category!: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsDateString()
  spentAt!: string

  @IsEnum(ExpenseScopeType)
  scopeType!: ExpenseScopeType

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bikeIds?: string[]
}
