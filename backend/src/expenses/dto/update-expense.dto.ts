import { IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator'
import { ExpenseScopeType } from '@prisma/client'

export class UpdateExpenseDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100000000)
  amountRub?: number

  @IsOptional()
  @IsString()
  @MinLength(1)
  category?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsDateString()
  spentAt?: string

  @IsOptional()
  @IsEnum(ExpenseScopeType)
  scopeType?: ExpenseScopeType

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bikeIds?: string[]

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
